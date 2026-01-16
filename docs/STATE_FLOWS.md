# State Flows

Mermaid diagrams for complex stateful components. Generated from code audit 2026-01-16.

## Export Pipeline

The export flow is the most complex state machine in the app. It involves:

- Multi-step user dialogs (output path, optional audio path)
- IPC to Rust backend
- Progress events via Tauri event system
- Error recovery
- Auto-reset after completion

```mermaid
stateDiagram-v2
    [*] --> Idle: app start

    Idle --> GuardPlatform: startExport()

    GuardPlatform --> Idle: not Tauri (web mode)
    GuardPlatform --> GuardConcurrency: isTauri()

    GuardConcurrency --> Idle: already exporting
    GuardConcurrency --> GuardTrack: not exporting

    GuardTrack --> Idle: no tracks (show hint)
    GuardTrack --> OutputDialog: has tracks

    OutputDialog --> Idle: user cancelled
    OutputDialog --> ResolveAudio: path selected

    ResolveAudio --> AudioDialog: no sourcePath on track
    ResolveAudio --> Rendering: has sourcePath

    AudioDialog --> Idle: user cancelled
    AudioDialog --> Rendering: audio file picked

    Rendering --> Progress: IPC success
    Progress --> Progress: export-progress events (0-99%)
    Progress --> Complete: progress = 100%

    Rendering --> Error: IPC throws
    Progress --> Error: ffmpeg exits non-zero

    Complete --> Idle: 3s timeout auto-reset
    Error --> Idle: error displayed

    note right of Rendering
        Rust side: decode audio,
        render frames, pipe to FFmpeg
    end note
```

### Key Files

- `/export/ExportController.ts` - State orchestrator
- `/store/vibeStore.ts` - State storage (isExporting, exportProgress, exportStatus)
- `/src-tauri/src/export_video.rs` - Rust backend

### Race Condition Notes

- `attachProgressListener()` guards against stale events with `if (!isExporting) return`
- Progress listener uses `setTimeout` for auto-reset, checks `exportProgress >= 100` to prevent double-reset

---

## Audio Playback

AudioSystem is a singleton managing Web Audio API state. Has multiple initialization states and reacts to store changes.

```mermaid
stateDiagram-v2
    [*] --> Uninitialized: getInstance()

    Uninitialized --> ContextCreated: initContext() on first play/unlock

    state ContextCreated {
        [*] --> Suspended: AudioContext starts suspended
        Suspended --> Running: context.resume() on user gesture
        Running --> Suspended: browser may suspend (tab hidden)
    }

    ContextCreated --> GraphConnected: source -> analyser -> gain -> destination

    state GraphConnected {
        [*] --> NoTrack
        NoTrack --> Loading: currentTrackId changes
        Loading --> Ready: audio.load() + canplay
        Loading --> Error: audio error event
        Ready --> Playing: isPlaying=true in store
        Playing --> Paused: isPlaying=false in store
        Paused --> Playing: isPlaying=true
        Playing --> Ended: track finishes
        Ended --> Loading: selectNextTrack()
        Ended --> NoTrack: no next track
    }
```

### Key Files

- `/engine/AudioSystem.ts` - Singleton class
- `/store/vibeStore.ts` - Reactive state (isPlaying, currentTrackId)
- `/hooks/useVibeEngine.ts` - React adapter

### Store Subscriptions

AudioSystem subscribes to two store slices:

1. `currentTrackId` - triggers `loadTrack()`
2. `isPlaying` - triggers `play()` or `pause()`

---

## Track Loading

Platform-aware track loading with two paths: web (File objects + blob URLs) and Tauri (file paths + convertFileSrc).

```mermaid
flowchart TB
    subgraph Input
        A[User Action] --> B{Platform?}
    end

    subgraph Web Path
        B -->|Browser| C[input type=file]
        C --> D[File object]
        D --> E[URL.createObjectURL]
        E --> F[HTMLAudioElement.src = blob URL]
    end

    subgraph Tauri Path
        B -->|Desktop| G[dialog.open]
        G --> H[Absolute file path]
        H --> I[convertFileSrc]
        I --> J[HTMLAudioElement.src = asset URL]
    end

    subgraph Track Creation
        D --> K[getAudioDuration via Audio element]
        H --> L[getAudioDurationFromUrl via Audio element]
        K --> M[Track object: id, file, name, artist, duration]
        L --> N[Track object: id, sourcePath, name, artist, duration]
    end

    subgraph Store
        M --> O[addTracks]
        N --> O
        O --> P{wasEmpty?}
        P -->|yes| Q[selectTrack first]
        P -->|no| R[tracks added]
    end
```

### Key Files

- `/hooks/useVibeEngine.ts` - `addTracks()` and `addTracksFromPaths()`
- `/platform/tauriEnv.ts` - Platform detection and Tauri imports
- `/utils.ts` - `getAudioDuration()`, `getAudioDurationFromUrl()`

---

## Store State Map

For completeness, here's the vibeStore state structure (simple, no complex state machine needed):

| Slice                 | Type             | Description                                    |
| --------------------- | ---------------- | ---------------------------------------------- |
| `settings`            | `VibeSettings`   | Persisted to Tauri store, auto-saves on change |
| `playlist`            | `Track[]`        | In-memory track list                           |
| `currentTrackId`      | `string \| null` | Selected track ID                              |
| `isPlaying`           | `boolean`        | Playback state (drives AudioSystem)            |
| `currentTime`         | `number`         | Updated by AudioSystem timeupdate event        |
| `duration`            | `number`         | Updated by AudioSystem durationchange event    |
| `backgroundImage`     | `string \| null` | Object URL for preview                         |
| `backgroundImagePath` | `string \| null` | Absolute path for export (desktop)             |
| `isExporting`         | `boolean`        | Export in progress                             |
| `exportProgress`      | `number`         | 0-100                                          |
| `exportStatus`        | `string`         | Status message                                 |
