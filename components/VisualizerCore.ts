import { VibeSettings, Track, AspectRatio } from '../types';

// Physics Constants
const ATTACK = 0.6;
const DECAY = 0.12;

export class VisualizerCore {
  private physicsState: Float32Array;
  
  constructor() {
    this.physicsState = new Float32Array(64).fill(0);
  }

  // Pure logic to update physics state based on audio data
  private updatePhysics(frequencyData: Uint8Array) {
    const state = this.physicsState;
    const barCount = 32;

    for (let i = 0; i < barCount; i++) {
        let target = 0;
        
        // Logarithmic Mapping
        const freqIndex = Math.floor(Math.pow(1.18, i + 5));
        // Average 2 bins for stability
        const v1 = frequencyData[freqIndex] || 0;
        const v2 = frequencyData[freqIndex+1] || 0;
        target = ((v1 + v2) / 2) / 255.0;
        
        // High Energy Boost
        target = target * 1.3;

        // Physics: Attack / Decay
        const alpha = target > state[i] ? ATTACK : DECAY;
        state[i] = state[i] + (target - state[i]) * alpha;
    }
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
    elapsedTime: number // Seconds since playback started
  ) {
    // Update physics first
    this.updatePhysics(frequencyData);

    // 1. Draw Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    if (backgroundImage) {
      ctx.save();
      let scale = 1;
      let tx = 0, ty = 0;
      
      if (settings.kenBurns && isPlaying) {
        // Deterministic time for effect
        const t = (elapsedTime * 1000) / 20000; 
        scale = 1.05 + Math.sin(t) * 0.02;
        tx = Math.cos(t * 0.5) * 15; 
        ty = Math.sin(t * 0.3) * 15;
      }

      const img = backgroundImage;
      // Handle width/height access for different source types
      const imgWidth = 'width' in img ? (img.width as number) : (img as any).videoWidth || width;
      const imgHeight = 'height' in img ? (img.height as number) : (img as any).videoHeight || height;


      const r = width / height;
      const ir = imgWidth / imgHeight;
      let dw, dh;
      if (ir > r) { dh = height; dw = height * ir; } 
      else { dw = width; dh = width / ir; }

      ctx.translate(width/2 + tx, height/2 + ty);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
      ctx.restore();

      // Gradient Overlay
      const gradientHeight = height * 0.5;
      const grad = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.4, 'rgba(0,0,0,0.2)');
      grad.addColorStop(0.8, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0.95)');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - gradientHeight, width, gradientHeight);

    } else {
        const g = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
        g.addColorStop(0, '#27272a');
        g.addColorStop(1, '#000000');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Render Visualization (Bars)
    ctx.strokeStyle = settings.visualizerColor;
    ctx.fillStyle = settings.visualizerColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 25;
    ctx.shadowColor = settings.visualizerColor;

    const padding = 80;
    const vizWidth = 600; 
    const originX = width - padding - vizWidth;
    const originY = height - padding;
    
    const visibleBars = 12; 
    const barW = 24; 
    const gap = 12; 
    const maxH = 200 * settings.visualizerIntensity;
    const state = this.physicsState;

    // Align to Bottom Right
    for (let i = 0; i < visibleBars; i++) {
        const idx = i * 2; 
        const val = state[idx];
        
        let h = Math.max(12, Math.pow(val, 1.4) * maxH);

        const x = (originX + vizWidth) - ((visibleBars - i) * (barW + gap));
        const y = originY;

        ctx.beginPath();
        ctx.roundRect(x, y - h, barW, h, 10);
        ctx.fill();
    }

    // 3. Overlays (Text)
    ctx.shadowBlur = 0;
    
    if (currentTrack && settings.showTitle) {
        const textX = padding; 
        const textY = height - padding;
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        
        const fontName = settings.fontFamily || 'Geist Sans';
        const fallback = fontName.includes('Playfair') ? 'serif' : 'sans-serif';
        const scale = settings.fontSize || 1.0;

        const titleSize = 48 * scale;
        const artistSize = 32 * scale;
        const spacing = 15 * scale;

        // Title
        ctx.font = `700 ${titleSize}px "${fontName}", ${fallback}`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(currentTrack.name, textX, textY - artistSize - spacing);
        
        // Artist
        ctx.font = `500 ${artistSize}px "${fontName}", ${fallback}`;
        ctx.fillStyle = '#d4d4d8';
        ctx.fillText(currentTrack.artist || 'Unknown Artist', textX, textY);
    }
    
    // 4. Progress Bar
    if (settings.showProgress && duration > 0) {
        const barHeight = 4;
        const progress = currentTime / duration;
        const totalWidth = width - (padding * 2);
        
        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(padding, height - padding + 20, totalWidth, barHeight);
        
        // Fill
        ctx.fillStyle = settings.visualizerColor;
        ctx.shadowColor = settings.visualizerColor;
        ctx.shadowBlur = 10;
        ctx.fillRect(padding, height - padding + 20, totalWidth * progress, barHeight);
        
        // Reset Shadow
        ctx.shadowBlur = 0;
    }
  }
}
