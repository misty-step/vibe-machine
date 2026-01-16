# ADR 009: AudioSystem Singleton Pattern

**Date**: 2024-12
**Status**: Accepted

## Context

Web Audio API has constraints:

- `AudioContext` must be created from user gesture (autoplay policy)
- `MediaElementAudioSourceNode` can only be created once per `<audio>` element
- Context state (suspended/running) must be managed
- Playback state must sync with store

Multiple React component instances would create conflicting audio contexts.

## Decision

Implement `AudioSystem` as a **singleton class** that:

1. Owns the single `AudioContext`, `AnalyserNode`, and `HTMLAudioElement`
2. Subscribes to Zustand store for track/play state changes
3. Exposes `AnalyserNode` for visualization
4. Handles all audio lifecycle internally

## Rationale

1. **Single audio context**: Browser limits contexts. Singleton guarantees one.

2. **Decoupled from React**: Audio continues during re-renders. No cleanup/recreate cycles.

3. **Store-driven playback**: `isPlaying` in store is authoritative. `AudioSystem` subscribes and reacts. No imperative `audio.play()` calls scattered in components.

4. **Analyser access**: `VisualizerCore` needs `AnalyserNode` for FFT data. Singleton provides stable reference.

5. **Context unlock**: `unlock()` method called from first user interaction. Handles Safari's aggressive autoplay blocking.

## Alternatives Considered

- **Hook with useRef**: Re-creates on hot reload. Can't share analyser across components easily.
- **React Context**: Would couple audio lifecycle to React tree. Unmount = audio stops.
- **Global variables**: No encapsulation. Singleton provides controlled access.

## Consequences

- Audio state lives outside React - debugging requires console logs
- Hot reload doesn't reset audio state (feature, not bug)
- Must explicitly call `AudioSystem.getInstance()` to initialize
- Track changes trigger `loadTrack()` via subscription, not prop changes
- `crossOrigin = "anonymous"` required for CORS audio (Tauri's `asset://` protocol)

## Implementation Pattern

```typescript
export class AudioSystem {
  private static instance: AudioSystem | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioEl: HTMLAudioElement;

  private constructor() {
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = "anonymous";

    // Subscribe to store changes
    useVibeStore.subscribe(
      (state) => state.currentTrackId,
      (newId, oldId) => {
        if (newId !== oldId) void this.loadTrack(newId);
      }
    );

    useVibeStore.subscribe(
      (state) => state.isPlaying,
      (isPlaying) => {
        if (isPlaying) this.play();
        else this.pause();
      }
    );
  }

  public static getInstance(): AudioSystem {
    if (!AudioSystem.instance) {
      AudioSystem.instance = new AudioSystem();
    }
    return AudioSystem.instance;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private async initContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      // ... setup audio graph
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }
}
```

## References

- `engine/AudioSystem.ts`: Implementation
- `hooks/useVibeEngine.ts`: Initialization and analyser access
- `components/Visualizer.tsx`: Consumes analyser for FFT
