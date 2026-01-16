# engine/

Web Audio System. Singleton managing the audio pipeline for live preview.

## Interface

```typescript
const audio = AudioSystem.getInstance();
await audio.unlock(); // Call from user gesture
const analyser = audio.getAnalyser(); // FFT source for visualizer
```

## Hidden Complexity

- AudioContext creation/resumption (browser autoplay policy)
- MediaElementSource -> AnalyserNode -> GainNode -> destination chain
- Store subscription for reactive track loading and play/pause
- Tauri vs web file source handling (`convertFileSrc` vs `createObjectURL`)
- Automatic cleanup of object URLs
- Event forwarding (timeupdate, ended, durationchange) to store

## Why Singleton

Web Audio's MediaElementSource can only be created once per HTMLAudioElement.
The singleton ensures the audio graph is built once and reused.
