import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { LazyStore } from "@tauri-apps/plugin-store";
import { VibeSettings, VisualizerMode, AspectRatio, FontFamily, FontSize, Track } from "../types";

const settingsStore = new LazyStore("settings.json");

interface VibeState {
  // Initialization
  initialize: () => Promise<void>;

  // Settings
  settings: VibeSettings;
  updateSettings: (partial: Partial<VibeSettings>) => void;

  // Playlist
  playlist: Track[];
  currentTrackId: string | null;
  addTracks: (tracks: Track[]) => void;
  removeTrack: (id: string) => void;
  updateTrackInfo: (id: string, field: keyof Track, value: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
  selectTrack: (id: string | null) => void;
  selectNextTrack: () => void;
  selectPrevTrack: () => void;

  // Playback State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  setIsPlaying: (playing: boolean) => void;
  setTime: (time: number) => void;
  setDuration: (duration: number) => void;

  // Visual Assets
  backgroundImage: string | null; // Object URL
  backgroundImagePath: string | null; // Absolute path (desktop only)
  setBackgroundImage: (url: string | null) => void;
  setBackgroundImagePath: (path: string | null) => void;

  // Export State
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;
  exportSessionId: number; // Prevents stale timeout resets
  setExportState: (isExporting: boolean, progress?: number, status?: string) => void;
  startExportSession: () => number; // Returns new session ID
}

const DEFAULT_SETTINGS: VibeSettings = {
  visualizerMode: VisualizerMode.Bars,
  aspectRatio: AspectRatio.SixteenNine,
  fontFamily: FontFamily.Geist,
  fontSize: FontSize.Medium,
  showTitle: true,
  showProgress: true,
  kenBurns: true,
  blurBackground: false,
  visualizerColor: "#ffb703", // Plasma
  visualizerIntensity: 1.0,
};

export const useVibeStore = create<VibeState>()(
  subscribeWithSelector((set, get) => ({
    // Initialization
    initialize: async () => {
      try {
        const savedSettings = await settingsStore.get<VibeSettings>("settings");
        if (savedSettings) {
          // Merge with default to ensure new keys exist
          set({ settings: { ...DEFAULT_SETTINGS, ...savedSettings } });
        }
      } catch (e) {
        console.warn("Failed to load settings:", e);
      }

      // Auto-save subscription
      useVibeStore.subscribe(
        (state) => state.settings,
        (settings) => {
          settingsStore.set("settings", settings);
          settingsStore.save();
        }
      );
    },

    // Settings
    settings: DEFAULT_SETTINGS,
    updateSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),

    // Playlist
    playlist: [],
    currentTrackId: null,
    addTracks: (newTracks) => set((state) => ({ playlist: [...state.playlist, ...newTracks] })),
    removeTrack: (id) =>
      set((state) => {
        const newPlaylist = state.playlist.filter((t) => t.id !== id);
        // If we removed the current track, reset or move
        const currentId = state.currentTrackId === id ? null : state.currentTrackId;
        return { playlist: newPlaylist, currentTrackId: currentId };
      }),
    updateTrackInfo: (id, field, value) =>
      set((state) => ({
        playlist: state.playlist.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
      })),
    reorderTracks: (fromIndex, toIndex) =>
      set((state) => {
        if (fromIndex === toIndex) return state;
        if (fromIndex < 0 || toIndex < 0) return state;
        if (fromIndex >= state.playlist.length || toIndex >= state.playlist.length) return state;

        const playlist = [...state.playlist];
        const [moved] = playlist.splice(fromIndex, 1);
        if (!moved) return state;
        playlist.splice(toIndex, 0, moved);
        return { playlist };
      }),
    selectTrack: (id) => set({ currentTrackId: id }),
    selectNextTrack: () => {
      const { playlist, currentTrackId } = get();
      if (!currentTrackId || playlist.length === 0) return;
      const idx = playlist.findIndex((t) => t.id === currentTrackId);
      if (idx < playlist.length - 1) {
        set({ currentTrackId: playlist[idx + 1].id });
      }
    },
    selectPrevTrack: () => {
      const { playlist, currentTrackId } = get();
      if (!currentTrackId || playlist.length === 0) return;
      const idx = playlist.findIndex((t) => t.id === currentTrackId);
      if (idx > 0) {
        set({ currentTrackId: playlist[idx - 1].id });
      }
    },

    // Playback
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setTime: (time) => set({ currentTime: time }),
    setDuration: (dur) => set({ duration: dur }),

    // Assets
    backgroundImage: null,
    backgroundImagePath: null,
    setBackgroundImage: (url) => set({ backgroundImage: url }),
    setBackgroundImagePath: (path) => set({ backgroundImagePath: path }),

    // Export
    isExporting: false,
    exportProgress: 0,
    exportStatus: "",
    exportSessionId: 0,
    setExportState: (isExporting, progress = 0, status = "") =>
      set({ isExporting, exportProgress: progress, exportStatus: status }),
    startExportSession: () => {
      const newId = get().exportSessionId + 1;
      set({ isExporting: true, exportProgress: 0, exportStatus: "", exportSessionId: newId });
      return newId;
    },
  }))
);
