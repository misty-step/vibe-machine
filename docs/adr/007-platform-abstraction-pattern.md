# ADR 007: Platform Abstraction for Web/Tauri Dual-Mode

**Date**: 2024-12
**Status**: Accepted

## Context

The app must run in two contexts:

1. **Web browser**: Preview via `pnpm dev`, no native features
2. **Tauri desktop**: Full features including export

Naively importing `@tauri-apps/api` at top level crashes the web build because Tauri globals don't exist.

## Decision

Create `platform/tauriEnv.ts` that:

1. Detects runtime environment via global checks
2. Provides async dynamic imports for Tauri APIs
3. Keeps web preview functional by isolating Tauri dependencies

## Rationale

1. **Web preview survives**: Developers can iterate on UI without building Tauri. CI can run web tests.

2. **Dynamic imports**: `await import("@tauri-apps/plugin-dialog")` only loads when called, not at module initialization. Tree-shaking removes unused Tauri code from web builds.

3. **Single detection function**: `isTauri()` checks for `__TAURI_INTERNALS__` (v2) or `__TAURI__` (v1 compat). All feature gates use this.

4. **Graceful degradation**: Export button shows "requires desktop app" in web mode. No crashes, clear UX.

## Alternatives Considered

- **Build-time code splitting**: `#ifdef`-style conditional compilation. Vite supports this but complicates builds.
- **Separate web/desktop apps**: Duplicates UI code. Defeats purpose of hybrid approach.
- **Try/catch all Tauri calls**: Messy, hard to reason about failure modes.

## Consequences

- All Tauri API usage must go through `platform/tauriEnv.ts` helpers
- Async/await required for Tauri calls (dynamic imports are async)
- Feature detection at runtime, not build time
- `ExportController.isSupported()` cleanly gates export functionality

## Implementation

```typescript
// Detection
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

// Dynamic import pattern
export async function tauriDialogs() {
  const { open, save } = await import("@tauri-apps/plugin-dialog");
  return { open, save };
}

// Usage in ExportController
if (!isTauri()) {
  setExportState(false, 0, "Export requires desktop app");
  return;
}
const dialogs = await tauriDialogs();
const path = await dialogs.save({ filters: [...] });
```

## References

- `platform/tauriEnv.ts`: Platform abstraction
- `export/ExportController.ts`: Feature gating example
- `engine/AudioSystem.ts`: Conditional file src conversion
