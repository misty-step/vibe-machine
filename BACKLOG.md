# BACKLOG.md

Last groomed: December 7, 2025
Analyzed by: Gemini CLI (Simulating 15 perspectives)

## Recent Shipments
- **[Feature] Real MP4 Export (H.264/AAC)** - Implemented full offline rendering pipeline with WebCodecs and mp4-muxer.
- **[Performance] Fix Visualizer Re-render Loop** - Fixed React useEffect dependency cycles.
- **[Architecture] Extract Audio Engine** - Refactored App.tsx into `useAudioEngine` hook.

## Now (Sprint-Ready, <2 weeks)

### [Feature] "Cinematic" Visualizer Modes
**Perspectives**: product-visionary, design-systems-architect
**Why**: Only one "Bars" mode exists. Competitors have 10+.
**Approach**: Add "Orb" (circular spectrum), "Wave" (oscilloscope), and "Glitch" (chromatic aberration) modes.
**Effort**: 3d per mode | **Impact**: Triples content variety.

### [Security] sanitize Audio/Image Inputs
**File**: App.tsx:77
**Perspectives**: security-sentinel
**Why**: `URL.createObjectURL` used on user input. Ensure strict type checking and revoke URLs reliably (currently done, but brittle in `App.tsx`).
**Approach**: Move to `useObjectUrl` hook that auto-cleans up.
**Effort**: 2h

## Next (This Quarter, <3 months)

### [Performance] OffscreenCanvas
**Perspectives**: performance-pathfinder
**Why**: Move rendering to a Web Worker to unblock main thread. (Partially prepared by VisualizerCore refactor).
**Approach**: Fully isolate `VisualizerCore` into a worker.
**Effort**: 1w

## Soon (Exploring, 3-6 months)

- **[Architecture] State Management** - Migrate from `useState` drilling to `Zustand` or `Context` as settings grow.

## Later (Someday/Maybe, 6+ months)

- **[Platform] Spotify Integration** - Auth and stream directly (requires DRM handling).
- **[Product] Community Presets** - Share JSON settings via URL.
- **[Tech] WebGPU** - Port visualizer to WebGPU for particle systems > 10k points.

## Learnings

**From this grooming session:**
- **Success:** The "Deep Module" approach for `VideoRenderer` paid off. It hides massive complexity (WebCodecs, OfflineAudioContext, Muxing) behind a simple `renderProject` interface.
- **Discovery:** `mp4-muxer` works well in Vite but required careful handling of types and imports.
- **Performance:** `VisualizerCore` extraction not only enabled export but made the code much cleaner and testable.
