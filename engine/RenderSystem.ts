import { useVibeStore } from '../store/vibeStore';
import { VisualizerCore } from '../components/VisualizerCore';
import { AudioSystem } from './AudioSystem';
import { AspectRatio } from '../types';

export class RenderSystem {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private core: VisualizerCore;
  private animationFrameId: number | null = null;
  private startTime: number;
  
  // Image Cache
  private currentImageSrc: string | null = null;
  private currentImageElement: HTMLImageElement | null = null;

  constructor() {
    this.core = new VisualizerCore();
    this.startTime = Date.now();
  }

  public attachCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.startLoop();
  }

  public detachCanvas() {
    this.stopLoop();
    this.canvas = null;
    this.ctx = null;
  }

  private startLoop() {
    if (!this.animationFrameId) {
        this.loop();
    }
  }

  private stopLoop() {
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }
  }

  private loop = () => {
    if (!this.canvas || !this.ctx) return;

    const state = useVibeStore.getState();
    const audioSys = AudioSystem.getInstance();
    const analyser = audioSys.getAnalyser();

    // 1. Resize Logic
    let width = 1920;
    let height = 1080;
    if (state.settings.aspectRatio === AspectRatio.OneOne) { width = 1080; height = 1080; }
    else if (state.settings.aspectRatio === AspectRatio.NineSixteen) { width = 1080; height = 1920; }

    if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    // 2. Image Loading Logic
    if (state.backgroundImage !== this.currentImageSrc) {
        this.currentImageSrc = state.backgroundImage;
        if (this.currentImageSrc) {
            const img = new Image();
            img.src = this.currentImageSrc;
            img.onload = () => { this.currentImageElement = img; };
        } else {
            this.currentImageElement = null;
        }
    }

    // 3. Audio Data
    let frequencyData = new Uint8Array(0);
    if (analyser) {
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
    }

    // 4. Render
    const elapsedTime = (Date.now() - this.startTime) / 1000;
    const currentTrack = state.playlist.find(t => t.id === state.currentTrackId) || null;

    try {
        this.core.render(
            this.ctx,
            width,
            height,
            state.settings,
            frequencyData,
            this.currentImageElement,
            currentTrack,
            state.currentTime,
            state.duration,
            state.isPlaying,
            elapsedTime
        );
    } catch (e) {
        console.error("RenderSystem Crash:", e);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}
