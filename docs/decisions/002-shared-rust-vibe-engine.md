# 002: One Rust renderer for preview and export

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** vibe-engine
- **Powder:** none recorded

## Context

Live browser preview and headless video export must show the same visualization.
Separate renderers duplicate physics and rasterization and make visual parity
hard to test.

## Decision

Use [vibe-engine](../../crates/vibe-engine/src/lib.rs) for both WASM preview and
native export through the same `render_native()` implementation. Do not add a
separate Canvas or GPU visualization renderer; keep filesystem, threads, and
platform-specific behavior out of the core.

## Consequences

Visualization fixes apply to both paths, with identical physics and pixel
layout. The build needs WASM and native Rust tooling; image and text handling
remain outside the core rasterizer.
Revisit if: visualization requirements exceed the shared software rasterizer's
capabilities or require GPU rendering.
