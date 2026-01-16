# vibe-engine

Pure Rust visualizer core. Compiles to both WASM (live preview) and native (high-quality export).

## Interface

```rust
let engine = VibeEngine::new(width, height);
engine.resize(width, height);
engine.render(settings, freq_data, time);  // WASM entry point
engine.render_native(&settings, &freq_data);  // Native entry point
let pixels = engine.get_pixel_slice();  // RGBA output
```

## Internal Concepts

- **Physics state**: Per-bar smoothed values with attack/decay envelope
- **Rasterizer**: Clipped `fill_rect()` writing RGBA to pixel buffer
- **Color**: Hex string parsed to ABGR (little-endian for canvas compatibility)

## Build

```bash
# WASM (for web preview)
wasm-pack build --target web --out-dir ../../src/vibe-engine-wasm

# Native (linked by src-tauri)
cargo build
```
