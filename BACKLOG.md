# BACKLOG.md

Last groomed: December 7, 2025
Analyzed by: Gemini CLI (Simulating 15 perspectives)

---

## Now (Sprint-Ready, <2 weeks)

### [Architecture] Dismantle `App.tsx` God Component
**File**: App.tsx:1-End
**Perspectives**: complexity-archaeologist, architecture-guardian, maintainability-maven
**Why**: `App.tsx` handles state, UI layout, audio orchestration, and drag-and-drop. It is a classic "Shallow Module" that does too much.
**Approach**: 
1. Extract `Sidebar` (settings UI) into `components/Sidebar.tsx`.
2. Extract `PlayerControls` (playback UI) into `components/PlayerControls.tsx`.
3. Move drag-and-drop logic to `hooks/useFileHandler.ts`.
**Effort**: 1d | **Impact**: Unlocks parallel feature development, makes testing possible.

### [Product] "Cinematic" Visualizer Modes (Orbital & Wave)
**File**: components/VisualizerCore.ts
**Perspectives**: product-visionary, design-systems-architect
**Why**: Competitors (VEED, Renderforest) offer 100+ templates. Vibe Machine has 1 ("Bars"). Users leave if the "vibe" doesn't match their track.
**Approach**: 
1. Add `drawOrbital()`: Circular frequency spectrum with mirroring.
2. Add `drawWave()`: Oscilloscope-style time-domain line.
3. Update `VisualizerCore` switch statement.
**Effort**: 3d | **Impact**: Triples content variety, retention hook.

### [Security] Secure Object URL Management
**File**: App.tsx / hooks/useFileHandler.ts
**Perspectives**: security-sentinel
**Why**: `URL.createObjectURL` creates memory leaks if not revoked. Current implementation in `App.tsx` is ad-hoc.
**Approach**: Create `useObjectUrl` hook that automatically calls `revokeObjectURL` on component unmount or value change.
**Effort**: 2h | **Risk**: Medium (Memory Leaks/Crash)

### [UX] "Empty State" Onboarding
**Perspectives**: user-experience-advocate
**Why**: Current app starts blank. Users don't know they need to drag/drop files.
**Approach**: Add a "Glassmorphism" overlay instruction when playlist is empty: "Drop Audio & Image Here".
**Effort**: 4h | **Impact**: Reduces bounce rate for new users.

---

## Next (This Quarter, <3 months)

### [Feature] Text Overlays & Smart Typography
**Perspectives**: product-visionary, design-systems-architect
**Why**: Competitors allow adding Artist/Title text. Essential for "Social Ready" video export.
**Approach**: Add "Text" tab to settings. Render text in `VisualizerCore` using `CanvasRenderingContext2D` with custom fonts.
**Effort**: 1w | **Impact**: Makes exports usable for TikTok/Instagram promotion.

### [Architecture] Persistent Settings (JSON Presets)
**Perspectives**: user-experience-advocate, product-visionary
**Why**: Users lose their "vibe" (colors, sensitivity) on refresh.
**Approach**: Save `settings` state to `localStorage`. Add "Export Preset" (download JSON) button.
**Effort**: 2d | **Impact**: User retention, community sharing foundation.

### [Performance] OffscreenCanvas & Worker Thread
**Perspectives**: performance-pathfinder
**Why**: High-res rendering (4K export) freezes the UI.
**Approach**: Move `VisualizerCore` to a Web Worker and use `OffscreenCanvas` for rendering.
**Effort**: 1w | **Impact**: 60fps UI even during heavy rendering.

---

## Soon (Exploring, 3-6 months)

- **[Product] Spotify Integration** - Auth and stream directly. (Hard: DRM issues, might require official SDK).
- **[Architecture] State Management Migration** - `useState` drilling is reaching its limit. Migrate to `Zustand` or `Context`.
- **[Tech] WebGPU Renderer** - Port `VisualizerCore` to WebGPU for particle systems > 10k points.

---

## Later (Someday/Maybe, 6+ months)

- **[Platform] Community Hub** - "VibeStore" for sharing presets.
- **[Feature] AI-Reactive Visuals** - Use LLM to analyze lyrics and change palette/mode automatically.
- **[Export] Cloud Rendering** - Server-side rendering for mobile users who can't handle local 4K export.

---

## Learnings

**From this grooming session:**
- **Architecture:** The core `VisualizerCore` and `VideoRenderer` are "Deep Modules" (Ousterhout approved) - they hide immense complexity. `App.tsx` is the opposite.
- **Market:** We cannot compete on "Templates" quantity yet. We must compete on "Real-Time Experience" and "Aesthetic Quality" (The "Cinematic Ether").
- **Gap:** Video Export is technically solved (WebCodecs) but product-wise incomplete (no text, no presets).