import React, { useRef, useEffect } from 'react';
import { VibeSettings, Track, AspectRatio } from '../types';

interface VisualizerProps {
  settings: VibeSettings;
  backgroundImage: string | null;
  analyser: AnalyserNode | null;
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

// --- Configuration ---
// Physics Constants
const ATTACK = 0.6;  // Slightly faster attack for high energy
const DECAY = 0.12;  // Faster decay to separate beats better

const Visualizer: React.FC<VisualizerProps> = ({
  settings,
  backgroundImage,
  analyser,
  currentTrack,
  currentTime,
  duration,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // State: Track 64 frequency bands for smoothness
  const physicsState = useRef<Float32Array>(new Float32Array(64).fill(0));
  const startTimeRef = useRef<number>(Date.now());

  // Load Image
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => { imageRef.current = img; };
    } else {
      imageRef.current = null;
    }
  }, [backgroundImage]);

  const draw = (timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Setup Dimensions
    let width = 1920;
    let height = 1080;
    if (settings.aspectRatio === AspectRatio.OneOne) { width = 1080; height = 1080; }
    else if (settings.aspectRatio === AspectRatio.NineSixteen) { width = 1080; height = 1920; }
    
    canvas.width = width; 
    canvas.height = height;

    // 2. Draw Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    if (imageRef.current) {
      ctx.save();
      let scale = 1;
      let tx = 0, ty = 0;
      
      if (settings.kenBurns && isPlaying) {
        const t = (Date.now() - startTimeRef.current) / 20000; 
        scale = 1.05 + Math.sin(t) * 0.02;
        tx = Math.cos(t * 0.5) * 15; 
        ty = Math.sin(t * 0.3) * 15;
      }

      const img = imageRef.current;
      const r = width / height;
      const ir = img.width / img.height;
      let dw, dh;
      if (ir > r) { dh = height; dw = height * ir; } 
      else { dw = width; dh = width / ir; }

      ctx.translate(width/2 + tx, height/2 + ty);
      ctx.scale(scale, scale);
      // No filter - Full Color
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
      ctx.restore();

      // Gradient Overlay for Bottom Text readability
      const gradientHeight = height * 0.5; // Bottom 50%
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

    // 3. Audio Processing
    let bufferLen = 0;
    let frequencyData = new Uint8Array(0);
    
    if (analyser) {
        bufferLen = analyser.frequencyBinCount;
        frequencyData = new Uint8Array(bufferLen);
        analyser.getByteFrequencyData(frequencyData);
    }

    // Update Physics
    const state = physicsState.current;
    const barCount = 32; 

    for(let i=0; i<barCount; i++) {
        let target = 0;
        if (analyser) {
            // Logarithmic Mapping
            const freqIndex = Math.floor(Math.pow(1.18, i + 5));
            // Average 2 bins for stability
            const v1 = frequencyData[freqIndex] || 0;
            const v2 = frequencyData[freqIndex+1] || 0;
            target = ((v1 + v2) / 2) / 255.0;
            
            // High Energy Boost: amplify the signal
            target = target * 1.3; 
        }
        
        // Physics: Attack / Decay
        const alpha = target > state[i] ? ATTACK : DECAY;
        state[i] = state[i] + (target - state[i]) * alpha;
    }

    // 4. Render Visualization
    ctx.strokeStyle = settings.visualizerColor;
    ctx.fillStyle = settings.visualizerColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 25;
    ctx.shadowColor = settings.visualizerColor;

    // Common positioning
    const padding = 80;
    const vizWidth = 600; 
    const originX = width - padding - vizWidth;
    const originY = height - padding;
    
    // --- High Energy Bars (Bottom Right) ---
    
    const visibleBars = 12; 
    const barW = 24; 
    const gap = 12; 
    
    // Max height allows for big jumps
    const maxH = 200 * settings.visualizerIntensity;

    // Align to Bottom Right
    for (let i = 0; i < visibleBars; i++) {
        const idx = i * 2; 
        const val = state[idx];
        
        // Non-linear pop
        let h = Math.max(12, Math.pow(val, 1.4) * maxH);

        const x = (originX + vizWidth) - ((visibleBars - i) * (barW + gap));
        const y = originY;

        ctx.beginPath();
        ctx.roundRect(x, y - h, barW, h, 10);
        ctx.fill();
    }

    // 5. Overlays (Bottom Left)
    ctx.shadowBlur = 0;
    
    if (currentTrack && settings.showTitle) {
        const textX = padding; // Left align
        const textY = height - padding;
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        
        const fontName = settings.fontFamily || 'Geist Sans';
        const fallback = fontName.includes('Playfair') ? 'serif' : 'sans-serif';
        const scale = settings.fontSize || 1.0;

        const titleSize = 48 * scale;
        const artistSize = 32 * scale;
        const spacing = 15 * scale; // Space between title and artist

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
    
    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [settings, backgroundImage, analyser, currentTrack, currentTime, duration, isPlaying]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950 overflow-hidden relative shadow-2xl rounded-lg border border-zinc-800">
      <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ maxHeight: '100%', maxWidth: '100%' }} />
    </div>
  );
};

export default Visualizer;
