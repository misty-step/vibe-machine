//! Video export pipeline - decode audio, render frames, pipe to FFmpeg.

use crate::path_guard::guard_export_paths;
use spectrum_analyzer::windows::hann_window;
use spectrum_analyzer::{samples_fft_to_spectrum, scaling::divide_by_N_sqrt, FrequencyLimit};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::probe::Hint;
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use vibe_engine::{VibeEngine, VibeSettings};

const FFT_BINS: usize = 64;
const FFT_WINDOW: usize = 2048;

#[derive(Clone, serde::Serialize)]
pub struct ExportProgress {
    pub progress: f32,
    pub status: String,
}

#[derive(serde::Deserialize)]
pub struct ExportParams {
    pub audio_path: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub image_path: String,
    pub output_path: String,
    pub settings: VibeSettings,
    pub fps: u32,
    pub width: i32,
    pub height: i32,
}

#[tauri::command]
pub async fn export_video(app: tauri::AppHandle, params: ExportParams) -> Result<(), String> {
    let ExportParams {
        audio_path,
        output_path,
        settings,
        fps,
        width,
        height,
        ..
    } = params;

    // Validate paths BEFORE any file operations
    let guarded = guard_export_paths(&audio_path, &output_path)?;
    let start_time = std::time::Instant::now();

    // Log export start (basename only for security)
    log::info!(
        "Starting export: audio={}, output={}",
        guarded
            .audio
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown"),
        guarded
            .output
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
    );

    // 1. Setup Audio Decoding using guarded path
    let src = std::fs::File::open(&guarded.audio).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(src), Default::default());
    let hint = Hint::new();
    let format_opts = Default::default();
    let metadata_opts = Default::default();
    let decoder_opts = Default::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| e.to_string())?;
    let mut format = probed.format;
    let track = format.default_track().ok_or("No track found")?;
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| e.to_string())?;

    // 2. Setup FFmpeg Pipe using guarded paths
    let sidecar = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    let (mut rx, mut child) = sidecar
        .args([
            "-y",
            "-f",
            "rawvideo",
            "-pixel_format",
            "bgra",
            "-video_size",
            &format!("{}x{}", width, height),
            "-framerate",
            &fps.to_string(),
            "-i",
            "-", // stdin
            "-i",
            guarded.audio.to_str().ok_or("Invalid audio path encoding")?,
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            guarded
                .output
                .to_str()
                .ok_or("Invalid output path encoding")?,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    // 3. Rendering Loop
    let mut engine = VibeEngine::new(width, height);

    let _ = app.emit(
        "export-progress",
        ExportProgress {
            progress: 0.0,
            status: "Decoding Audio...".into(),
        },
    );

    let mut audio_buffer: Vec<f32> = Vec::new();
    let mut actual_sample_rate = 44100;

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }
        let decoded = decoder.decode(&packet).map_err(|e| e.to_string())?;

        let spec = *decoded.spec();
        actual_sample_rate = spec.rate;
        let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);

        // Mono mix
        let samples = sample_buf.samples();
        let channels = spec.channels.count();
        for chunk in samples.chunks(channels) {
            let sum: f32 = chunk.iter().sum();
            audio_buffer.push(sum / channels as f32);
        }
    }

    // Render
    if audio_buffer.is_empty() {
        return Err("Audio decode produced no samples".into());
    }

    let total_frames =
        ((audio_buffer.len() as f64 / actual_sample_rate as f64) * fps as f64).ceil() as usize;
    let samples_per_frame = ((actual_sample_rate as f64 / fps as f64).ceil()) as usize;

    for i in 0..total_frames {
        let sample_idx = i * samples_per_frame;

        // Prepare FFT Data
        let freq_data_u8 = if sample_idx + FFT_WINDOW <= audio_buffer.len() {
            build_fft_bins(
                &audio_buffer[sample_idx..sample_idx + FFT_WINDOW],
                actual_sample_rate,
            )
        } else {
            vec![0u8; FFT_BINS]
        };

        // Engine Render
        engine.render_native(&settings, &freq_data_u8);

        // Write
        let pixels = engine.get_pixel_slice();
        child.write(pixels).map_err(|e| e.to_string())?;

        if i % 30 == 0 {
            let _ = app.emit(
                "export-progress",
                ExportProgress {
                    progress: i as f32 / total_frames as f32,
                    status: "Rendering Video...".into(),
                },
            );
        }
    }

    // Drop child to close stdin, then await termination via events
    drop(child);

    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(payload) = event {
            if payload.code.unwrap_or_default() != 0 {
                log::error!("ffmpeg exited with code {:?}", payload.code);
                return Err(format!("ffmpeg exited with code {:?}", payload.code));
            }
            break;
        }
    }

    let elapsed = start_time.elapsed().as_secs_f32();
    log::info!("Export completed in {:.1}s", elapsed);

    let _ = app.emit(
        "export-progress",
        ExportProgress {
            progress: 1.0,
            status: format!("Done in {:.1}s", elapsed),
        },
    );

    Ok(())
}

fn build_fft_bins(window: &[f32], sample_rate: u32) -> Vec<u8> {
    let hann = hann_window(window);
    let spectrum = match samples_fft_to_spectrum(
        &hann,
        sample_rate,
        FrequencyLimit::All,
        Some(&divide_by_N_sqrt),
    ) {
        Ok(spec) => spec,
        Err(_) => return vec![0u8; FFT_BINS],
    };

    let data = spectrum.data();
    let step = (data.len().max(FFT_BINS)) / FFT_BINS;
    let mut bins = vec![0u8; FFT_BINS];

    for (j, bin) in bins.iter_mut().enumerate() {
        let mut sum = 0.0;
        for k in 0..step {
            if let Some((_, val)) = data.get(j * step + k) {
                sum += val.val();
            }
        }
        let avg = sum / step as f32;
        *bin = (avg * 1000.0).min(255.0) as u8;
    }

    bins
}
