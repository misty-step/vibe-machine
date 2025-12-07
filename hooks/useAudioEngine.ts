import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Track } from '../types';
import { generateId, getAudioDuration } from '../utils';

export interface AudioEngine {
  // State
  playlist: Track[];
  currentTrackIndex: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Audio Nodes
  analyser: AnalyserNode | null;
  
  // Actions
  addTracks: (files: File[]) => Promise<void>;
  removeTrack: (id: string) => void;
  updateTrackInfo: (id: string, field: 'name' | 'artist', value: string) => void;
  playPause: () => void;
  selectTrack: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  
  // Refs (exposed for advanced usage if needed)
  audioElRef: React.RefObject<HTMLAudioElement | null>;
}

export const useAudioEngine = (): AudioEngine => {
  // --- State ---
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // --- Audio Refs ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Lock to prevent rapid track changes breaking fades
  const isTransitioning = useRef<boolean>(false);

  // --- Audio Initialization ---
  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();

      // Create Nodes
      analyserRef.current = audioContextRef.current.createAnalyser();
      gainNodeRef.current = audioContextRef.current.createGain();

      // Configure
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.9;

      // Initial Gain
      gainNodeRef.current.gain.value = 1.0;
    }
  };

  // --- Actions ---
  const addTracks = async (files: File[]) => {
    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const duration = await getAudioDuration(file);
      newTracks.push({
        id: generateId(),
        file,
        name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
        artist: '',
        duration
      });
    }
    setPlaylist(prev => [...prev, ...newTracks]);
  };

  const removeTrack = (id: string) => {
    setPlaylist(prev => prev.filter(t => t.id !== id));
    // If removing current track, handle index logic? 
    // For simplicity, let's just let the user re-select for now or it might just stop if index out of bounds
  };

  const updateTrackInfo = (id: string, field: 'name' | 'artist', value: string) => {
    setPlaylist(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // Intelligent Track Selection (with Fades)
  const selectTrack = (index: number) => {
    if (index < 0 || index >= playlist.length) return;
    if (index === currentTrackIndex) return;
    if (isTransitioning.current) return;

    if (isPlaying && audioContextRef.current && gainNodeRef.current) {
      // 1. FADE OUT
      isTransitioning.current = true;
      const ctx = audioContextRef.current;
      const gain = gainNodeRef.current;
      const now = ctx.currentTime;

      // Ramp to 0 over 500ms
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);

      // Wait for fade
      setTimeout(() => {
        setCurrentTrackIndex(index);
        // Playback handling is in useEffect
        isTransitioning.current = false;
      }, 550);

    } else {
      // Just switch if paused or not init
      setCurrentTrackIndex(index);
    }
  };

  const playPause = async () => {
    if (!audioContextRef.current) initAudio();
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (audioElRef.current) {
      if (isPlaying) {
        audioElRef.current.pause();
      } else {
        // Ensure volume is up
        if (gainNodeRef.current && audioContextRef.current) {
          gainNodeRef.current.gain.cancelScheduledValues(audioContextRef.current.currentTime);
          gainNodeRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime);
        }
        audioElRef.current.play().catch(e => console.error("Playback error:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    if (currentTrackIndex < playlist.length - 1) {
        selectTrack(currentTrackIndex + 1);
    }
  };

  const prevTrack = () => {
      if (currentTrackIndex > 0) {
          selectTrack(currentTrackIndex - 1);
      }
  };

  // --- Effects ---

  // Connect Audio Element to Web Audio API (Once)
  useEffect(() => {
    if (audioElRef.current && !audioSourceRef.current && audioContextRef.current && analyserRef.current && gainNodeRef.current) {
      try {
        audioSourceRef.current = audioContextRef.current.createMediaElementSource(audioElRef.current);
        // Chain: Source -> Analyser -> Gain -> Destination
        audioSourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioContextRef.current.destination);
      } catch (e) {
        console.warn("Media element source already connected or error", e);
      }
    }
  }, [isPlaying]);

  // Handle Track Source Change
  useEffect(() => {
    if (playlist.length > 0 && audioElRef.current) {
      const track = playlist[currentTrackIndex];
      const url = URL.createObjectURL(track.file);
      
      audioElRef.current.src = url;
      setDuration(track.duration);

      if (isPlaying) {
        audioElRef.current.play().then(() => {
          // 2. FADE IN
          if (audioContextRef.current && gainNodeRef.current) {
            const ctx = audioContextRef.current;
            const gain = gainNodeRef.current;
            const now = ctx.currentTime;

            // Reset to 0 (silence) then ramp up
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(1, now + 0.5);
          }
        });
      }

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [currentTrackIndex, playlist]);

  // Time Update Loop
  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;

    const handleTimeUpdate = () => setCurrentTime(el.currentTime);

    const handleEnded = () => {
      if (currentTrackIndex < playlist.length - 1) {
        // Auto advance: Use a small delay for vibe
        setTimeout(() => {
          selectTrack(currentTrackIndex + 1);
        }, 1000);
      } else {
        setIsPlaying(false);
        setCurrentTrackIndex(0);
      }
    };

    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('ended', handleEnded);
    return () => {
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex, playlist.length]);

  return {
    playlist,
    currentTrackIndex,
    currentTrack: playlist[currentTrackIndex] || null,
    isPlaying,
    currentTime,
    duration,
    analyser: analyserRef.current,
    addTracks,
    removeTrack,
    updateTrackInfo,
    playPause,
    selectTrack,
    nextTrack,
    prevTrack,
    audioElRef
  };
};
