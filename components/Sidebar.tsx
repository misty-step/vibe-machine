import React, { useState } from "react";
import { Icons } from "./Icons";
import {
  Track,
  VibeSettings,
  VisualizerMode,
  AspectRatio,
  FontFamily,
  FontSize,
  PRESET_COLORS,
} from "../types";
import { formatTime } from "../utils";

interface SidebarProps {
  isCinemaMode: boolean;
  // Media State
  backgroundImage: string | null;
  playlist: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  isExportSupported: boolean;
  isDesktopApp: boolean;
  // Settings State
  settings: VibeSettings;
  setSettings: React.Dispatch<React.SetStateAction<VibeSettings>>;
  // Export State
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;
  // Handlers
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: "audio" | "image") => void;
  onPickAudio: () => void;
  onPickImage: () => void;
  onRemoveTrack: (id: string) => void;
  onUpdateTrackInfo: (id: string, field: keyof Track, value: string) => void;
  onSelectTrack: (index: number) => void;
  onExport: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCinemaMode,
  backgroundImage,
  playlist,
  currentTrackIndex,
  isPlaying,
  isExportSupported,
  isDesktopApp,
  settings,
  setSettings,
  isExporting,
  exportProgress,
  exportStatus,
  onFileUpload,
  onPickAudio,
  onPickImage,
  onRemoveTrack,
  onUpdateTrackInfo,
  onSelectTrack,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState<"media" | "style" | "export">("media");
  const exportTrack = playlist[currentTrackIndex] ?? playlist[0] ?? null;
  const hasTrack = Boolean(exportTrack);
  const hasSourcePath = Boolean(exportTrack?.sourcePath);
  const exportDisabled = isExporting || !hasTrack || !isExportSupported;
  const exportHint = !isExportSupported
    ? "Desktop app required"
    : !hasTrack
      ? "Add audio to enable export"
      : hasSourcePath
        ? "Choose save location"
        : "First export will ask for source file";

  const randomizeVibe = () => {
    const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    const fonts = Object.values(FontFamily);
    const randomFont = fonts[Math.floor(Math.random() * fonts.length)];

    setSettings((s) => ({
      ...s,
      visualizerColor: randomColor,
      fontFamily: randomFont,
    }));
  };

  return (
    <aside
      className={`w-80 flex flex-col border-r border-white/5 bg-carbon/90 backdrop-blur-xl z-10 transition-all duration-500 ${isCinemaMode ? "-ml-80" : "ml-0"}`}
    >
      {/* Deck Header / Mode Switch */}
      <div className="grid grid-cols-3 border-b border-white/5 p-1 gap-1 bg-black/20">
        {["media", "style", "export"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${
              activeTab === tab
                ? "bg-white/10 text-plasma shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
        {/* MEDIA TAB */}
        {activeTab === "media" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* Section: Visual Source */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Source_Video
                </h3>
                <div className="w-1 h-1 bg-flux rounded-full shadow-[0_0_5px_var(--tw-shadow-color)] shadow-flux"></div>
              </div>

              <div className="relative group">
                {!isDesktopApp && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFileUpload(e, "image")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                )}
                <button
                  type="button"
                  onClick={isDesktopApp ? onPickImage : undefined}
                  className={`w-full text-left ${isDesktopApp ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div
                    className={`h-32 border border-dashed border-white/10 rounded-sm flex flex-col items-center justify-center transition-all duration-300 group-hover:border-plasma/50 group-hover:bg-white/5 ${backgroundImage ? "bg-zinc-900/50" : "bg-black/20"}`}
                  >
                    {backgroundImage ? (
                      <div className="relative w-full h-full overflow-hidden">
                        <img
                          src={backgroundImage}
                          className="object-cover w-full h-full opacity-60 group-hover:opacity-100 transition-opacity"
                          alt="Background"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/80 text-plasma text-[9px] px-2 py-0.5 font-mono uppercase">
                          IMG Loaded
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Icons.Image className="w-5 h-5 text-zinc-700 group-hover:text-plasma transition-colors" />
                        <span className="text-[9px] text-zinc-600 font-mono uppercase">
                          {isDesktopApp ? "Pick Image" : "Drop Image"}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* Section: Audio Source */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Source_Audio
                </h3>
                <span className="text-[9px] text-zinc-600 font-mono">
                  {playlist.length.toString().padStart(2, "0")} FILES
                </span>
              </div>

              <div className="relative group">
                {!isDesktopApp && (
                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    onChange={(e) => onFileUpload(e, "audio")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                )}
                <button
                  type="button"
                  onClick={isDesktopApp ? onPickAudio : undefined}
                  className="btn-mechanical w-full py-3 flex items-center justify-center gap-2"
                >
                  <Icons.Upload className="w-3 h-3" />
                  <span>{isDesktopApp ? "Pick Tracks" : "Import Tracks"}</span>
                </button>
              </div>

              {/* Playlist (Data List) */}
              <div className="space-y-px bg-black/20 border border-white/5 rounded-sm overflow-hidden">
                {playlist.map((track, idx) => (
                  <div
                    key={track.id}
                    className={`flex items-center p-2 gap-3 group transition-colors ${
                      currentTrackIndex === idx
                        ? "bg-white/5 border-l-2 border-plasma"
                        : "hover:bg-white/5 border-l-2 border-transparent"
                    }`}
                  >
                    <button
                      onClick={() => onSelectTrack(idx)}
                      className={`text-[10px] font-mono ${currentTrackIndex === idx && isPlaying ? "text-plasma animate-pulse" : "text-zinc-600 group-hover:text-zinc-400"}`}
                    >
                      {(idx + 1).toString().padStart(2, "0")}
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col">
                      <input
                        value={track.name}
                        onChange={(e) => onUpdateTrackInfo(track.id, "name", e.target.value)}
                        className={`bg-transparent text-[11px] font-medium w-full focus:outline-none placeholder-zinc-700 truncate ${currentTrackIndex === idx ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"}`}
                        placeholder="Track Title"
                      />
                      <input
                        value={track.artist}
                        onChange={(e) => onUpdateTrackInfo(track.id, "artist", e.target.value)}
                        className="bg-transparent text-[9px] font-mono w-full focus:outline-none text-zinc-600 group-hover:text-zinc-300 placeholder-zinc-700 truncate"
                        placeholder="Artist"
                      />
                    </div>

                    <button
                      onClick={() => onRemoveTrack(track.id)}
                      className="text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icons.Trash className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {playlist.length === 0 && (
                  <div className="p-4 text-center text-[10px] text-zinc-700 font-mono uppercase">
                    // NO_DATA
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STYLE TAB */}
        {activeTab === "style" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
            <button
              onClick={randomizeVibe}
              className="btn-mechanical w-full py-3 flex items-center justify-center gap-2 text-plasma border-plasma/20 hover:bg-plasma/10"
            >
              <Icons.Disc className="w-3 h-3 animate-spin-slow" />
              <span>Randomize_Parameters</span>
            </button>

            {/* Grid: Format */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Output_Format
              </h3>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: "16:9", value: AspectRatio.SixteenNine, icon: Icons.Monitor },
                  { label: "1:1", value: AspectRatio.OneOne, icon: Icons.Square },
                  { label: "9:16", value: AspectRatio.NineSixteen, icon: Icons.Smartphone },
                ].map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => setSettings((s) => ({ ...s, aspectRatio: ratio.value }))}
                    className={`flex flex-col items-center justify-center p-3 border transition-all rounded-sm ${
                      settings.aspectRatio === ratio.value
                        ? "bg-white/10 border-plasma text-white shadow-[0_0_10px_rgba(255,183,3,0.1)]"
                        : "bg-black/20 border-white/5 text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
                    }`}
                  >
                    <ratio.icon className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-mono">{ratio.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid: Mode */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Viz_Engine
              </h3>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: "Bars", value: VisualizerMode.Bars, icon: Icons.BarChart2 },
                  { label: "Orbital", value: VisualizerMode.Orbital, icon: Icons.Disc },
                  { label: "Wave", value: VisualizerMode.Wave, icon: Icons.Wave },
                ].map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setSettings((s) => ({ ...s, visualizerMode: mode.value }))}
                    className={`flex flex-col items-center justify-center p-3 border transition-all rounded-sm ${
                      settings.visualizerMode === mode.value
                        ? "bg-white/10 border-plasma text-white shadow-[0_0_10px_rgba(255,183,3,0.1)]"
                        : "bg-black/20 border-white/5 text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
                    }`}
                  >
                    <mode.icon className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-mono">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette (Hex Grid) */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Plasma_Frequency
              </h3>
              <div className="flex flex-wrap gap-2 p-2 bg-black/20 border border-white/5 rounded-sm">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSettings((s) => ({ ...s, visualizerColor: color }))}
                    className={`w-6 h-6 rounded-sm transition-transform hover:scale-110 ${
                      settings.visualizerColor === color
                        ? "ring-1 ring-white shadow-[0_0_8px_var(--tw-shadow-color)]"
                        : "opacity-50 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color, boxShadowColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={settings.visualizerColor}
                  onChange={(e) => setSettings((s) => ({ ...s, visualizerColor: e.target.value }))}
                  className="w-6 h-6 rounded-sm overflow-hidden cursor-pointer border-0 bg-transparent p-0 opacity-50 hover:opacity-100"
                />
              </div>
            </div>

            {/* Typography Dropdown */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Typography
              </h3>
              <div className="relative group">
                <select
                  value={settings.fontFamily}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, fontFamily: e.target.value as FontFamily }))
                  }
                  className="w-full bg-black/20 border border-white/10 rounded-sm px-3 py-2 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-plasma appearance-none cursor-pointer hover:bg-white/5"
                >
                  {Object.entries(FontFamily).map(([key, value]) => (
                    <option key={key} value={value} className="bg-zinc-900 text-zinc-300">
                      {key} ({value})
                    </option>
                  ))}
                </select>
                <Icons.ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Size
              </h3>
              <div className="flex gap-1">
                {[
                  { label: "S", value: FontSize.Small },
                  { label: "M", value: FontSize.Medium },
                  { label: "L", value: FontSize.Large },
                  { label: "XL", value: FontSize.ExtraLarge },
                ].map((size) => (
                  <button
                    key={size.label}
                    onClick={() => setSettings((s) => ({ ...s, fontSize: size.value }))}
                    className={`flex-1 py-2 rounded-sm border text-[10px] font-bold transition-all ${
                      settings.fontSize === size.value
                        ? "bg-white/10 border-plasma text-white"
                        : "bg-black/20 border-white/5 text-zinc-600 hover:bg-white/5"
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mechanical Toggles */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Overlays
              </h3>

              <div className="grid grid-cols-1 gap-px bg-white/5 border border-white/5 rounded-sm overflow-hidden">
                {[
                  { label: "Track Title", key: "showTitle" },
                  { label: "Progress Bar", key: "showProgress" },
                  { label: "Ken Burns", key: "kenBurns" },
                  { label: "Darken BG", key: "blurBackground" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-3 bg-black/20 hover:bg-white/5 cursor-pointer group transition-colors"
                  >
                    <span className="text-[11px] text-zinc-400 font-medium group-hover:text-zinc-200">
                      {item.label}
                    </span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={(settings as any)[item.key]}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [item.key]: e.target.checked }))
                        }
                        className="peer sr-only"
                      />
                      <div className="w-8 h-4 bg-zinc-800 rounded-full peer-checked:bg-plasma/20 peer-checked:border peer-checked:border-plasma transition-all"></div>
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-zinc-500 rounded-full peer-checked:bg-plasma peer-checked:translate-x-4 transition-all shadow-sm"></div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Intensity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Gain
                </h3>
                <span className="text-[10px] font-mono text-plasma">
                  {(settings.visualizerIntensity * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={settings.visualizerIntensity}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, visualizerIntensity: parseFloat(e.target.value) }))
                }
                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-plasma hover:accent-amber-400"
              />
            </div>
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === "export" && (
          <div className="h-full flex flex-col justify-center items-center text-center space-y-6 p-4 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="w-full border border-white/10 bg-black/20 p-4 flex items-center gap-3">
              <div className="w-10 h-10 border border-white/10 bg-black/40 flex items-center justify-center">
                <Icons.Download className="w-5 h-5 text-plasma" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold text-white uppercase tracking-widest">
                  Export Video
                </div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">
                  Native render to .mp4
                </div>
              </div>
            </div>

            <div className="w-full border-t border-b border-white/5 py-4 space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                <span>Res</span>
                <span className="text-zinc-300">
                  {settings.aspectRatio === AspectRatio.SixteenNine
                    ? "1920x1080"
                    : settings.aspectRatio === AspectRatio.OneOne
                      ? "1080x1080"
                      : "1080x1920"}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                <span>Dur</span>
                <span className="text-zinc-300">{formatTime(exportTrack?.duration ?? 0)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                <span>FPS</span>
                <span className="text-zinc-300">30</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                <span>Track</span>
                <span className="text-zinc-300">
                  {exportTrack?.name ? exportTrack.name : "None"}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                <span>Source</span>
                <span className={hasSourcePath ? "text-zinc-300" : "text-amber-300"}>
                  {hasSourcePath ? "Linked" : "Needs_File"}
                </span>
              </div>
            </div>

            {(isExporting || exportStatus) && (
              <div className="w-full space-y-2">
                <div
                  className={`flex justify-between text-[10px] font-mono uppercase ${
                    isExporting ? "text-plasma animate-pulse" : "text-zinc-400"
                  }`}
                >
                  <span>{exportStatus}</span>
                  {isExporting && <span>{exportProgress}%</span>}
                </div>
                {isExporting && (
                  <div className="h-1 bg-zinc-900 w-full overflow-hidden">
                    <div
                      className="h-full bg-plasma transition-all duration-300 ease-out"
                      style={{ width: `${exportProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}

            <button
              id="export-btn"
              onClick={onExport}
              disabled={exportDisabled}
              className="btn-mechanical w-full py-4 text-plasma border-plasma/30 hover:bg-plasma hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isExportSupported
                ? "Desktop_App_Required"
                : isExporting
                  ? "Rendering..."
                  : "Export_Video_.mp4"}
            </button>
            <div className="text-[9px] text-zinc-600 font-mono uppercase">{exportHint}</div>
          </div>
        )}
      </div>
    </aside>
  );
};
