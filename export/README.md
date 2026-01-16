# export/

Export controller. Owns the UX flow for video export.

## Interface

```typescript
import { exportController } from "./ExportController";

exportController.isSupported(); // Platform check
exportController.attachProgressListener(); // Returns cleanup fn
exportController.startExport(); // Triggers flow
```

## Hidden Complexity

- Save dialog + audio source dialog (if needed)
- Path normalization for cross-platform
- Text overlay pre-rendering to PNG (fonts must be loaded)
- IPC param serialization (camelCase -> snake_case)
- Progress state management with auto-reset
- Concurrency guard (single export at a time)

## Files

- `ExportController.ts` - Flow orchestration
- `renderTextOverlay.ts` - Canvas-based text-to-PNG for native render
