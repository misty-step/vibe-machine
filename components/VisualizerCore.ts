import { VibeSettings, Track, FontFamily, FontSize } from '../types';
import init, { VibeEngine } from '../src/vibe-engine-wasm';

// Initialize WASM once; capture exports for memory access.
const wasmExports = await init();

export class VisualizerCore {
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private imageData?: ImageData;
  private engine: VibeEngine;

  constructor() {
    this.engine = VibeEngine.new(100, 100);
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCtx = this.overlayCanvas.getContext('2d', { willReadFrequently: true });
  }

  public render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    settings: VibeSettings,
    frequencyData: Uint8Array,
    backgroundImage: CanvasImageSource | null,
    currentTrack: Track | null,
    currentTime: number,
    duration: number,
    isPlaying: boolean,
    elapsedTime: number 
  ) {
    // 1. Resize if needed
    if (this.width !== width || this.height !== height) {
        this.width = width;
        this.height = height;
        this.engine.resize(width, height);
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
        this.imageData = new ImageData(width, height);
    }

    // 2. Draw Background (JS)
    ctx.fillStyle = '#030304';
    ctx.fillRect(0, 0, width, height);

    if (backgroundImage) {
        ctx.save();
        let scale = 1;
        let tx = 0, ty = 0;
        
        if (settings.kenBurns && isPlaying) {
            const t = (elapsedTime * 1000) / 20000; 
            scale = 1.05 + Math.sin(t) * 0.02;
            tx = Math.cos(t * 0.5) * 15; 
            ty = Math.sin(t * 0.3) * 15;
        }

        const img = backgroundImage as any;
        const imgWidth = img.videoWidth || img.width || width;
        const imgHeight = img.videoHeight || img.height || height;

        const r = width / height;
        const ir = imgWidth / imgHeight;
        let dw, dh;
        if (ir > r) { dh = height; dw = height * ir; } 
        else { dw = width; dh = width / ir; }

        ctx.translate(width/2 + tx, height/2 + ty);
        ctx.scale(scale, scale);
        try {
            ctx.drawImage(backgroundImage, -dw/2, -dh/2, dw, dh);
        } catch (e) {
            console.warn("BG Draw failed", e);
        }
        ctx.restore();

        // Vignette
        const gradientHeight = height * 0.5;
        const grad = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
        grad.addColorStop(0, 'rgba(3,3,4,0)');
        grad.addColorStop(0.8, 'rgba(3,3,4,0.8)');
        grad.addColorStop(1, 'rgba(3,3,4,0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height - gradientHeight, width, gradientHeight);
    }

    // 3. Render Bars (Rust)
    try {
        const wasmSettings = this.mapSettings(settings);
        this.engine.render(wasmSettings, frequencyData, elapsedTime);
    } catch (e) {
        console.error("WASM Render Error:", e);
        return;
    }

    // 4. Composite Rust Output
    const ptr = this.engine.get_pixel_ptr();
    const wasmMemory = (wasmExports as any).memory as WebAssembly.Memory;
    if (!wasmMemory) {
        console.error("WASM memory unavailable");
        return;
    }
    const pixelCount = width * height;
    const pixelBytes = pixelCount * 4;
    const pixels = new Uint8ClampedArray(wasmMemory.buffer, ptr, pixelBytes);
    
    if (this.overlayCtx) {
        const data = new ImageData(pixels, width, height);
        this.overlayCtx.putImageData(data, 0, 0);
        ctx.drawImage(this.overlayCanvas, 0, 0);
    }

    // 5. Overlay: title + progress (JS layer keeps Rust core pure)
    this.drawOverlays(ctx, settings, currentTrack, currentTime, duration);
  }

  private mapSettings(settings: VibeSettings) {
    // Pull complexity down: adapt camelCase TS settings to WASM snake_case
    return {
      visualizer_mode: settings.visualizerMode,
      visualizer_color: settings.visualizerColor,
      visualizer_intensity: settings.visualizerIntensity,
    };
  }

  private drawOverlays(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    settings: VibeSettings,
    currentTrack: Track | null,
    currentTime: number,
    duration: number
  ) {
    const padding = 32;
    const barHeight = 8;
    const titleFontSize = this.mapFontSize(settings.fontSize);
    ctx.save();
    ctx.textBaseline = 'top';
    const title = currentTrack?.name || 'Untitled';
    const artist = currentTrack?.artist || '';

    // Title + Artist positioning (aligned with visualizer bars baseline)
    if (settings.showTitle) {
      const barsBaseline = this.height - 80; // matches Rust engine origin_y
      const titleArtistGap = 12;
      const artistFontSize = Math.floor(titleFontSize * 0.55);

      // Artist bottom aligns with bars baseline
      const artistY = barsBaseline - artistFontSize;
      // Title sits above artist
      const titleY = artistY - titleArtistGap - titleFontSize;

      ctx.font = `600 ${titleFontSize}px ${this.mapFontFamily(settings.fontFamily)}`;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(title, padding, titleY);

      if (artist) {
        ctx.font = `500 ${artistFontSize}px ${this.mapFontFamily(settings.fontFamily)}`;
        ctx.fillStyle = 'rgba(248,250,252,0.65)';
        ctx.fillText(artist, padding, artistY);
      }
    }

    // Progress bar
    if (settings.showProgress && duration > 0) {
      const pct = Math.min(Math.max(currentTime / duration, 0), 1);
      const barWidth = this.width - padding * 2;
      const y = this.height - padding - barHeight;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(padding, y, barWidth, barHeight);
      ctx.fillStyle = settings.visualizerColor;
      ctx.fillRect(padding, y, barWidth * pct, barHeight);
    }

    ctx.restore();
  }

  private mapFontSize(size: FontSize) {
    switch (size) {
      case FontSize.Small: return 36;
      case FontSize.Medium: return 48;
      case FontSize.Large: return 60;
      case FontSize.ExtraLarge: return 72;
      default: return 48;
    }
  }

  private mapFontFamily(family: FontFamily) {
    // Match loaded fonts; fall back to sans
    switch (family) {
      case FontFamily.Playfair: return 'Playfair Display';
      case FontFamily.Mono: return 'JetBrains Mono';
      case FontFamily.Inter: return 'Inter';
      case FontFamily.RobotoSlab: return 'Roboto Slab';
      case FontFamily.Cinzel: return 'Cinzel';
      case FontFamily.Montserrat: return 'Montserrat';
      case FontFamily.Geist:
      default: return 'Geist Sans, sans-serif';
    }
  }
}
