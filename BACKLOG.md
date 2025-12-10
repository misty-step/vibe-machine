# BACKLOG: Vibe Machine

> Last groomed: 2025-12-09
> Method: 15-agent parallel audit + competitive intelligence

---

## NOW (This Week)

### Critical: Dead Code Removal ✓

**Flagged by: 5+ agents** | Complexity: Low | Impact: High

- [x] Delete `hooks/useAudioEngine.ts` (250 lines) - never imported, replaced by AudioSystem singleton
- [x] Delete `engine/RenderSystem.ts` (109 lines) - never used, Visualizer.tsx uses inline RAF loop
- [x] Remove vestigial `audioElRef` from useVibeEngine return

### Critical: Security Fix

**Flagged by: security-sentinel, torvalds** | Complexity: Low | Impact: Critical

- [ ] Fix path traversal risk in `App.tsx:125` - `(track.file as any).path` hack
  - Use Tauri's `path` module to resolve/validate file paths safely
  - Add path canonicalization before FFmpeg handoff

### Critical: State Duplication

**Flagged by: 4 agents** | Complexity: Medium | Impact: High

- [ ] Remove `isExporting` local state in App.tsx - use store's `exportProgress` exclusively
- [ ] Single source of truth for export state

### Foundation: Test Infrastructure ✓

**Flagged by: beck, fowler, 3 others** | Complexity: Low | Impact: High

- [x] Install Vitest + @vitest/coverage-v8
- [x] Add first smoke test (types export correctly)
- [ ] Add Rust tests for vibe-engine (currently zero)

---

## NEXT (This Sprint)

### Architecture: Parameter Object Refactor

**Flagged by: ousterhout, fowler, carmack** | Complexity: Medium | Impact: Medium

- [ ] Replace 11-parameter `render()` in VisualizerCore.ts with `RenderConfig` object
  ```typescript
  interface RenderConfig {
    canvas: HTMLCanvasElement;
    engine: VibeEngine;
    settings: VibeSettings;
    frequencyData: Uint8Array;
    metadata?: { title: string; artist: string };
  }
  ```
- [ ] Extract magic numbers (padding=32, barsBaseline=height-80) into config

### Architecture: Resolution Helper

**Flagged by: 3 agents** | Complexity: Low | Impact: Medium

- [ ] Extract duplicated aspect ratio logic (3 locations) into `utils/resolution.ts`
  - App.tsx export handler
  - PlayerControls aspect ratio display
  - Export modal resolution picker

### UX: Error Handling

**Flagged by: user-experience-advocate, jobs** | Complexity: Low | Impact: Medium

- [ ] Replace `alert()` calls with toast notification system
- [ ] Add error boundary for visualizer crashes
- [ ] Graceful degradation when WASM fails to load

### Performance: Font Bundle

**Flagged by: performance-pathfinder, carmack** | Complexity: Low | Impact: Medium

- [ ] Audit 7 font families (~2.7MB) - which are actually used?
- [ ] Lazy-load fonts based on selected style
- [ ] Consider system font stack for UI, custom fonts for export overlay only

---

## SOON (Next Month)

### Feature: Visualization Modes

**From: product-visionary, competitive intel** | Complexity: High | Impact: High

- [ ] Orbital/Circular mode (competitor parity: Vizzy, Magic Music Visuals)
- [ ] Waveform mode (oscilloscope style)
- [ ] Abstract/Generative mode (particle systems)

### Feature: Preset System

**From: product-visionary, jobs** | Complexity: Medium | Impact: High

- [ ] Save/load visualization presets
- [ ] Built-in preset gallery (10-15 curated looks)
- [ ] Export presets as shareable JSON

### Feature: Batch Export

**From: competitive intel** | Complexity: Medium | Impact: Medium

- [ ] Queue multiple tracks for export
- [ ] Progress tracking per track
- [ ] Album art extraction for overlay

### Architecture: Deep Module Cleanup

**From: ousterhout, grug** | Complexity: Medium | Impact: Medium

- [ ] Collapse useVibeEngine pass-through layer into direct store access
- [ ] Move AudioSystem initialization into store
- [ ] Reduce hook indirection layers

### Infrastructure: Quality Gates

**From: maintainability-maven** | Complexity: Low | Impact: Medium

- [ ] Add Lefthook for pre-commit hooks
- [ ] ESLint + Prettier config
- [ ] GitHub Actions CI (test + build)
- [ ] Dependabot for dependency updates

---

## LATER (Future Vision)

### Feature: Real-Time Audio Input

**From: competitive intel (Resolume, VDMX)** | Complexity: High | Impact: High

- [ ] Microphone/line-in capture
- [ ] Virtual audio cable support (Loopback, BlackHole)
- [ ] Live performance mode

### Feature: AI-Powered Presets

**From: product-visionary** | Complexity: High | Impact: Medium

- [ ] Analyze audio characteristics (BPM, energy, genre)
- [ ] Suggest matching visualization settings
- [ ] "Generate preset for this song" feature

### Platform: Plugin SDK

**From: competitive intel** | Complexity: Very High | Impact: High

- [ ] Custom shader support
- [ ] JavaScript plugin API for new modes
- [ ] Community preset sharing

### Platform: Timeline Editor

**From: competitive intel (DaVinci, After Effects)** | Complexity: Very High | Impact: Medium

- [ ] Keyframe animation for settings
- [ ] Multi-track audio support
- [ ] Project save/load with undo history

---

## Competitive Landscape

| Competitor          | Strengths                         | Vibe Machine Advantage               |
| ------------------- | --------------------------------- | ------------------------------------ |
| Vizzy               | Mobile-first, quick TikTok export | Desktop quality, 4K export           |
| Resolume            | Pro VJ features, real-time        | Simpler UX, no learning curve        |
| VDMX                | Modular, infinite flexibility     | Focused workflow, beautiful defaults |
| Magic Music Visuals | iTunes integration                | Modern stack, better export          |
| After Effects       | Industry standard                 | Instant results, no timeline editing |

**Positioning:** "The Figma of audio visualization" - professional results, approachable interface.

---

## Tracking

- Issues flagged by 4+ agents: 5 (in NOW section)
- Issues flagged by 3 agents: 5 (in NEXT section)
- Total dead code identified: ~360 lines (DELETED)
- Security issues: 1 critical (path traversal)
- Test coverage: Vitest installed, smoke tests passing
- Quality gates: Lefthook + ESLint + Prettier + GitHub Actions CI
