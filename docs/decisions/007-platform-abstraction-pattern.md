# 007: Isolate Tauri APIs behind runtime helpers

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** tauriEnv
- **Powder:** none recorded

## Context

The same app supports browser preview and full Tauri desktop features.
Top-level Tauri API imports can crash web mode when Tauri globals are absent.
Separate web and desktop apps would duplicate the UI.

## Decision

Use [tauriEnv](../../platform/tauriEnv.ts) for runtime detection and async dynamic
imports of Tauri APIs. All Tauri API usage goes through these helpers; do not
split the UI into separate apps or scatter try/catch around native calls.

## Consequences

Browser preview remains usable without native features. Native calls require
async/await, and export support is gated through `ExportController.isSupported()`
with a desktop requirement surfaced in web mode.
Revisit if: runtime detection and dynamic imports cannot keep browser preview
functional alongside desktop features.
