import React, { useEffect, useRef } from 'react';
import { AudioSystem } from '../engine/AudioSystem';
import { useVibeStore } from '../store/vibeStore';

export const useVibeEngine = () => {
  const { 
    playlist, 
    currentTrackId, 
    isPlaying,
    addTracks,
    removeTrack,
    updateTrackInfo,
    selectTrack,
    selectNextTrack,
    selectPrevTrack,
    currentTime,
    duration
  } = useVibeStore();

  // Sync Playback Control
  useEffect(() => {
    const engine = AudioSystem.getInstance();
    if (isPlaying) engine.play();
    else engine.pause();
  }, [isPlaying]);

  // Sync Track Selection (Already handled in AudioSystem via store subscription, 
  // but the store state needs to drive the UI)
  
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Legacy Adapter for App.tsx
  // We simulate the old hook's return signature to make the refactor easier
  return {
    playlist,
    currentTrackIndex: playlist.findIndex(t => t.id === currentTrackId),
    currentTrack: playlist.find(t => t.id === currentTrackId) || null,
    isPlaying,
    currentTime,
    duration,
    analyser: AudioSystem.getInstance().getAnalyser(),
    addTracks: async (files: File[]) => {
        // Convert File[] to Track[] logic is needed here or in store
        const { generateId, getAudioDuration } = await import('../utils');
        const tracks = [];
        for (const file of files) {
            const duration = await getAudioDuration(file);
            tracks.push({
                id: generateId(),
                file,
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: '',
                duration
            });
        }
        addTracks(tracks);
    },
    removeTrack,
    updateTrackInfo,
    playPause: () => useVibeStore.getState().setIsPlaying(!isPlaying),
    selectTrack: (idx: number) => selectTrack(playlist[idx]?.id || null),
    nextTrack: selectNextTrack,
    prevTrack: selectPrevTrack,
    audioElRef // This is now vestigial, AudioSystem manages its own element
  };
};
