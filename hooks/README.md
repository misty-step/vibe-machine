# hooks/

React hooks. Thin adapters, not deep modules.

## Files

- **`useVibeEngine.ts`** - Legacy adapter bridging old component API to Zustand store. Returns playlist, controls, analyser in pre-refactor shape.
- **`useObjectUrl.ts`** - Manages `URL.createObjectURL` lifecycle. Auto-revokes on unmount.

## Note

`useVibeEngine` exists to minimize refactoring scope. Long-term, components should consume `useVibeStore` directly.
