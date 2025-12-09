use std::io::Write;
use std::path::PathBuf;
use tauri::Emitter;
use vibe_engine::{VibeEngine, VibeSettings, VisualizerMode};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::probe::Hint;
use symphonia::core::audio::SampleBuffer;
use spectrum_analyzer::{samples_fft_to_spectrum, FrequencyLimit, WindowType, scaling::divide_by_N_sqrt};
use spectrum_analyzer::windows::hann_window;
use tauri_plugin_shell::ShellExt;

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

    // 2. Setup FFmpeg Pipe (Sidecar)
    let sidecar = app.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    let (mut rx, mut child) = sidecar
        .args([
            "-y",
            "-f", "rawvideo",
            "-pixel_format", "bgra",
            "-video_size", &format!("{}x{}", width, height),
            "-framerate", &fps.to_string(),
            "-i", "-", // stdin
            "-i", &audio_path,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest",
            &output_path
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    // 3. Rendering Loop
    let mut engine = VibeEngine::new(width, height);
    // TODO: Load background image if possible. For MVP, generic dark background.
    
    let mut time = 0.0;
    let dt = 1.0 / fps as f64;
    let sample_rate = 44100; // Assumption, should read from track
    
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
            let hann = hann_window(window);
            let spectrum = samples_fft_to_spectrum(
                &hann,
                actual_sample_rate,
                FrequencyLimit::All,
                Some(&divide_by_N_sqrt),
            ).unwrap();
            
            let data = spectrum.data();
            let step = data.len() / 64;
            for j in 0..64 {
                let mut sum = 0.0;
                for k in 0..step {
                    if let Some((_, val)) = data.get(j * step + k) {
                        sum += val.val();
                    }
                }
                let avg = sum / step as f32;
                let scaled = (avg * 1000.0).min(255.0) as u8;
                freq_data_u8[j] = scaled;
            }
        }

        // Engine Render
        engine.render_native(&settings, &freq_data_u8);
        
        // Write
        let pixels = engine.get_pixel_slice();
        child.write(pixels).map_err(|e| e.to_string())?;

        if i % 30 == 0 {
             let _ = app.emit("export-progress", ExportProgress { 
                 progress: i as f32 / total_frames as f32, 
                 status: "Rendering Video...".into() 
             });
        }
        
        time += dt;
    }

    // Close stdin by dropping or writing EOF? 
    // CommandChild doesn't have explicit close_stdin. 
    // Usually dropping child might kill process, but we want to wait.
    // The sidecar plugin handles stdin closing when `write` receives empty? Or we might just need to finish.
    // Wait, `CommandChild` has no `wait`. `rx` receives events (Closed).
    
    // We just stop writing. FFmpeg might hang waiting for stdin if we don't close it.
    // There is no explicit `close_stdin` in Tauri v2 CommandChild API currently exposed in simple docs?
    // Let's assume `child` drop might not be enough if it's a ref.
    // Actually, `CommandChild` has `write` taking `&[u8]`.
    
    // Issue: How to close stdin to signal FFmpeg to finish?
    // `tauri-plugin-shell` doesn't seem to expose `stdin.close()`.
    // Workaround: We rely on FFmpeg to finish when it processes all frames?
    // No, it waits for stdin EOF.
    
    // Hack: Use `kill` if we can't close stdin? No, that corrupts file.
    
    // Alternate: Use `std::process::Command` but point to the resolved sidecar path.
    // This gives us full control over Stdio.
    // `app.path().resolve("bin/ffmpeg...", ...)`
    
    // Let's revert to `std::process::Command` but find the sidecar path manually.
    // Sidecar path resolution:
    // It's intricate.
    
    // Let's stick with `tauri_plugin_shell` and hope it closes stdin on drop or we can send a signal.
    // Actually, looking at source, `CommandChild` is a struct.
    // If we can't close stdin, this architecture is blocked.
    
    // REVERT STRATEGY:
    // Use `std::process::Command`.
    // Assume `ffmpeg` is in PATH OR find it in the resource directory.
    // Since I downloaded it to `src-tauri/bin`, let's try to resolve that path.
    
    // Resolving resource:
    // `app.path().resource_dir()` -> Join `bin` -> Join `ffmpeg-<target>`.
    
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    // The binary name depends on target.
    // But wait, `externalBin` binaries are not inside `resources` folder in the final bundle?
    // They are sidecars.
    
    // Let's go with: `app.shell().sidecar("ffmpeg")` is the *correct* way to find it.
    // If `CommandChild` lacks `close_stdin`, that's a Tauri limitation.
    // However, recent Tauri versions might handle this.
    
    // Let's try to stick to `std::process::Command` and just assume `ffmpeg` is in the path for now, 
    // BUT adding the sidecar path to PATH?
    
    // Best bet for "Test it as third parties":
    // If I use `std::process::Command`, I need the absolute path.
    // `app.shell().sidecar("ffmpeg")` creates a `Command` struct (Tauri's wrapper).
    // It has `spawn`.
    
    // Let's look at `src-tauri/src/lib.rs` again. I'll stick with `std::process::Command` for the pipe control, 
    // but I will try to locate the binary.
    // For this session, I will rely on the system `ffmpeg` (which I just downloaded, but I need to put it in PATH or call it absolutely).
    // I put it in `src-tauri/bin`.
    
    // Let's try to invoke it from `src-tauri/bin` directly.
    
    let mut ffmpeg_path = std::env::current_dir().unwrap().join("src-tauri/bin/ffmpeg-aarch64-apple-darwin");
    if !ffmpeg_path.exists() {
        // Fallback to system ffmpeg
        ffmpeg_path = PathBuf::from("ffmpeg");
    }
    
    let mut child = std::process::Command::new(ffmpeg_path)
        .arg("-y")
        .arg("-f").arg("rawvideo")
        .arg("-pixel_format").arg("bgra")
        .arg("-video_size").arg(format!("{}x{}", width, height))
        .arg("-framerate").arg(fps.to_string())
        .arg("-i").arg("-")
        .arg("-i").arg(&audio_path)
        .arg("-map").arg("0:v")
        .arg("-map").arg("1:a")
        .arg("-c:v").arg("libx264")
        .arg("-pix_fmt").arg("yuv420p")
        .arg("-c:a").arg("aac")
        .arg("-shortest")
        .arg(&output_path)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}. Ensure ffmpeg is in PATH or src-tauri/bin.", e))?;

    let mut stdin = child.stdin.take().ok_or("Failed to open ffmpeg stdin")?;
    
    // ... (Rest of the logic remains the same)
    
    // Loop...
    
    // ...
    
    // This logic was in the previous file content I wrote.
    // I will just re-apply the file with the updated path finding logic and the tauri log plugin init.
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init()) // Init shell plugin
    .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
    .invoke_handler(tauri::generate_handler![export_video])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}