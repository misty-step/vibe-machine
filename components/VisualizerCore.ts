import { VibeSettings, Track, VisualizerMode } from '../types';

export class VisualizerCore {
  private physicsState: Float32Array;
  private readonly ATTACK = 0.6;
  private readonly DECAY = 0.12;
  
  constructor() {
    this.physicsState = new Float32Array(64).fill(0);
  }

  // Pure logic to update physics state based on audio data
  private updatePhysics = (frequencyData: Uint8Array) => {
    const state = this.physicsState;
    const barCount = 32;

    for (let i = 0; i < barCount; i++) {
        let target = 0;
        
        // Logarithmic Mapping
        // freqIndex logic: exponential scale to match human hearing
        const freqIndex = Math.floor(Math.pow(1.18, i + 5));
        
        // Safety check for frequencyData bounds
        if (freqIndex < frequencyData.length) {
            // Average 2 bins for stability
            const v1 = frequencyData[freqIndex] || 0;
            const v2 = frequencyData[freqIndex+1] || 0;
            target = ((v1 + v2) / 2) / 255.0;
        }
        
        // High Energy Boost
        target = target * 1.3;

        // Physics: Attack / Decay
        const alpha = target > state[i] ? this.ATTACK : this.DECAY;
        state[i] = state[i] + (target - state[i]) * alpha;
    }
  }

  public render = (
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
  ) => {
    // Update physics first
    this.updatePhysics(frequencyData);

    // 1. Draw Background (Void)
    ctx.fillStyle = '#030304'; // Void color from design system
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

      // Use type assertion to access width/height safely on any CanvasImageSource that has them
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
      
      // Draw image centered
      try {
          ctx.drawImage(backgroundImage, -dw/2, -dh/2, dw, dh);
      } catch (e) {
          // Fallback if image is broken/not ready
          console.warn("Image draw failed", e);
      }
      
      ctx.restore();

      // Gradient Overlay (Cinematic vignette)
      const gradientHeight = height * 0.5;
      const grad = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
      grad.addColorStop(0, 'rgba(3,3,4,0)');
      grad.addColorStop(0.4, 'rgba(3,3,4,0.2)');
      grad.addColorStop(0.8, 'rgba(3,3,4,0.8)');
      grad.addColorStop(1, 'rgba(3,3,4,0.95)');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - gradientHeight, width, gradientHeight);

    } else {
        // Fallback Gradient
        const g = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
        g.addColorStop(0, '#27272a'); // Carbon-ish
        g.addColorStop(1, '#030304'); // Void
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    }

    // 2. Render Visualization
    ctx.strokeStyle = settings.visualizerColor;
    ctx.fillStyle = settings.visualizerColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 25;
    ctx.shadowColor = settings.visualizerColor;

    const state = this.physicsState;

    if (settings.visualizerMode === VisualizerMode.Bars) {
        const padding = 80;
        const vizWidth = 600; 
        const originX = width - padding - vizWidth;
        const originY = height - padding;
        
        const visibleBars = 12; 
        const barW = 24; 
        const gap = 12; 
        const maxH = 200 * settings.visualizerIntensity;

        // Align to Bottom Right
        for (let i = 0; i < visibleBars; i++) {
            const idx = i * 2; 
            const val = state[idx];
            
            let h = Math.max(12, Math.pow(val, 1.4) * maxH);

            const x = (originX + vizWidth) - ((visibleBars - i) * (barW + gap));
            const y = originY;

            ctx.beginPath();
            ctx.roundRect(x, y - h, barW, h, 4); // Sharper corners for industrial look
            ctx.fill();
        }
    } else if (settings.visualizerMode === VisualizerMode.Orbital) {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.25;
        const maxBarH = 100 * settings.visualizerIntensity;

        ctx.beginPath();
        for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            const val = state[i];
            const h = Math.max(4, Math.pow(val, 1.2) * maxBarH);
            
            const x1 = cx + Math.cos(angle) * radius;
            const y1 = cy + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(angle) * (radius + h);
            const y2 = cy + Math.sin(angle) * (radius + h);

            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.lineWidth = 6;
        ctx.stroke();

        // Inner Glow
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
        ctx.fillStyle = `${settings.visualizerColor}20`; // Low opacity fill
        ctx.fill();

    } else if (settings.visualizerMode === VisualizerMode.Wave) {
        const centerY = height / 2;
        const startX = 0;
        const step = width / 32;
        const amp = 150 * settings.visualizerIntensity;

        ctx.beginPath();
        ctx.moveTo(startX, centerY);

        for (let i = 0; i < 32; i++) {
            const x = startX + (i * step);
            const val = state[i];
            // Sine wave modulation based on frequency data
            const y = centerY + Math.sin(i * 0.5 + elapsedTime * 2) * (val * amp);
            
            // Smooth curve
            if (i === 0) ctx.moveTo(x, y);
            else {
                const prevX = startX + ((i - 1) * step);
                const prevVal = state[i-1];
                const prevY = centerY + Math.sin((i-1) * 0.5 + elapsedTime * 2) * (prevVal * amp);
                const cpX = (prevX + x) / 2;
                ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
            }
        }
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    // 3. Overlays (Text - Minimalist Metadata)
    ctx.shadowBlur = 0;
    
    if (currentTrack && settings.showTitle) {
        const padding = 80;
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
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText(currentTrack.name, textX, textY - artistSize - spacing);
        
        // Artist
        ctx.font = `500 ${artistSize}px "${fontName}", ${fallback}`;
        ctx.fillStyle = '#d4d4d8';
        ctx.fillText(currentTrack.artist || 'Unknown Artist', textX, textY);
    }
    
    // 4. Progress Bar
    if (settings.showProgress && duration > 0) {
        const padding = 80;
        const barHeight = 4;
        const progress = currentTime / duration;
        const totalWidth = width - (padding * 2);
        
        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
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