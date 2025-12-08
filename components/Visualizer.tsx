import React, { useRef, useEffect } from 'react';
import { VibeSettings, Track, AspectRatio } from '../types';
import { VisualizerCore } from './VisualizerCore';

interface VisualizerProps {
  settings: VibeSettings;
  backgroundImage: string | null;
  analyser: AnalyserNode | null;
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

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
  
  // Core Engine Ref
  const coreRef = useRef<VisualizerCore>(new VisualizerCore());
  const startTimeRef = useRef<number>(Date.now());
  
  // Refs to avoid re-renders on prop changes during animation loop
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const isPlayingRef = useRef(isPlaying);
  
  // Update refs when props change
  useEffect(() => {
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    isPlayingRef.current = isPlaying;
  }, [currentTime, duration, isPlaying]);

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
    
    // Resize only if needed to avoid flicker
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; 
        canvas.height = height;
    }

    // 2. Audio Data
    let bufferLen = 0;
    let frequencyData = new Uint8Array(0);
    
    if (analyser) {
        bufferLen = analyser.frequencyBinCount;
        frequencyData = new Uint8Array(bufferLen);
        analyser.getByteFrequencyData(frequencyData);
    }

    // 3. Delegate to Core
    const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
    
    try {
      coreRef.current.render(
          ctx,
          width,
          height,
          settings,
          frequencyData,
          imageRef.current,
          currentTrack,
          currentTimeRef.current,
          durationRef.current,
          isPlayingRef.current,
          elapsedTime
      );
    } catch (e) {
      console.error("Visualizer Render Error:", e);
    }
    
    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [settings, backgroundImage, analyser, currentTrack]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950 overflow-hidden relative shadow-2xl rounded-lg border border-zinc-800">
      <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ maxHeight: '100%', maxWidth: '100%' }} />
    </div>
  );
};

export default Visualizer;