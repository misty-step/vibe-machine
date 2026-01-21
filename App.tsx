import React, { useEffect } from "react";
import { Icons } from "./components/Icons";
import Visualizer from "./components/Visualizer";
import { AspectRatio } from "./types";
import { useVibeEngine } from "./hooks/useVibeEngine";
import { Sidebar } from "./components/Sidebar";
import { PlayerControls } from "./components/PlayerControls";
import { useVibeStore } from "./store/vibeStore";
import { exportController } from "./export/ExportController";
import { isTauri, normalizeFilePath, tauriConvertFileSrc, tauriDialogs } from "./platform/tauriEnv";
import { version } from "./package.json";

// --- Subcomponents ---

const ViewfinderOverlay: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none z-20">
    {/* Corners */}
    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/20"></div>
    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/20"></div>
    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/20"></div>
    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/20"></div>

    {/* Crosshairs */}
    <div className="absolute top-1/2 left-4 w-2 h-px bg-white/20"></div>
    <div className="absolute top-1/2 right-4 w-2 h-px bg-white/20"></div>
    <div className="absolute top-4 left-1/2 w-px h-2 bg-white/20"></div>
    <div className="absolute bottom-4 left-1/2 w-px h-2 bg-white/20"></div>
  </div>
);

const App: React.FC = () => {
  // --- Engine ---
  const engine = useVibeEngine();

  // --- Store State ---
  const settings = useVibeStore((s) => s.settings);
  const updateSettings = useVibeStore((s) => s.updateSettings);
  const backgroundImage = useVibeStore((s) => s.backgroundImage);
  const setBackgroundImage = useVibeStore((s) => s.setBackgroundImage);
  const setBackgroundImagePath = useVibeStore((s) => s.setBackgroundImagePath);
  const initializeStore = useVibeStore((s) => s.initialize);

  // Export state from store (single source of truth)
  const isExporting = useVibeStore((s) => s.isExporting);
  const exportProgress = useVibeStore((s) => s.exportProgress);
  const exportStatus = useVibeStore((s) => s.exportStatus);
  const isExportSupported = exportController.isSupported();

  const [isCinemaMode, setIsCinemaMode] = React.useState<boolean>(false);

  // Initialize Store + Export progress listener
  useEffect(() => {
    initializeStore();

    // Attach export progress listener (handles Tauri check internally)
    let cleanup: (() => void) | undefined;
    exportController.attachProgressListener().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // --- Handlers ---
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "audio" | "image"
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      if (type === "image") {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        // Revoke old if exists (handled by store logic ideally, but manual here for now)
        if (backgroundImage) URL.revokeObjectURL(backgroundImage);
        setBackgroundImage(url);
        const sourcePath =
          typeof (file as { path?: unknown }).path === "string"
            ? String((file as { path?: string }).path)
            : null;
        setBackgroundImagePath(sourcePath);
      } else {
        const files = Array.from(e.target.files) as File[];
        await engine.addTracks(files);
      }
    }
    e.target.value = "";
  };

  const handleNativePick = async (type: "audio" | "image") => {
    if (!isTauri()) return;
    const dialogs = await tauriDialogs();
    const convertFileSrc = await tauriConvertFileSrc();

    if (type === "image") {
      const imagePathRaw = await dialogs.open({
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
        multiple: false,
      });
      if (!imagePathRaw || Array.isArray(imagePathRaw)) return;
      const imagePath = normalizeFilePath(imagePathRaw);
      // Revoke old blob URL if switching from browser upload to native pick
      if (backgroundImage?.startsWith("blob:")) {
        URL.revokeObjectURL(backgroundImage);
      }
      setBackgroundImage(convertFileSrc(imagePath));
      setBackgroundImagePath(imagePath);
      return;
    }

    const audioPathsRaw = await dialogs.open({
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg"] }],
      multiple: true,
    });

    if (!audioPathsRaw) return;
    const paths = (Array.isArray(audioPathsRaw) ? audioPathsRaw : [audioPathsRaw]).map(
      normalizeFilePath
    );
    await engine.addTracksFromPaths(paths);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCinemaMode(false);
      }
      if (e.code === "Space") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        engine.playPause();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine]);

  // Export via controller (dialogs + IPC + store state)
  const handleExport = () => {
    exportController.startExport();
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-void text-zinc-100 font-sans selection:bg-plasma selection:text-black overflow-hidden relative">
      {/* Film Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 bg-noise opacity-[0.02] mix-blend-overlay"></div>

      {/* Header */}
      <header
        className={`h-12 border-b border-white/5 flex items-center px-4 justify-between bg-carbon/80 backdrop-blur-md z-20 transition-all duration-500 ${isCinemaMode ? "-mt-12" : "mt-0"}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-plasma rounded-sm flex items-center justify-center shadow-glow shadow-plasma/50">
            <Icons.Video className="w-3 h-3 text-black" />
          </div>
          <h1 className="text-xs font-bold tracking-widest text-white uppercase font-mono">
            Vibe_Machine <span className="text-zinc-600">v{version}</span>
          </h1>
        </div>
        <div className="flex gap-4 items-center text-[10px] font-bold text-zinc-500 tracking-wide font-mono uppercase">
          <button
            onClick={() => setIsCinemaMode(true)}
            className="flex items-center gap-2 hover:text-plasma transition-colors group"
            title="Enter Cinema Mode"
          >
            <Icons.Maximize className="w-3 h-3 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Cinema_Mode</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative bg-grid-pattern bg-grid">
        <Sidebar
          isCinemaMode={isCinemaMode}
          backgroundImage={backgroundImage}
          playlist={engine.playlist}
          currentTrackIndex={engine.currentTrackIndex}
          isPlaying={engine.isPlaying}
          isExportSupported={isExportSupported}
          isDesktopApp={isExportSupported}
          settings={settings}
          setSettings={(val) => {
            if (typeof val === "function") {
              const newState = val(settings);
              updateSettings(newState);
            } else {
              updateSettings(val);
            }
          }}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportStatus={exportStatus}
          onFileUpload={handleFileUpload}
          onPickAudio={() => handleNativePick("audio")}
          onPickImage={() => handleNativePick("image")}
          onRemoveTrack={engine.removeTrack}
          onUpdateTrackInfo={engine.updateTrackInfo}
          onSelectTrack={engine.selectTrack}
          onReorderTracks={engine.reorderTracks}
          onExport={handleExport}
        />

        {/* Right Area: Preview Canvas */}
        <main className="flex-1 flex flex-col items-center justify-center relative p-8">
          {/* Main Stage (Lens) */}
          <div
            className={`relative transition-all duration-500 bg-black shadow-2xl ring-1 ring-white/10 overflow-hidden ${
              settings.aspectRatio === AspectRatio.SixteenNine
                ? "w-full max-w-5xl aspect-video"
                : settings.aspectRatio === AspectRatio.OneOne
                  ? "h-full max-h-[600px] aspect-square"
                  : "h-full max-h-[80vh] aspect-[9/16]"
            }`}
          >
            <ViewfinderOverlay />

            <Visualizer
              settings={settings}
              backgroundImage={backgroundImage}
              analyser={engine.analyser}
              currentTrack={engine.currentTrack}
              currentTime={engine.currentTime}
              duration={engine.duration}
              isPlaying={engine.isPlaying}
            />

            {/* Empty State Overlay */}
            {engine.playlist.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10 animate-in fade-in duration-700">
                <div className="border border-white/10 p-8 bg-carbon/50 flex flex-col items-center text-center shadow-glow shadow-plasma/10 backdrop-blur-md max-w-sm mx-auto">
                  <div className="w-12 h-12 border border-plasma text-plasma rounded-full flex items-center justify-center mb-4 shadow-glow shadow-plasma/40 animate-pulse">
                    <Icons.Upload className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold text-white mb-2 tracking-widest uppercase font-mono">
                    System_Idle
                  </h2>
                  <p className="text-[11px] text-zinc-500 leading-relaxed mb-6 font-mono uppercase">
                    Initialize audio & video streams to begin processing.
                  </p>
                </div>
              </div>
            )}
          </div>

          <PlayerControls
            isPlaying={engine.isPlaying}
            currentTrack={engine.currentTrack}
            currentTime={engine.currentTime}
            duration={engine.duration}
            onPlayPause={engine.playPause}
            onNext={engine.nextTrack}
            onPrev={engine.prevTrack}
          />
        </main>
      </div>
    </div>
  );
};

export default App;
