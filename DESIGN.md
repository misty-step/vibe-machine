# DESIGN.md: Native High-Performance Video Export

> "Complexity is anything that makes software hard to understand or modify." — John Ousterhout

## 1. Executive Summary

**Problem:** Vibe Machine currently lacks a viable export mechanism. `canvas.captureStream()` is nondeterministic, prone to desync, and typically limited to WebM (poor ecosystem support).
**Goal:** Implement a **deterministic offline rendering pipeline** that produces broadcast-quality **MP4 (H.264 + AAC)** video files client-side.
**Philosophy:** Deep Modules. The complexity of frame scheduling, encoding, and muxing must be completely hidden behind a simple `render()` interface.

## 2. Architecture: The Offline Pipeline

We will move away from "recording what you see" (screen capture) to "rendering what you want" (deterministic generation).

### The High-Level Flow

```mermaid
graph TD
    A[User Clicks Export] --> B[VideoRenderer Module]
    B --> C{Parallel Processes}
    C -->|Audio| D[OfflineAudioContext]
    C -->|Video| E[Frame Scheduler]
    D --> F[AudioEncoder (AAC)]
    E --> G[Visualizer Engine (Pure)]
    G --> H[OffscreenCanvas]
    H --> I[VideoFrame]
    I --> J[VideoEncoder (H.264)]
    F --> K[MP4 Muxer]
    J --> K
    K --> L[Final Blob]
```

### Key Modules

#### 1. `VisualizerEngine` (Refactored)
*   **Current State:** `Visualizer.tsx` is a React component tightly coupled to DOM and real-time `Date.now()`.
*   **New Design:** A framework-agnostic class `VisualizerCore`.
    *   **Input:** `CanvasContext`, `AudioAnalysisData`, `Settings`, `Time`.
    *   **Output:** Draw commands to context.
    *   **Trait:** Idempotent. Calling `draw(t=5.0)` always produces the exact same pixel output.

#### 2. `AudioCompositor`
*   **Responsibility:** Prepares the audio mix for both playback and export.
*   **Implementation:**
    *   **Realtime:** Uses `AudioContext`.
    *   **Offline:** Uses `OfflineAudioContext`.
    *   **Shared Logic:** Both contexts share the same graph construction logic (Source -> Analyser -> Gain -> Dest).

#### 3. `VideoRenderer` (The Deep Module)
*   **Interface:**
    ```typescript
    interface RenderOptions {
      width: number;
      height: number;
      fps: number;
      bitrate: number;
    }
    
    function renderProject(
      playlist: Track[], 
      settings: VibeSettings, 
      options: RenderOptions,
      onProgress: (p: number) => void
    ): Promise<Blob>;
    ```
*   **Internals:**
    *   Manages the `WebCodecs` `VideoEncoder` and `AudioEncoder`.
    *   Feeds data into `mp4-muxer`.
    *   Controls the "Time Loop" (stepping `t += 1/fps`).

## 3. Technology Stack Decisions

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Video Encoding** | **WebCodecs API** | Native performance (hardware acceleration), precise frame control. Beats WASM in speed. |
| **Container** | **mp4-muxer** | Lightweight (pure TS), specialized for WebCodecs. Avoids 20MB+ ffmpeg.wasm payload. |
| **Audio Processing** | **OfflineAudioContext** | The only way to guarantee 100% sync. Renders audio faster than realtime. |
| **Canvas** | **OffscreenCanvas** | Decouples rendering from the main thread UI. (Future proofing for WebWorker). |

## 4. Implementation Steps

### Phase 1: The "Pure" Refactor (Complexity Debt Repayment)
Before we can render, we must untangle the visualizer.
1.  Extract `VisualizerCore` logic out of `Visualizer.tsx`.
2.  Ensure `physicsState` (attack/decay) can be calculated deterministically (step-based simulation vs time-delta simulation).
3.  **Deliverable:** `Visualizer.tsx` becomes a thin wrapper around `VisualizerCore`.

### Phase 2: The Audio Engine
1.  Create `useAudioEngine` hook.
2.  Abstract graph creation so it can accept `OfflineAudioContext`.
3.  Implement `getAudioData(file)` to decode files into buffers (required for Offline context).

### Phase 3: The Renderer
1.  Scaffold `VideoRenderer` class.
2.  Implement `WebCodecs` initialization (check `isConfigSupported`).
3.  Implement the Main Loop:
    *   `for (let t = 0; t < duration; t += 1/fps)`
    *   `analyser.getByteFrequencyData` (Mocking this in offline mode is tricky; we need to pre-analyze the audio buffer using `ScriptProcessor` or pre-compute FFT data).
    *   **Correction:** `OfflineAudioContext` *can* provide an `AnalyserNode` but it only works during the `startRendering()` promise execution or via `ScriptProcessor`. 
    *   **Better Approach:** Pre-compute the Frequency Data for the entire track into a big array `Float32Array[]` before video rendering starts. This ensures fast lookups during the video loop.

### Phase 4: Integration
1.  Wire up the "Export" button.
2.  Add progress UI.

## 5. Risk Assessment

*   **Memory Pressure:** 4K rendering @ 60fps generates massive data. We must ensure `VideoFrame.close()` is called immediately after encoding.
*   **Browser Support:** WebCodecs is widely supported (Chrome, Edge, Safari 15.4+, Firefox 130+). We need a graceful fallback (basic `MediaRecorder` WebM) or a "Browser not supported" toast.
*   **FFT Synchronization:** Getting the exact FFT data for frame `N` requires mapping `time -> sample_index`.

## 6. Ousterhout Review
*   **Deep Module?** Yes. Interface is simple `render()`, implementation handles codecs/sync.
*   **Information Hiding?** Yes. React components know nothing about H.264.
*   **Strategic Programming?** Yes. We are building a foundational engine, not a quick hack.

