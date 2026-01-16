# src-tauri

Tauri v2 backend. Single IPC command hides the entire export pipeline.

## Interface

```typescript
await invoke("export_video", { params: ExportParams });
// Progress via event: listen<ExportProgress>("export-progress", handler)
```

## Internal Architecture

```
lib.rs          Plugin registration, command handler binding
export_video.rs Audio decode (Symphonia) + FFmpeg pipe + progress events
export_frame.rs Frame composition (background + viz + overlays + progress bar)
path_guard.rs   Input validation for IPC paths (security boundary)
```

## Key Dependencies

- **vibe-engine**: Linked as native crate for `render_native()`
- **symphonia**: Audio decoding (MP3, FLAC, WAV, etc.)
- **spectrum-analyzer**: FFT for frequency data
- **tauri-plugin-shell**: FFmpeg sidecar execution

## Security

`path_guard.rs` validates all paths before file operations:

- Absolute paths only
- Audio file must exist
- Output must be `.mp4` in existing directory
- No dash-prefixed filenames (FFmpeg arg injection)
