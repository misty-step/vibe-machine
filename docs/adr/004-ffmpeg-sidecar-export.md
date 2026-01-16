# ADR 004: FFmpeg Sidecar for Video Export

**Date**: 2024-12 (Commit `ab516f3`)
**Status**: Accepted

## Context

Video export requires encoding raw RGBA frames into H.264/MP4 with AAC audio. Options:

1. Embed a video encoder library
2. Shell out to user-installed FFmpeg
3. Bundle FFmpeg as a sidecar binary

## Decision

Bundle FFmpeg as a **Tauri sidecar** (`bundle.externalBin`), piping raw frames via stdin.

## Rationale

1. **Reliability**: Bundled binary means export works out-of-box. No "install FFmpeg first" support burden. Users expect native apps to just work.

2. **Codec quality**: FFmpeg's libx264/AAC encoders are battle-tested. Rust encoder crates (rav1e, x264-rs) add build complexity and are less optimized.

3. **Tauri integration**: `tauri-plugin-shell` provides secure sidecar spawning with stdin/stdout streaming. The pattern is well-documented.

4. **Separation of concerns**: Rendering (Rust) and encoding (FFmpeg) are decoupled. Can upgrade FFmpeg independently. Can add export presets (ProRes, GIF) without code changes.

## Alternatives Considered

- **User-installed FFmpeg**: Rejected. macOS Gatekeeper, Windows PATH issues, version inconsistencies.
- **Embedded encoder (rav1e, x264-rs)**: Massive build complexity. Would still need muxer.
- **WebCodecs API**: Not available in Tauri WebView. Would require web worker approach.
- **GStreamer**: Even heavier dependency than FFmpeg.

## Consequences

- Bundle size increases (~50MB for FFmpeg universal binary)
- Must maintain FFmpeg binaries for each platform (macOS arm64/x86_64, Windows, Linux)
- Security: FFmpeg processes untrusted paths - requires path validation (see ADR 005)
- Async streaming via `CommandEvent` requires careful stdin/process lifecycle management

## Implementation Pattern

```rust
let sidecar = app.shell().sidecar("ffmpeg")?;
let (mut rx, mut child) = sidecar
    .args([
        "-y", "-f", "rawvideo", "-pixel_format", "rgba",
        "-video_size", &format!("{}x{}", width, height),
        "-framerate", &fps.to_string(),
        "-i", "-",  // stdin for video frames
        "-i", &audio_path,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        &output_path,
    ])
    .spawn()?;

// Render loop
for frame in frames {
    child.write(&frame_bytes)?;
}
drop(child);  // Close stdin, signals EOF

// Await termination
while let Some(CommandEvent::Terminated(payload)) = rx.recv().await {
    // Handle exit code
}
```

## References

- `src-tauri/src/export_video.rs`: FFmpeg spawning
- `src-tauri/tauri.conf.json`: `bundle.externalBin` config
- `src-tauri/bin/`: Platform-specific FFmpeg binaries
- Commit `ab516f3`: Export pipeline
