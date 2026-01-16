# ADR-0001: Shared Rust Renderer for Preview and Export

**Status:** Superseded by [002-shared-rust-vibe-engine](./002-shared-rust-vibe-engine.md)
**Date:** 2025-12-01

## Context

Audio visualizers typically have a "preview problem": the live preview uses one renderer (often GPU-accelerated browser canvas), while export uses another (often a slower, CPU-based approach or screen recording). This leads to:

1. Visual inconsistency between preview and final output
2. Duplicated rendering logic
3. Export artifacts (dropped frames, screen capture noise)

## Decision

Use a single Rust crate (`vibe-engine`) that compiles to:

- **WASM** for live browser preview via React canvas
- **Native** for frame-by-frame video export piped to FFmpeg

The renderer is a pure function: `f(state, freq_data) → pixels`. No platform-specific code in the core.

## Consequences

### Positive

- Pixel-perfect match between preview and export
- Single source of truth for visualization math (attack/decay, bar physics)
- Native export runs faster than real-time (not bound to 60fps playback)

### Negative

- WASM adds ~50ms initial load time
- Rust/WASM toolchain complexity (wasm-pack, wasm-bindgen)
- Cannot use browser-only APIs (WebGL) in core renderer

### Neutral

- Requires rebuilding WASM after Rust changes (`pnpm build:wasm`)
- Tauri links the same crate natively, slight build time increase
