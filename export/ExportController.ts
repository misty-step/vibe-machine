/**
 * ExportController - Deep module owning the export UX flow.
 *
 * Hides: dialogs, path handling, IPC params, progress listener, state transitions.
 * Exposes: isSupported(), attachProgressListener(), startExport()
 */

import {
  isTauri,
  normalizeFilePath,
  tauriDialogs,
  tauriInvoke,
  tauriListen,
} from "../platform/tauriEnv";
import { useVibeStore } from "../store/vibeStore";
import { AspectRatio, VibeSettings } from "../types";
import { renderTextOverlay } from "./renderTextOverlay";

export interface ExportController {
  isSupported(): boolean;
  attachProgressListener(): Promise<() => void>;
  startExport(): Promise<void>;
}

interface ExportProgressPayload {
  progress: number; // 0.0–1.0
  status: string;
}

/** Map TS settings to Rust VibeSettings shape */
function mapSettingsToRust(settings: VibeSettings) {
  return {
    visualizer_mode: settings.visualizerMode,
    visualizer_color: settings.visualizerColor,
    visualizer_intensity: settings.visualizerIntensity,
  };
}

/** Compute resolution from aspect ratio */
function getResolution(aspectRatio: AspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case AspectRatio.OneOne:
      return { width: 1080, height: 1080 };
    case AspectRatio.NineSixteen:
      return { width: 1080, height: 1920 };
    case AspectRatio.SixteenNine:
    default:
      return { width: 1920, height: 1080 };
  }
}

/** Create an ExportController instance */
export function createExportController(): ExportController {
  return {
    isSupported(): boolean {
      return isTauri();
    },

    async attachProgressListener(): Promise<() => void> {
      if (!isTauri()) {
        return () => {}; // no-op cleanup
      }

      const listen = await tauriListen();
      const unlisten = await listen<ExportProgressPayload>("export-progress", (event) => {
        const { isExporting, setExportState } = useVibeStore.getState();

        // Ignore stale events if not exporting
        if (!isExporting) return;

        const pct = Math.min(100, Math.max(0, Math.round(event.payload.progress * 100)));
        setExportState(true, pct, event.payload.status);

        // Auto-reset after completion
        if (pct >= 100) {
          setTimeout(() => {
            const current = useVibeStore.getState();
            if (current.exportProgress >= 100) {
              current.setExportState(false, 0, "");
            }
          }, 3000);
        }
      });

      return unlisten;
    },

    async startExport(): Promise<void> {
      const {
        setExportState,
        isExporting,
        settings,
        playlist,
        currentTrackId,
        updateTrackInfo,
        backgroundImagePath,
      } = useVibeStore.getState();

      // Platform guard
      if (!isTauri()) {
        setExportState(false, 0, "Export requires desktop app");
        return;
      }

      // Concurrency guard
      if (isExporting) {
        return;
      }

      // Track guard
      if (playlist.length === 0) {
        setExportState(false, 0, "Add audio to enable export");
        return;
      }

      const currentTrack = playlist.find((t) => t.id === currentTrackId) ?? playlist[0] ?? null;

      try {
        const dialogs = await tauriDialogs();

        // 1. Pick output path (primary intent)
        const outputPathRaw = await dialogs.save({
          filters: [{ name: "Video", extensions: ["mp4"] }],
          defaultPath: currentTrack?.name ? `${currentTrack.name}.mp4` : undefined,
        });

        if (!outputPathRaw) {
          return; // Cancelled - no state change
        }

        const outputPath = /\.mp4$/i.test(outputPathRaw) ? outputPathRaw : `${outputPathRaw}.mp4`;

        // 2. Resolve audio source path
        let audioPath = currentTrack?.sourcePath;

        if (!audioPath) {
          setExportState(false, 0, "Select source audio for export");
          const pickedRaw = await dialogs.open({
            filters: [
              {
                name: "Audio",
                extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg"],
              },
            ],
            multiple: false,
          });

          if (!pickedRaw || Array.isArray(pickedRaw)) {
            return; // Cancelled - no state change
          }

          audioPath = normalizeFilePath(pickedRaw);
          if (currentTrack?.id) {
            updateTrackInfo(currentTrack.id, "sourcePath", audioPath);
          }
        }

        // 3. Start export
        setExportState(true, 0, "Initializing Native Forge...");

        const { width, height } = getResolution(settings.aspectRatio);
        const textOverlay = await renderTextOverlay(settings, currentTrack, width, height);
        const invoke = await tauriInvoke();

        await invoke("export_video", {
          params: {
            audio_path: audioPath,
            image_path: backgroundImagePath ?? "",
            output_path: outputPath,
            settings: mapSettingsToRust(settings),
            fps: 30,
            width,
            height,
            show_progress: settings.showProgress,
            text_overlay_png_base64: textOverlay,
          },
        });

        // Success handled by progress listener (final event sets 100%)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setExportState(false, 0, `Error: ${message}`);
      }
    },
  };
}

/** Singleton controller instance */
export const exportController = createExportController();
