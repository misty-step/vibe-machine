//! Video export pipeline - decode audio, render frames, pipe to FFmpeg.

use crate::export_frame::{FrameComposer, OverlayConfig};
use crate::path_guard::guard_multi_track_paths;
use spectrum_analyzer::windows::hann_window;
use spectrum_analyzer::{samples_fft_to_spectrum, scaling::divide_by_N_sqrt, FrequencyLimit};
use std::io::Write;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::probe::Hint;
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tempfile::{NamedTempFile, TempPath};
use vibe_engine::{VibeEngine, VibeSettings};

const FFT_BINS: usize = 64;
const FFT_WINDOW: usize = 2048;

/// Decoded audio ready for visualization and export.
struct DecodedAudio {
    samples: Vec<f32>,
    sample_rate: u32,
}

/// Decode multiple audio files into a single buffer.
/// All tracks must have the same sample rate (fails fast if mismatch).
fn decode_tracks(paths: &[impl AsRef<Path>]) -> Result<DecodedAudio, String> {
    let mut samples: Vec<f32> = Vec::new();
    let mut expected_rate: Option<u32> = None;

    for (i, path) in paths.iter().enumerate() {
        let path = path.as_ref();
        let track_num = i + 1;

        let src = std::fs::File::open(path)
            .map_err(|e| format!("Failed to open track {}: {}", track_num, e))?;
        let mss = MediaSourceStream::new(Box::new(src), Default::default());

        let probed = symphonia::default::get_probe()
            .format(&Hint::new(), mss, &Default::default(), &Default::default())
            .map_err(|e| format!("Failed to probe track {}: {}", track_num, e))?;

        let mut format = probed.format;
        let track = format
            .default_track()
            .ok_or_else(|| format!("No audio stream in track {}", track_num))?;
        let track_id = track.id;

        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &Default::default())
            .map_err(|e| format!("Failed to create decoder for track {}: {}", track_num, e))?;

        while let Ok(packet) = format.next_packet() {
            if packet.track_id() != track_id {
                continue;
            }

            let decoded = decoder
                .decode(&packet)
                .map_err(|e| format!("Decode error in track {}: {}", track_num, e))?;

            let spec = *decoded.spec();

            // Validate sample rate consistency (fail-fast)
            match expected_rate {
                None => expected_rate = Some(spec.rate),
                Some(rate) if rate != spec.rate => {
                    return Err(format!(
                        "Sample rate mismatch: track {} is {}Hz, but previous tracks are {}Hz. \
                         All tracks must have the same sample rate.",
                        track_num, spec.rate, rate
                    ));
                }
                _ => {}
            }

            let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
            sample_buf.copy_interleaved_ref(decoded);

            // Mono mixdown
            let channels = spec.channels.count();
            for chunk in sample_buf.samples().chunks(channels) {
                let sum: f32 = chunk.iter().sum();
                samples.push(sum / channels as f32);
            }
        }
    }

    let sample_rate = expected_rate.ok_or("No audio data decoded")?;
    if samples.is_empty() {
        return Err("Audio decode produced no samples".into());
    }

    Ok(DecodedAudio { samples, sample_rate })
}

/// Create FFmpeg concat list file with proper path escaping.
/// Returns TempPath that keeps the file alive until dropped.
fn create_concat_file(paths: &[impl AsRef<Path>]) -> Result<TempPath, String> {
    let file = NamedTempFile::new()
        .map_err(|e| format!("Failed to create concat file: {}", e))?;

    {
        let mut writer = std::io::BufWriter::new(&file);
        for path in paths {
            let path_str = path.as_ref().to_str().ok_or("Invalid path encoding")?;
            // Escape for FFmpeg concat format:
            // 1. Backslashes (Windows paths) - escape first
            // 2. Single quotes - use shell-style escaping
            let escaped = path_str
                .replace('\\', "\\\\")
                .replace('\'', "'\\''");
            writeln!(writer, "file '{}'", escaped).map_err(|e| e.to_string())?;
        }
        writer.flush().map_err(|e| e.to_string())?;
    }

    // Convert to TempPath - file persists until TempPath is dropped
    Ok(file.into_temp_path())
}

#[derive(Clone, serde::Serialize)]
pub struct ExportProgress {
    pub progress: f32,
    pub status: String,
}

#[derive(serde::Deserialize)]
pub struct ExportParams {
    /// Multiple audio paths to concatenate (in order)
    pub audio_paths: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub image_path: String,
    pub output_path: String,
    pub settings: VibeSettings,
    pub fps: u32,
    pub width: i32,
    pub height: i32,
    #[serde(default)]
    pub show_progress: bool,
    #[serde(default)]
    pub text_overlay_png_base64: String,
}

#[tauri::command]
pub async fn export_video(app: tauri::AppHandle, params: ExportParams) -> Result<(), String> {
    let ExportParams {
        audio_paths,
        output_path,
        settings,
        fps,
        width,
        height,
        image_path,
        show_progress,
        text_overlay_png_base64,
        ..
    } = params;

    // Validate paths BEFORE any file operations
    let guarded = guard_multi_track_paths(&audio_paths, &output_path, &image_path)?;
    let start_time = std::time::Instant::now();

    // Log export start
    log::info!(
        "Starting export: {} audio tracks, output={}, image={}",
        guarded.audio_paths.len(),
        guarded
            .output
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown"),
        guarded
            .image
            .as_ref()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("none")
    );

    // 1. Decode ALL audio files BEFORE spawning FFmpeg (fail-fast on errors/mismatches)
    let _ = app.emit(
        "export-progress",
        ExportProgress {
            progress: 0.0,
            status: format!("Decoding {} tracks...", guarded.audio_paths.len()),
        },
    );

    let audio = decode_tracks(&guarded.audio_paths)?;
    log::info!(
        "Decoded {} samples at {}Hz from {} tracks",
        audio.samples.len(),
        audio.sample_rate,
        guarded.audio_paths.len()
    );

    // 2. Create FFmpeg concat list (TempPath keeps file alive until function returns)
    let concat_path_handle = create_concat_file(&guarded.audio_paths)?;

    // 3. Setup FrameComposer BEFORE spawning FFmpeg (fail-fast)
    let mut engine = VibeEngine::new(width, height);

    let accent_rgb = hex_to_rgb(&settings.visualizer_color);
    let overlay = OverlayConfig {
        show_progress,
        accent_rgb,
    };
    // Use guarded image path (already validated)
    let guarded_image_str = guarded
        .image
        .as_ref()
        .and_then(|p| p.to_str())
        .unwrap_or("");
    let composer = FrameComposer::new(
        width,
        height,
        guarded_image_str,
        overlay,
        &text_overlay_png_base64,
    )?;
    // Composer owns the size; callers don't compute independently
    let mut frame = vec![0u8; composer.frame_size()];

    // Compute timing: use f64 for precision, avoid cumulative drift
    let audio_duration_secs = audio.samples.len() as f64 / audio.sample_rate as f64;
    let total_frames = (audio_duration_secs * fps as f64).ceil() as usize;
    let samples_per_frame_f64 = audio.sample_rate as f64 / fps as f64;

    // 4. NOW spawn FFmpeg - all validation complete, nothing can fail before render loop
    let sidecar = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    let concat_path = concat_path_handle
        .to_str()
        .ok_or("Invalid concat file path encoding")?;
    let (mut rx, mut child) = sidecar
        .args([
            "-y",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgba",
            "-video_size",
            &format!("{}x{}", width, height),
            "-framerate",
            &fps.to_string(),
            "-i",
            "-", // stdin (video frames)
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_path, // audio from concat list
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

    for i in 0..total_frames {
        // Float accumulator prevents A/V sync drift from integer rounding
        let sample_idx = (i as f64 * samples_per_frame_f64).floor() as usize;

        // Prepare FFT Data
        let freq_data_u8 = if sample_idx + FFT_WINDOW <= audio.samples.len() {
            build_fft_bins(
                &audio.samples[sample_idx..sample_idx + FFT_WINDOW],
                audio.sample_rate,
            )
        } else {
            vec![0u8; FFT_BINS]
        };

        // Engine Render
        engine.render_native(&settings, &freq_data_u8);

        // Compose frame (background + viz + overlays) then write
        let pixels = engine.get_pixel_slice();
        composer.compose_into(pixels, i, total_frames, &mut frame);
        child.write(&frame).map_err(|e| e.to_string())?;

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

fn hex_to_rgb(hex: &str) -> (u8, u8, u8) {
    const FALLBACK: (u8, u8, u8) = (255, 183, 3); // Plasma fallback

    let h = hex.trim_start_matches('#');
    if h.len() != 6 {
        return FALLBACK;
    }

    if let (Ok(r), Ok(g), Ok(b)) = (
        u8::from_str_radix(&h[0..2], 16),
        u8::from_str_radix(&h[2..4], 16),
        u8::from_str_radix(&h[4..6], 16),
    ) {
        (r, g, b)
    } else {
        FALLBACK
    }
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
