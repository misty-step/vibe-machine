import { VibeSettings, Track } from '../types';
import init, { VibeEngine } from '../vibe-engine-wasm';

// Initialize WASM immediately (top-level await supported by Vite plugin)
await init();

export class VisualizerCore {
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D | null;

  constructor() {
    this.engine = VibeEngine.new(100, 100); 
    this.memory = (init as any).memory || (window as any).wasmMemory; 
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
        this.engine.render(settings, frequencyData, elapsedTime);
    } catch (e) {
        console.error("WASM Render Error:", e);
        return;
    }

    // 4. Composite Rust Output
    const ptr = this.engine.get_pixel_ptr();
    const wasmMemory = (init as any).memory; 
    const pixelCount = width * height;
    const pixelBytes = pixelCount * 4;
    const pixels = new Uint8ClampedArray(wasmMemory.buffer, ptr, pixelBytes);
    
    if (this.overlayCtx) {
        const data = new ImageData(pixels, width, height);
        this.overlayCtx.putImageData(data, 0, 0);
        ctx.drawImage(this.overlayCanvas, 0, 0);
    }
  }
}
