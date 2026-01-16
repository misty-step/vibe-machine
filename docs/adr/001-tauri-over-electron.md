# ADR 001: Tauri v2 Over Electron

**Date**: 2024-12 (Initial commit `a86094f`)
**Status**: Accepted

## Context

Vibe Machine needs a desktop runtime for:

- Native file access (audio decode, image loading)
- FFmpeg subprocess spawning for video export
- Bundling as a distributable macOS/Windows app

The obvious choices were Electron and Tauri.

## Decision

Use **Tauri v2** (Rust backend + WebView frontend).

## Rationale

1. **Binary size**: Electron bundles Chromium (~150MB+). Tauri uses system WebView, yielding ~10MB bundles. For a simple visualizer, the bloat was unjustifiable.

2. **Rust interop**: The "Holy Grail" architecture requires sharing Rust code between WASM (preview) and native (export). Tauri's Rust backend makes this trivial - the same `vibe-engine` crate compiles to both targets. With Electron, we'd need a separate native addon or child process.

3. **Security model**: Tauri's default-deny IPC with explicit capabilities is stricter than Electron's permissive model. Given we spawn FFmpeg subprocesses, this matters.

4. **v2 maturity**: Tauri v2 added async commands, better plugin ecosystem, and mobile support (future option). The API is stable.

## Alternatives Considered

- **Electron**: Rejected due to bundle size and Rust integration friction.
- **Neutralinojs**: Lighter than Electron but immature plugin ecosystem; no native Rust story.
- **Native app (Swift/C++)**: Maximum performance but loses cross-platform web preview and requires maintaining two codebases.

## Consequences

- Requires Rust toolchain in development
- Developers need macOS 12+ or Windows 10+ (WebView2 requirement)
- Some web APIs (WebGPU, SharedArrayBuffer) may differ between system WebViews
- Smaller user downloads
- FFmpeg sidecar pattern is well-documented in Tauri ecosystem

## References

- `src-tauri/tauri.conf.json`: Tauri configuration
- Commit `a86094f`: Initial Tauri v2 setup
