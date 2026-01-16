# store/

Zustand store. Single source of truth for app state.

## Interface

```typescript
import { useVibeStore } from "./vibeStore";

const { settings, updateSettings, playlist, isPlaying } = useVibeStore();
```

## State Domains

- **Settings** - Visualizer config, persisted to `settings.json` via Tauri plugin-store
- **Playlist** - Track list with metadata
- **Playback** - isPlaying, currentTime, duration
- **Assets** - Background image URL and path
- **Export** - Progress and status

## Subscriptions

Uses `subscribeWithSelector` for reactive side effects:

- Track change triggers audio reload
- Play/pause state syncs to AudioSystem
- Settings changes auto-persist
