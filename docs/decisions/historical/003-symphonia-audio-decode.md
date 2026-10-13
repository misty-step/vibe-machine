# ADR 003: Symphonia for Audio Decoding

**Date**: 2024-12 (Commit `ab516f3`)
**Status**: Accepted

## Context

Export pipeline must decode audio files to raw samples for FFT analysis. Web Audio API is not available in headless Rust context.

Requirements:

- Decode MP3, WAV, FLAC, M4A/AAC, OGG
- Pure Rust (no system dependencies, cross-platform)
- Streaming decode (don't load entire file into memory)

## Decision

Use **Symphonia** (`symphonia = "0.5"` with `features = ["all"]`).

## Rationale

1. **Pure Rust**: No libavcodec/FFmpeg dependency for decode. Simplifies build matrix and licensing.

2. **Comprehensive codec support**: Single crate handles MP3, FLAC, WAV, OGG Vorbis, AAC. Matches Web Audio API's typical format support.

3. **Streaming API**: `format.next_packet()` + `decoder.decode()` pattern processes audio in chunks without loading entire files. Essential for long tracks.

4. **Active maintenance**: Symphonia is the de facto Rust audio decode library, used by Spotify's librespot and other production projects.

## Alternatives Considered

- **FFmpeg for decode**: Would simplify to one binary, but adds complexity for just decoding. Symphonia is lighter.
- **rodio**: Higher-level playback library. We need raw samples, not playback.
- **audrey**: Abandoned, limited format support.
- **minimp3-rs + separate decoders**: Fragmented dependencies, inconsistent APIs.

## Consequences

- Adds ~2MB to native binary (codec implementations)
- Build time increases (pure Rust codecs are slow to compile)
- Some edge-case formats may not decode (rare codecs, DRM content)
- Sample rate handling required (Symphonia reports actual rate, must match FFT expectations)

## Implementation Pattern

```rust
// Setup
let mss = MediaSourceStream::new(Box::new(file), Default::default());
let probed = symphonia::default::get_probe().format(&hint, mss, ...)?;
let mut format = probed.format;
let mut decoder = symphonia::default::get_codecs().make(&track.codec_params, ...)?;

// Streaming decode loop
while let Ok(packet) = format.next_packet() {
    let decoded = decoder.decode(&packet)?;
    let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
    sample_buf.copy_interleaved_ref(decoded);
    // Mono-mix samples for FFT...
}
```

## References

- `src-tauri/src/export_video.rs`: Decode implementation
- `src-tauri/Cargo.toml`: Symphonia dependency
- Commit `ab516f3`: Export pipeline implementation
