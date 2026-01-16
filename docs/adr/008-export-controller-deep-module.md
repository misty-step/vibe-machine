# ADR 008: ExportController as Deep Module

**Date**: 2024-12 (Commit `50b2f40`)
**Status**: Accepted

## Context

Export workflow involves:

1. Platform detection
2. Save dialog for output path
3. Possibly prompting for audio source
4. Rendering text overlay to PNG
5. IPC to Rust backend
6. Progress event listening
7. State updates to store
8. Error handling and user feedback

Initially, this logic was scattered across `App.tsx` and inline handlers. Tight coupling, hard to test, re-render issues.

## Decision

Extract into **ExportController** - a singleton module that owns the entire export UX flow. Follows Ousterhout's "deep module" principle: simple interface, complex implementation.

## Rationale

1. **Information hiding**: App.tsx calls `exportController.startExport()`. Doesn't know about dialogs, path normalization, IPC params, or progress events.

2. **State management**: Controller updates store directly via `useVibeStore.getState()`. No prop drilling, no callback chains.

3. **Testability**: Can mock `tauriDialogs()` and `tauriInvoke()` to unit test export flow without Tauri runtime.

4. **Single responsibility**: Component renders UI. Controller handles business logic.

## Interface

```typescript
export interface ExportController {
  isSupported(): boolean; // Platform check
  attachProgressListener(): Promise<() => void>; // Returns cleanup fn
  startExport(): Promise<void>; // Fire-and-forget
}
```

That's it. Three methods. Everything else is hidden.

## Alternatives Considered

- **useExport hook**: Would re-render on every state change. Export state updates frequently during render.
- **Context provider**: Overkill for singleton behavior. Adds wrapper component.
- **Inline in App.tsx**: Where it started. Grew unmanageable.

## Consequences

- Export logic is isolated in `export/` directory
- Components don't need to know about Tauri APIs
- Progress listener attached once on mount, cleaned up on unmount
- Errors handled internally, surfaced via store state
- Can swap backend (e.g., WebCodecs for web export) by changing controller internals

## Implementation Highlights

```typescript
// App.tsx - consumer
useEffect(() => {
  let cleanup: (() => void) | undefined;
  exportController.attachProgressListener().then((unlisten) => {
    cleanup = unlisten;
  });
  return () => cleanup?.();
}, []);

const handleExport = () => exportController.startExport();

// ExportController - provider
async startExport(): Promise<void> {
  // 1. Platform check
  if (!isTauri()) { ... }

  // 2. Concurrency guard
  if (isExporting) return;

  // 3. Dialog flow
  const outputPath = await dialogs.save({ ... });
  if (!outputPath) return;  // Cancelled, no state change

  // 4. IPC
  await invoke("export_video", { params: { ... } });

  // Success handled by progress listener
}
```

## References

- `export/ExportController.ts`: Implementation
- `App.tsx`: Consumer usage
- Commit `50b2f40`: Initial extraction
- Commit `bbba4f4`: Sync fixes
