# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibe Machine is a **Tauri v2 desktop app** (React + Rust) for creating cinematic audio visualizations. The core architecture uses a shared Rust "vibe-engine" crate that compiles to both WASM (for live preview) and native (for high-quality export).

## Commands

```bash
# Development
pnpm dev                          # Vite dev server (web preview only)
pnpm tauri dev                    # Full Tauri app with hot reload

# Build
pnpm build:wasm                   # Compile vibe-engine to WASM
pnpm build                        # Build WASM + Vite bundle
pnpm tauri build                  # Full desktop app bundle (.app/.exe)

# Rust
cargo build --manifest-path=src-tauri/Cargo.toml
cargo build --manifest-path=crates/vibe-engine/Cargo.toml
cd crates/vibe-engine && wasm-pack build --target web --out-dir ../../src/vibe-engine-wasm
```

## Architecture

### The "Holy Grail" Pattern

Same Rust code powers both preview and export:

```
vibe-engine (Rust crate)
├── WASM target → React canvas preview (60fps)
└── Native target → FFmpeg pipe (4K/60fps export)
```

### Key Modules

| Path                           | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| `crates/vibe-engine/`          | Pure Rust visualizer - `f(state, freq_data) → pixels`   |
| `src-tauri/src/lib.rs`         | Tauri commands, FFmpeg piping, audio decode (Symphonia) |
| `App.tsx`                      | Orchestrator: Web Audio API, file handling, UI shell    |
| `components/VisualizerCore.ts` | WASM bridge, canvas rendering loop                      |
| `components/Visualizer.tsx`    | React wrapper for canvas                                |
| `store/vibeStore.ts`           | Zustand store with Tauri plugin-store persistence       |
| `types.ts`                     | Shared TS types (Track, VibeSettings, enums)            |

### Data Flow

1. **Audio**: File → HTMLAudioElement → Web Audio AnalyserNode → FFT data (Uint8Array)
2. **Preview**: FFT data → `VibeEngine.render()` (WASM) → Canvas putImageData
3. **Export**: Symphonia decode → spectrum-analyzer FFT → `VibeEngine.render_native()` → FFmpeg stdin pipe

### Rust Crates

- **vibe-engine**: Core renderer. Stateful `VibeEngine` with attack/decay physics and `draw_bars()` rasterizer. WASM via `wasm-bindgen`.
- **app (src-tauri)**: Links vibe-engine natively. Uses `symphonia` for audio decode, `spectrum-analyzer` for FFT, and `tauri-plugin-shell` sidecar for FFmpeg.

## Design System

"Holographic Industrial" aesthetic per DESIGN_SYSTEM.md:

- **Void**: `#030304` (deepest background)
- **Carbon**: `#0a0a0b` (component surfaces)
- **Plasma**: `#ffb703` (primary accent)
- **Flux**: `#0ea5e9` (secondary/active states)

## Current State

Per TODO.md, Phases 1-4 are largely complete. The export pipeline is functional (bundled FFmpeg sidecar). Remaining work: project persistence, custom title bar polish.
