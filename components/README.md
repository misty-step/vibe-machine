# components/

React UI components. Mix of deep and presentational.

## Entry Points

- **`Visualizer.tsx`** - Canvas wrapper, delegates rendering to `VisualizerCore`
- **`Sidebar.tsx`** - Settings panel (presentational, no business logic)
- **`PlayerControls.tsx`** - Playback controls

## Deep Module

**`VisualizerCore.ts`** - WASM bridge and rendering loop

```typescript
const core = new VisualizerCore();
core.render(
  ctx,
  width,
  height,
  settings,
  frequencyData,
  backgroundImage,
  track,
  time,
  duration,
  isPlaying,
  elapsed
);
```

Hides:

- WASM initialization and memory access
- Background image scaling with Ken Burns effect
- Vignette gradient compositing
- Settings mapping (camelCase -> snake_case)
- Overlay drawing delegation
