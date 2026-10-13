# Decisions

A steering veto list. Open it before proposing a new primitive, surface, or
storage home. Write a record after deciding *not* to build something the next
agent will otherwise re-propose. Do not write one per PR. Start from
[0000-template.md](0000-template.md).

## Steering

- [001](001-tauri-over-electron.md): tauri over Electron.
- [002](002-shared-rust-vibe-engine.md): one Rust renderer for preview and export.
- [004](004-ffmpeg-sidecar-export.md): bundle FFmpeg rather than require a user installation.
- [005](005-path-guard-security.md): validate IPC paths in Rust before file access.
- [006](006-zustand-store-architecture.md): keep app state in one Zustand store.
- [007](007-platform-abstraction-pattern.md): isolate Tauri APIs behind runtime helpers.
- [008](008-export-controller-deep-module.md): keep export orchestration out of React components.
- [009](009-audio-system-singleton.md): one AudioSystem owns the audio lifecycle.

## Historical

Former ADRs; their numbers stay reserved. Original prose is retained; the
superseded renderer brief's link to 002 is adjusted for its new location.

- [003](historical/003-symphonia-audio-decode.md): Symphonia library selection for native audio decoding.
- [0010](historical/0010-shared-rust-renderer.md): superseded shared renderer brief (formerly 0001; renumbered because it was dated later than 001, Tauri over Electron).
