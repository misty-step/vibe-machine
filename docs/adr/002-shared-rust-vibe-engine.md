# ADR 002: Shared Rust Crate for WASM and Native

**Date**: 2024-12 (Commit `5d75bd9`)
**Status**: Accepted

## Context

Audio visualizations must render:

1. **Live preview** (browser canvas, 60fps, any resolution)
2. **Export** (headless, 4K/60fps, piped to FFmpeg)

If preview and export use different renderers, visual parity becomes a testing nightmare. "What you see is what you get" is essential for user trust.

## Decision

Create a single Rust crate (`crates/vibe-engine`) that compiles to:

- **WASM** (`wasm-pack`) for live preview in browser
- **Native** (linked into `src-tauri`) for headless export

The same `render_native()` function powers both paths.

## Rationale

1. **Bit-perfect parity**: Same physics state machine, same rasterizer, same output bytes. No canvas API differences, no floating-point discrepancies.

2. **Hybrid JS/WASM rendering**: Background image handling and text overlays stay in JS (Canvas API has better image handling). Rust handles only the compute-intensive parts: physics simulation and bar rasterization. This keeps the WASM binary small (~350KB) and avoids reinventing image codecs.

3. **Performance**: The custom software rasterizer (`fill_rect()` with manual clipping) is faster than Canvas API for thousands of small rects. Attack/decay physics run identically regardless of frame timing.

4. **Maintainability**: One visualization codebase instead of two. Bug fixes and new visualizer modes automatically apply to both preview and export.

## Alternatives Considered

- **Canvas API for both**: Ruled out because headless Canvas in Rust/FFmpeg pipeline is awkward. Would need puppeteer or similar.
- **WebGL/GPU for both**: Overkill for simple bar visualization. Adds GPU driver dependencies to export path.
- **Separate renderers with visual regression tests**: High maintenance burden. Still wouldn't catch timing/physics differences.

## Consequences

- `vibe-engine` must remain `no_std`-compatible enough for WASM (no filesystem, no threads)
- WASM bindings (`#[wasm_bindgen]`) coexist with plain Rust impl blocks
- Build requires `wasm-pack` plus native Rust toolchain
- Memory layout (ABGR little-endian) must be consistent between targets
- Text rendering stays in JS/Rust-image because font rasterization in WASM is painful

## Implementation Details

```rust
// WASM entry point (calls native impl)
#[wasm_bindgen]
pub fn render(&mut self, settings_val: JsValue, freq_data: &[u8], _time: f64) {
    let settings: VibeSettings = serde_wasm_bindgen::from_value(settings_val)?;
    self.render_native(&settings, freq_data);  // Same function!
}

// Native entry point (called directly in export_video.rs)
pub fn render_native(&mut self, settings: &VibeSettings, freq_data: &[u8]) {
    self.pixels.fill(0x00000000);
    self.update_physics(freq_data);
    self.draw_bars(settings);
}
```

## References

- `crates/vibe-engine/src/lib.rs`: Shared engine
- `components/VisualizerCore.ts`: WASM integration
- `src-tauri/src/export_video.rs`: Native usage
- Commit `5d75bd9`: Initial implementation
