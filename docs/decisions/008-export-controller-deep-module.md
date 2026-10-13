# 008: Keep export orchestration out of React components

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** ExportController, vibeStore
- **Powder:** none recorded

## Context

Export combines platform checks, dialogs, source selection, text overlays,
Rust IPC, progress events, and errors. Scattering this logic across App.tsx and
inline handlers caused coupling, testing difficulties, and re-render issues.

## Decision

Keep the export UX flow in the singleton
[ExportController](../../export/ExportController.ts), exposing `isSupported()`,
`attachProgressListener()`, and `startExport()`. Components render UI and call
the controller; do not recreate orchestration in hooks or context providers.

## Consequences

The controller hides dialogs and IPC and updates the store directly. Progress
listeners attach on mount and clean up on unmount; errors surface through store
state. Backend changes stay inside the controller.
Revisit if: export no longer has singleton behavior or needs a workflow the
controller's interface cannot represent.
