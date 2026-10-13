# 006: Keep app state in one Zustand store

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** vibeStore
- **Powder:** none recorded

## Context

Settings need persistence; playlist, playback, and export progress need shared
runtime state. Audio and export code also need subscriptions outside React.
React Context introduces re-render cascades; Redux adds unnecessary boilerplate.

## Decision

Use [vibeStore](../../store/vibeStore.ts) with Zustand's `subscribeWithSelector`
and Tauri plugin-store persistence for settings. Route state access through
`useVibeStore` or `useVibeStore.getState()`; do not duplicate export state in
components.

## Consequences

Components and non-React modules share one source of truth with selector
subscriptions. Settings auto-save; initialization must be awaited on app mount.
Playlist, playback, and export progress remain runtime state.
Revisit if: app-wide state or persistence requirements cannot be served by the
store and its external subscriptions.
