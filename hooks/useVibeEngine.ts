import { useEffect } from "react";
import { AudioSystem } from "../engine/AudioSystem";
import { useVibeStore } from "../store/vibeStore";

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
    duration,
  } = useVibeStore();

  // Ensure AudioSystem is initialized
  useEffect(() => {
    AudioSystem.getInstance();
  }, []);

  // Legacy Adapter for App.tsx
  // We simulate the old hook's return signature to make the refactor easier
  return {
    playlist,
    currentTrackIndex: playlist.findIndex((t) => t.id === currentTrackId),
    currentTrack: playlist.find((t) => t.id === currentTrackId) || null,
    isPlaying,
    currentTime,
    duration,
    analyser: AudioSystem.getInstance().getAnalyser(),
    addTracks: async (files: File[]) => {
      // Convert File[] to Track[] logic is needed here or in store
      const { generateId, getAudioDuration } = await import("../utils");
      const tracks = [];
      for (const file of files) {
        const duration = await getAudioDuration(file);
        const sourcePath =
          typeof (file as { path?: unknown }).path === "string"
            ? String((file as { path?: string }).path)
            : undefined;
        tracks.push({
          id: generateId(),
          file,
          sourcePath,
          name: file.name.replace(/\.[^/.]+$/, ""),
          artist: "",
          duration,
        });
      }

      const wasEmpty = useVibeStore.getState().playlist.length === 0;
      addTracks(tracks);

      if (wasEmpty && tracks.length > 0) {
        selectTrack(tracks[0].id);
      }
    },
    addTracksFromPaths: async (paths: string[]) => {
      const { generateId, getAudioDurationFromUrl } = await import("../utils");
      const { tauriConvertFileSrc } = await import("../platform/tauriEnv");
      const convertFileSrc = await tauriConvertFileSrc();
      const tracks = [];
      for (const path of paths) {
        const url = convertFileSrc(path);
        const duration = await getAudioDurationFromUrl(url);
        const name = path.split(/[\\/]/).pop() ?? "Untitled";
        tracks.push({
          id: generateId(),
          sourcePath: path,
          name: name.replace(/\.[^/.]+$/, ""),
          artist: "",
          duration,
        });
      }

      const wasEmpty = useVibeStore.getState().playlist.length === 0;
      addTracks(tracks);

      if (wasEmpty && tracks.length > 0) {
        selectTrack(tracks[0].id);
      }
    },
    removeTrack,
    updateTrackInfo,
    playPause: () => useVibeStore.getState().setIsPlaying(!isPlaying),
    selectTrack: (idx: number) => selectTrack(playlist[idx]?.id || null),
    nextTrack: selectNextTrack,
    prevTrack: selectPrevTrack,
  };
};
