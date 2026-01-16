# platform/

Tauri isolation layer. Keeps web preview functional by lazy-loading Tauri APIs.

## Interface

```typescript
import { isTauri, tauriDialogs, tauriInvoke, tauriListen } from "./tauriEnv";

if (isTauri()) {
  const dialogs = await tauriDialogs();
  const path = await dialogs.open({ filters: [...] });
}
```

## Why This Exists

Tauri APIs throw if imported outside a Tauri context. This facade:

1. Provides runtime detection (`isTauri()`)
2. Uses dynamic imports to avoid bundling issues
3. Normalizes file paths across platforms

Without this, `pnpm dev` (web-only mode) would fail on import.
