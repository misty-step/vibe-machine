import * as Mp4Muxer from 'mp4-muxer';
import { Track, VibeSettings } from '../types';
import { VisualizerCore } from './VisualizerCore';
import { AudioTimeline } from './AudioTimeline';

interface RenderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate: number; // bps
}

export class VideoRenderer {
  private core: VisualizerCore;

  constructor() {
    this.core = new VisualizerCore();
  }

  private async loadImage(url: string): Promise<ImageBitmap> {
      const response = await fetch(url);
      const blob = await response.blob();
      return await createImageBitmap(blob);
  }

  public async renderProject(
    playlist: Track[],
    settings: VibeSettings,
    backgroundImageUrl: string | null,
    options: RenderOptions,
    onProgress: (progress: number, status: string) => void
  ): Promise<Blob> {
    if (playlist.length === 0) throw new Error("Playlist is empty");

    onProgress(0.01, "Initializing Timeline...");
    const timeline = new AudioTimeline(playlist);
    const totalDuration = timeline.getTotalDuration();
    const sampleRate = 44100;
    
    // 1. Setup Muxer & Encoders
    onProgress(0.05, "Configuring Encoders...");
    
    const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
            codec: 'avc', 
            width: options.width,
            height: options.height
        },
        audio: {
            codec: 'aac',
            numberOfChannels: 2,
            sampleRate: sampleRate
        },
        fastStart: 'in-memory'
    });

    const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error("Video Encoder Error", e)
    });

    const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => console.error("Audio Encoder Error", e)
    });

    videoEncoder.configure({
        codec: 'avc1.4d002a', // H.264 High Profile
        width: options.width,
        height: options.height,
        bitrate: options.bitrate,
        framerate: options.fps
    });

    audioEncoder.configure({
        codec: 'mp4a.40.2', // AAC LC
        numberOfChannels: 2,
        sampleRate: sampleRate,
        bitrate: 128000
    });

    // 2. Load Resources
    let bgBitmap: ImageBitmap | null = null;
    if (backgroundImageUrl) {
        try {
            bgBitmap = await this.loadImage(backgroundImageUrl);
        } catch (e) {
            console.warn("Failed to load background image for export", e);
        }
    }

    const canvas = new OffscreenCanvas(options.width, options.height);
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

    // 3. Segmented Rendering Loop
    const CHUNK_DURATION = 5.0; // seconds per chunk
    let currentTime = 0;

    // We need a temporary AudioContext just for decoding (passed to timeline)
    // We can reuse one or create new ones. Since we want to keep memory low, 
    // creating one here and keeping it is fine as long as we don't accumulate buffers on it (Timeline handles that).
    const decodeCtx = new AudioContext();

    try {
        while (currentTime < totalDuration) {
            const chunkEndTime = Math.min(currentTime + CHUNK_DURATION, totalDuration);
            const chunkDuration = chunkEndTime - currentTime;
            
            const pct = 0.1 + (0.9 * (currentTime / totalDuration));
            onProgress(pct, `Rendering ${Math.round(currentTime)}s / ${Math.round(totalDuration)}s`);

            // A. Prepare Audio for this Chunk (Decode on demand)
            await timeline.prepare(decodeCtx, currentTime, chunkDuration);
            const activeSources = timeline.getActiveSources(currentTime, chunkDuration);

            // B. Setup Offline Graph for Processing
            const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * chunkDuration), sampleRate);
            const masterGain = offlineCtx.createGain();
            masterGain.connect(offlineCtx.destination);
            
            const analyser = offlineCtx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.9;
            masterGain.connect(analyser);

            // C. Schedule Sources
            activeSources.forEach(({ buffer, startTime }) => {
                const source = offlineCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(masterGain);

                let startInCtx = startTime - currentTime;
                let offsetInBuffer = 0;

                if (startInCtx < 0) {
                    offsetInBuffer = -startInCtx;
                    startInCtx = 0;
                }
                
                source.start(startInCtx, offsetInBuffer);
            });

            // D. Pre-compute FFT
            const fps = options.fps;
            const framesInChunk = Math.ceil(chunkDuration * fps);
            const frameInterval = 1 / fps;
            const chunkFftSnapshots: Uint8Array[] = new Array(framesInChunk);

            for (let i = 0; i < framesInChunk; i++) {
                const t = i * frameInterval;
                if (t < chunkDuration) {
                    offlineCtx.suspend(t).then(() => {
                        const data = new Uint8Array(analyser.frequencyBinCount);
                        analyser.getByteFrequencyData(data);
                        chunkFftSnapshots[i] = data;
                    }).then(() => offlineCtx.resume());
                }
            }

            // E. Render Audio
            const renderedBuffer = await offlineCtx.startRendering();

            // F. Encode Audio Chunk
            const numberOfChannels = renderedBuffer.numberOfChannels;
            const length = renderedBuffer.length;
            const planarBuffer = new Float32Array(length * numberOfChannels);
            for (let c = 0; c < numberOfChannels; c++) {
                const channelData = renderedBuffer.getChannelData(c);
                planarBuffer.set(channelData, c * length);
            }

            const audioData = new AudioData({
                format: 'f32-planar',
                sampleRate: sampleRate,
                numberOfFrames: length,
                numberOfChannels: numberOfChannels,
                timestamp: currentTime * 1_000_000,
                data: planarBuffer
            });

            audioEncoder.encode(audioData);
            audioData.close();

            // G. Render & Encode Video Frames
            for (let i = 0; i < framesInChunk; i++) {
                if (videoEncoder.encodeQueueSize > 5) {
                    await videoEncoder.flush();
                }

                const tInChunk = i * frameInterval;
                const absoluteTime = currentTime + tInChunk;
                
                if (absoluteTime >= totalDuration) break;

                const timestampMicroseconds = absoluteTime * 1_000_000;

                // Get Track Metadata for Visuals
                const trackInfo = timeline.getTrackAtTime(absoluteTime);
                const track = trackInfo ? trackInfo.track : null;
                const trackTime = trackInfo ? absoluteTime - trackInfo.startTime : 0;

                this.core.render(
                    ctx,
                    options.width,
                    options.height,
                    settings,
                    chunkFftSnapshots[i] || new Uint8Array(analyser.frequencyBinCount),
                    bgBitmap,
                    track,
                    trackTime,
                    track ? track.duration : 0,
                    true,
                    absoluteTime
                );

                const frame = new VideoFrame(canvas, { timestamp: timestampMicroseconds });
                const isKeyFrame = (Math.round(absoluteTime * fps) % (fps * 2)) === 0;
                
                videoEncoder.encode(frame, { keyFrame: isKeyFrame });
                frame.close();
            }

            currentTime += chunkDuration;
            await new Promise(r => setTimeout(r, 0)); // Breath
        }
    } finally {
        decodeCtx.close();
    }

    await videoEncoder.flush();
    await audioEncoder.flush();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    return new Blob([buffer], { type: 'video/mp4' });
  }
}