use std::process::{Command, Stdio};
use std::io::Write;
use std::path::PathBuf;
use tauri::Emitter;
use vibe_engine::{VibeEngine, VibeSettings, VisualizerMode};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::probe::Hint;
use symphonia::core::audio::SampleBuffer;
use spectrum_analyzer::{samples_fft_to_spectrum, FrequencyLimit, WindowType, scaling::divide_by_N_sqrt};
use spectrum_analyzer::windows::hann_window;

#[derive(Clone, serde::Serialize)]
struct ExportProgress {
    progress: f32,
    status: String,
}

#[tauri::command]
async fn export_video(
    app: tauri::AppHandle,
    audio_path: String,
    image_path: String, // We might need to load this, or just skip for now
    output_path: String,
    settings: VibeSettings,
    fps: u32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    let start_time = std::time::Instant::now();
    
    // 1. Setup Audio Decoding
    let src = std::fs::File::open(&audio_path).map_err(|e| e.to_string())?;
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

    // 2. Setup FFmpeg Pipe
    // ffmpeg -f rawvideo -pixel_format rgba -video_size WxH -framerate FPS -i - -i audio.mp3 -c:v libx264 -c:a copy output.mp4
    let mut child = Command::new("ffmpeg")
        .arg("-y") // overwrite
        .arg("-f").arg("rawvideo")
        .arg("-pixel_format").arg("bgra") // vibe-engine produces 0xAABBGGRR (little endian u32) -> BGRA in byte order? 
        // Wait, u32: 0xAABBGGRR (LE) -> Bytes: [RR, GG, BB, AA] ?
        // Rust Vec<u32> as byte slice:
        // u32 = 0x12345678 -> [0x78, 0x56, 0x34, 0x12] (LE)
        // Engine: 0xFF03B7FF (A=FF, R=03, G=B7, B=FF) (assuming I wrote hex_to_u32 for ABGR)
        // Engine hex_to_u32: (255 << 24) | (b << 16) | (g << 8) | r
        // 0xAABBGGRR
        // Memory (LE): [R, G, B, A]
        // So RGBA.
        // Let's stick to rgba.
        .arg("-video_size").arg(format!("{}x{}", width, height))
        .arg("-framerate").arg(fps.to_string())
        .arg("-i").arg("-") // stdin for video
        .arg("-i").arg(&audio_path) // Audio from file directly
        .arg("-map").arg("0:v")
        .arg("-map").arg("1:a")
        .arg("-c:v").arg("libx264")
        .arg("-pix_fmt").arg("yuv420p") // for compatibility
        .arg("-c:a").arg("aac") // re-encode audio to aac just in case
        .arg("-shortest")
        .arg(&output_path)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}. Ensure ffmpeg is in PATH.", e))?;

    let mut stdin = child.stdin.take().ok_or("Failed to open ffmpeg stdin")?;

    // 3. Rendering Loop
    let mut engine = VibeEngine::new(width, height);
    // TODO: Load background image if possible. For MVP, generic dark background.
    
    let mut time = 0.0;
    let dt = 1.0 / fps as f64;
    let sample_rate = 44100; // Assumption, should read from track
    
    // We need to feed audio samples to FFT
    // This is complex because we decode packets (which have variable frames) 
    // but we render video at fixed intervals.
    // Strategy: Decode *everything* into a big buffer first? (Memory heavy)
    // Strategy: Stream decode and buffer enough for FFT.
    
    // Simple MVP: Decode everything to a Vec<f32> (mono mix)
    // Only efficient for short songs (< 10 mins). 10 mins * 44100 * 4 bytes = ~1.7MB. Very cheap.
    // Wait, 1.7MB? 
    // 600s * 44100 = 26,460,000 samples. 
    // * 4 bytes = ~100 MB. Fine for desktop.
    
    let _ = app.emit("export-progress", ExportProgress { progress: 0.0, status: "Decoding Audio...".into() });

    let mut audio_buffer: Vec<f32> = Vec::new();
    let mut actual_sample_rate = 44100;

    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id { continue; }
        let decoded = decoder.decode(&packet).map_err(|e| e.to_string())?;
        
        actual_sample_rate = decoded.spec().rate;
        let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
        sample_buf.copy_interleaved_ref(decoded);
        
        // Mono mix
        let samples = sample_buf.samples();
        let channels = decoded.spec().channels.count();
        for chunk in samples.chunks(channels) {
            let sum: f32 = chunk.iter().sum();
            audio_buffer.push(sum / channels as f32);
        }
    }

    // Render
    let total_frames = (audio_buffer.len() as f64 / actual_sample_rate as f64 * fps as f64) as usize;
    let samples_per_frame = actual_sample_rate as usize / fps as usize;
    
    // FFT window
    let fft_size = 2048;
    
    for i in 0..total_frames {
        let sample_idx = i * samples_per_frame;
        
        // Prepare FFT Data
        let mut freq_data_u8 = vec![0u8; 64]; // Engine expects slice
        
        if sample_idx + fft_size < audio_buffer.len() {
            let window = &audio_buffer[sample_idx..sample_idx + fft_size];
            // Spectrum Analyzer expects exact power of 2
            // Apply Hann window
            let hann = hann_window(window);
            // spectrum-analyzer crate usage
            let spectrum = samples_fft_to_spectrum(
                &hann,
                actual_sample_rate,
                FrequencyLimit::All,
                Some(&divide_by_N_sqrt),
            ).unwrap();
            
            // Map spectrum to 64 bins (naive)
            // We actually just need to match what update_physics expects.
            // It expects ~60 bins mapped logarithmically.
            // Let's just dump magnitude values.
            let data = spectrum.data();
            // Downsample to 64
            let step = data.len() / 64;
            for j in 0..64 {
                let mut sum = 0.0;
                for k in 0..step {
                    if let Some((_, val)) = data.get(j * step + k) {
                        sum += val.val();
                    }
                }
                let avg = sum / step as f32;
                // Scale arbitrary magnitude to 0-255
                let scaled = (avg * 1000.0).min(255.0) as u8;
                freq_data_u8[j] = scaled;
            }
        }

        // Engine Render
        engine.render_native(&settings, &freq_data_u8);
        
        // Write
        let pixels = engine.get_pixel_slice();
        stdin.write_all(pixels).map_err(|e| e.to_string())?;

        if i % 30 == 0 {
             let _ = app.emit("export-progress", ExportProgress { 
                 progress: i as f32 / total_frames as f32, 
                 status: "Rendering Video...".into() 
             });
        }
        
        time += dt;
    }

    drop(stdin); // Close stdin to signal EOF
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    
    if !output.status.success() {
        return Err(format!("FFmpeg failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let _ = app.emit("export-progress", ExportProgress { progress: 1.0, status: "Done".into() });
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
    .invoke_handler(tauri::generate_handler![export_video])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}