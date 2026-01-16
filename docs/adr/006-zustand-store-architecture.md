# ADR 006: Zustand Store with Tauri Persistence

**Date**: 2024-12
**Status**: Accepted

## Context

The app needs centralized state for:

- User settings (persisted across sessions)
- Playlist (runtime only)
- Playback state (runtime only)
- Export progress (runtime only)

React Context would work but introduces re-render cascades. Redux is overkill. Need something lightweight with selector support.

## Decision

Use **Zustand** with `subscribeWithSelector` middleware, persisting settings via Tauri's `plugin-store`.

## Rationale

1. **Minimal boilerplate**: Zustand stores are plain objects with functions. No actions, reducers, or dispatch.

2. **Selector subscriptions**: `subscribeWithSelector` enables fine-grained reactivity. `AudioSystem` subscribes to `currentTrackId` changes without re-rendering components.

3. **External subscriptions**: Non-React code (like `AudioSystem` singleton) can subscribe to store changes. Essential for decoupling audio from React lifecycle.

4. **Tauri plugin-store**: `LazyStore` provides JSON persistence to app data directory. Settings survive restarts.

5. **Single source of truth**: Export state lives in store, not component state. `ExportController` updates store; components read from store.

## Alternatives Considered

- **React Context + useReducer**: Re-render problems, no external subscription support.
- **Redux Toolkit**: Heavyweight for this app size. Boilerplate overhead.
- **Jotai/Recoil**: Atom-based models are harder to reason about for app-wide state.
- **localStorage**: Not available in Tauri context reliably. `plugin-store` is the official solution.

## Consequences

- All state access goes through `useVibeStore` hook or `useVibeStore.getState()`
- Settings auto-save on change via subscription
- `subscribeWithSelector` required for efficient subscriptions
- Initialization is async (must `await initialize()` on app mount)
- Export state (`isExporting`, `exportProgress`, `exportStatus`) is store-managed, not component-local

## Implementation Pattern

```typescript
// Store definition
export const useVibeStore = create<VibeState>()(
  subscribeWithSelector((set, get) => ({
    settings: DEFAULT_SETTINGS,
    updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
    // ...
  }))
);

// Component usage
const settings = useVibeStore((s) => s.settings);

// External subscription (AudioSystem)
useVibeStore.subscribe(
  (state) => state.currentTrackId,
  (newId, oldId) => {
    if (newId !== oldId) void this.loadTrack(newId);
  }
);

// Persistence
const settingsStore = new LazyStore("settings.json");
useVibeStore.subscribe(
  (state) => state.settings,
  (settings) => {
    settingsStore.set("settings", settings);
    settingsStore.save();
  }
);
```

## References

- `store/vibeStore.ts`: Store implementation
- `engine/AudioSystem.ts`: External subscription example
- `export/ExportController.ts`: Store access from non-component
