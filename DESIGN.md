# DESIGN.md: Vibe Machine (Tauri/Rust Edition)

> "Don't fight the platform. Use the kernel." — Linus Torvalds

## 1. Executive Summary

**Pivot:** We are abandoning the "Browser-only" constraint. Vibe Machine is being reborn as a **native desktop application** using **Tauri**.
**Goal:** Create a professional-grade creator tool capable of rendering 4K/60fps long-form videos without memory crashes.
**Core Philosophy:** The "Engine" moves to Rust. The "UI" stays in React. We share logic via WebAssembly (WASM).

## 2. The "Holy Grail" Architecture

To ensure 1:1 parity between the **Live Preview** (React) and the **Offline Export** (Rust), we will implement the core visualization logic **once** in Rust and compile it for two targets.

```mermaid
graph TD
    subgraph "Shared Core (Rust)"
        VE[Vibe Engine Crate]
        VE -->|Compile| WASM[vibe_engine.wasm]
        VE -->|Compile| LIB[vibe_engine.lib]
    end

    subgraph "Frontend (Tauri Window)"
        React[React UI]
        React -->|Load| WASM
        WASM -->|Draw| Canvas[HTML5 Canvas (Preview)]
        React -->|IPC: Invoke| Tauri
    end

    subgraph "Backend (System Process)"
        Tauri[Tauri Main]
        Tauri -->|Link| LIB
        LIB -->|Frames| Encoder[FFmpeg / Video-RS]
        Encoder -->|Write| Disk[MP4 File]
    end
```

### Key Modules

#### 1. `vibe-engine` (The Deepest Module)
*   **Language:** Rust.
*   **Responsibility:** Pure arithmetic and drawing.
*   **Inputs:** `AudioData (FFT)`, `BackgroundImage (Pixels)`, `Settings`, `Time`.
*   **Output:** `FrameBuffer (RGBA)`.
*   **Trait:** Pure function. `f(state, time) -> pixels`.

#### 2. `vibe-desktop` (The Shell)
*   **Framework:** Tauri v2.
*   **Responsibility:** Window management, File I/O, System Integration.
*   **Render Pipeline:**
    *   Spawns a dedicated Render Thread.
    *   Loads audio file via `symphonia` (Rust audio decoding).
    *   Runs the `vibe-engine` loop.
    *   Pipes output to `ffmpeg` (bundled sidecar) for broadcast-grade encoding.

#### 3. `vibe-ui` (The Face)
*   **Framework:** React + Vite.
*   **Responsibility:** User interaction, Settings configuration.
*   **Preview:** Uses `vibe-engine` (WASM) to draw to a canvas at 60fps for immediate feedback.

## 3. Why This Wins

1.  **Performance:** Rust handles the heavy lifting (Audio FFT, Pixel manipulation) on the metal.
2.  **Stability:** No browser OOM (Out of Memory) crashes. We manage our own buffers.
3.  **Quality:** Access to `ffmpeg` means we can export ProRes, DNxHD, or 50mbps H.264—formats browsers dream of.
4.  **Consistency:** By sharing the Rust core via WASM, the preview looks *exactly* like the export.

## 4. Stack Selection

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **App Framework** | **Tauri v2** | Tiny footprint, secure, modern. |
| **Core Lang** | **Rust** | Performance, safety, WASM support. |
| **Graphics** | **Raqote** or **Skia** | 2D drawing libraries for Rust. (Raqote is pure Rust, simpler for WASM). |
| **Audio Decode** | **Symphonia** | Pure Rust audio decoding (WAV, MP3, FLAC, AAC). |
| **Video Encode** | **FFmpeg (Sidecar)** | The industry standard. Unbeatable compatibility. |

## 5. Migration Strategy

We are not "refactoring" the JS code; we are **replacing** the engine.

1.  **Freeze React:** The current UI is good. Keep it.
2.  **Initialize Tauri:** Wrap the existing React app.
3.  **Forge the Engine:** Write `vibe-engine` in Rust.
4.  **Wire WASM:** Replace `VisualizerCore.ts` with calls to `vibe-engine.wasm`.
5.  **Wire Native:** Implement the export command in Tauri using the same engine.

## 6. Risk Assessment

*   **Complexity:** Setting up the Rust -> WASM -> JS bridge is non-trivial.
*   **Build Size:** Bundling FFmpeg increases installer size (but is worth it).
*   **Learning Curve:** Rust ownership model.

## 7. Ousterhout Review
*   **Deep Module:** `vibe-engine` is the ultimate deep module. Complex math inside, simple `draw_frame()` API outside.
*   **Strategic:** We solve the performance problem forever, not just for today.