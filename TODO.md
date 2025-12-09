# TODO: The Tauri Pivot

> **Mission:** Transform "Vibe Machine" from a fragile web toy into a robust Rust-powered desktop creator tool.

## Phase 1: The Foundation (Tauri Setup)
- [ ] Initialize Tauri v2 in the project (`pnpm tauri init`).
- [ ] Configure `tauri.conf.json` for desktop windowing (hide menu bar, dark theme).
- [ ] Verify React frontend runs inside the Tauri window.
- [ ] **Deliverable:** The current app running as a native `.app` / `.exe`.

## Phase 2: The "Vibe Engine" (Rust Core)
- [ ] Initialize a new Rust workspace member: `crates/vibe-engine`.
- [ ] Implement basic types in Rust: `Settings`, `Track`, `VisualizerState`.
- [ ] Implement `Visualizer` trait in Rust (using `raqote` for 2D drawing).
- [ ] Implement "Bars" mode in Rust (proof of concept).
- [ ] **Deliverable:** A Rust crate that can draw a test frame to a PNG file.

## Phase 3: The Bridge (WASM)
- [ ] Configure `wasm-pack` build for `vibe-engine`.
- [ ] Create TS bindings for the WASM module.
- [ ] Refactor `Visualizer.tsx` to load the WASM module and draw to Canvas (replacing `VisualizerCore.ts`).
- [ ] **Deliverable:** The frontend preview is powered by compiled Rust code.

## Phase 4: The Forge (Native Export)
- [ ] Implement `export_video` Tauri Command in `src-tauri`.
- [ ] Integrate `symphonia` for audio decoding on the backend.
- [ ] Integrate `ffmpeg-sidecar` for video encoding.
- [ ] Wire up the "Export" button to trigger the Tauri command.
- [ ] **Deliverable:** A working "Render" button that produces an MP4 on the user's desktop.

## Phase 5: Polish & Persistence
- [ ] Implement Project Persistence (`save_project` / `load_project`) using `fs` scope.
- [ ] Restore "Holographic Industrial" UI details in the native context (custom title bar).
- [ ] **Deliverable:** A shippable v1.0 Desktop App.