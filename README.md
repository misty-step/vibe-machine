# Vibe Machine

Tauri desktop app for creating cinematic audio visualizations with 4K/60fps video export.

## Quick Start

```bash
# Install (macOS)
brew install misty-step/tap/vibe-machine

# Or build from source
pnpm install
pnpm tauri dev          # Full desktop app with hot reload
```

Drop an audio file, drop a background image, hit play. Export to MP4 when ready.

## Why

Turn music into shareable video. Real-time preview at 60fps, then export frame-perfect 4K video with the same Rust renderer. No quality gap between preview and final output.

## Architecture

Same Rust code powers both preview and export:

```
vibe-engine (Rust crate)
├── WASM target → React canvas preview (60fps)
└── Native target → FFmpeg pipe (4K/60fps export)
```

Key modules:

- `crates/vibe-engine/` - Pure Rust visualizer: `f(state, freq_data) → pixels`
- `src-tauri/` - Desktop shell, FFmpeg piping, audio decode
- `App.tsx` - React orchestrator: Web Audio, file handling, UI

See `CLAUDE.md` for full architecture details.

## Development

```bash
pnpm dev                # Vite only (web preview, no export)
pnpm tauri dev          # Full desktop app
pnpm build:wasm         # Rebuild WASM after Rust changes
pnpm tauri build        # Package .app/.exe
```

## License

MIT
