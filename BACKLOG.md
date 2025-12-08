# BACKLOG.md

Last groomed: December 7, 2025
Analyzed by: Gemini CLI (Simulating 15 perspectives)

## Recent Shipments
- **[Security] Secure Object URL Management** - Implemented `useObjectUrl` hook to prevent memory leaks from file uploads.
- **[UX] "Empty State" Onboarding** - Added glassmorphism instructions overlay for empty playlists.
- **[Architecture] Dismantle `App.tsx` God Component** - Extracted `Sidebar` and `PlayerControls` into focused components.
- **[Feature] "Cinematic" Visualizer Modes** - Added "Orbital" and "Wave" modes.
- **[Feature] Real MP4 Export (H.264/AAC)** - Implemented full offline rendering pipeline.

---

## Now (Sprint-Ready, <2 weeks)

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

---

## Next (This Quarter, <3 months)

### [Performance] OffscreenCanvas & Worker Thread
**Perspectives**: performance-pathfinder
**Why**: High-res rendering (4K export) freezes the UI.
**Approach**: Move `VisualizerCore` to a Web Worker and use `OffscreenCanvas` for rendering.
**Effort**: 1w | **Impact**: 60fps UI even during heavy rendering.

### [UX] Drag & Drop Visual Feedback
**Perspectives**: user-experience-advocate
**Why**: The "drop zone" is implicit. Users need visual confirmation when dragging files over the window.
**Approach**: Add global drag-and-drop handler with a "Drop to Import" overlay.
**Effort**: 3h

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
- **UX Wins:** The "Empty State" overlay immediately makes the app feel more professional and less like a dev tool.
- **Security:** Handling `URL.createObjectURL` properly is a small change with big stability impact for long sessions.
- **Focus:** We are now moving from "Core Tech" (Audio/Video Engine) to "User Features" (Text, Presets, Social).