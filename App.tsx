import React, { useState, useEffect } from 'react';
import { Icons } from './components/Icons';
import Visualizer from './components/Visualizer';
import { VibeSettings, VisualizerMode, AspectRatio, FontFamily, FontSize } from './types';
import { useAudioEngine } from './hooks/useAudioEngine';
import { VideoRenderer } from './components/VideoRenderer';
import { Sidebar } from './components/Sidebar';
import { PlayerControls } from './components/PlayerControls';
import { useObjectUrl } from './hooks/useObjectUrl';

const App: React.FC = () => {
  // --- Audio Engine ---
  const {
    playlist,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    analyser,
    addTracks,
    removeTrack,
    updateTrackInfo,
    playPause,
    selectTrack,
    nextTrack,
    prevTrack,
    audioElRef
  } = useAudioEngine();

  // --- UI State ---
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null);
  const backgroundImage = useObjectUrl(backgroundImageFile);
  
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatus, setExportStatus] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  // Settings
  const [settings, setSettings] = useState<VibeSettings>({
    visualizerMode: VisualizerMode.Bars,
    aspectRatio: AspectRatio.SixteenNine,
    fontFamily: FontFamily.Geist,
    fontSize: FontSize.Medium,
    showTitle: true,
    showProgress: true,
    kenBurns: true,
    blurBackground: false,
    visualizerColor: '#f59e0b', // Default to Electric Amber
    visualizerIntensity: 1.0
  });

  const [isCinemaMode, setIsCinemaMode] = useState<boolean>(false);

  // --- Handlers ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'image') => {
    if (e.target.files && e.target.files.length > 0) {
      if (type === 'image') {
        const file = e.target.files[0];
        setBackgroundImageFile(file);
      } else {
        // Convert FileList to Array
        const files = Array.from(e.target.files) as File[];
        await addTracks(files);
      }
    }
    // Reset input
    e.target.value = '';
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsCinemaMode(false);
        }
        if (e.code === 'Space') {
            // Prevent scrolling
            e.preventDefault();
            playPause();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playPause]);

  // Export Logic
  const handleExport = async () => {
    if (playlist.length === 0) {
        alert("Please add at least one audio track to export.");
        return;
    }

    try {
        setIsExporting(true);
        setExportProgress(0);
        setExportStatus("Initializing...");

        const renderer = new VideoRenderer();
        
        // Determine resolution based on aspect ratio
        let width = 1920;
        let height = 1080;
        if (settings.aspectRatio === AspectRatio.OneOne) { width = 1080; height = 1080; }
        else if (settings.aspectRatio === AspectRatio.NineSixteen) { width = 1080; height = 1920; }

        const blob = await renderer.renderProject(
            playlist,
            settings,
            backgroundImage,
            {
                width,
                height,
                fps: 30,
                bitrate: 6_000_000 // 6 Mbps
            },
            (progress, status) => {
                setExportProgress(Math.min(100, Math.round(progress * 100)));
                setExportStatus(status);
            }
        );

        // Download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = "vibe_export.mp4";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setExportStatus("Done!");
        setTimeout(() => {
             setIsExporting(false);
             setExportProgress(0);
        }, 3000);

    } catch (error) {
        console.error("Export failed:", error);
        setExportStatus("Error: " + (error as Error).message);
        alert("Export failed. Check console for details.");
        setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#050505] text-zinc-100 font-sans selection:bg-amber-500 selection:text-black overflow-hidden relative">
      {/* Film Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 bg-noise opacity-[0.03] mix-blend-overlay"></div>

      {/* Hidden Audio Element */}
      <audio ref={audioElRef} crossOrigin="anonymous" />

      {/* Header */}
      <header className={`h-14 border-b border-white/10 flex items-center px-6 justify-between bg-black/40 backdrop-blur-md z-20 transition-all duration-500 ${isCinemaMode ? '-mt-14' : 'mt-0'}`}>
        <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-amber-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                <Icons.Video className="w-3.5 h-3.5 text-black" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white uppercase">Vibe Machine</h1>
        </div>
        <div className="flex gap-6 items-center text-xs font-medium text-zinc-500 tracking-wide">
             <button 
                onClick={() => setIsCinemaMode(true)}
                className="flex items-center gap-2 hover:text-amber-400 transition-colors group"
                title="Enter Cinema Mode"
             >
                 <Icons.Maximize className="w-4 h-4 group-hover:scale-110 transition-transform" />
                 <span className="hidden sm:inline">CINEMA MODE</span>
             </button>
             <div className="w-px h-4 bg-white/10"></div>
             <a href="#" className="hover:text-amber-400 transition-colors">v1.0.0</a>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        
        <Sidebar 
            isCinemaMode={isCinemaMode}
            backgroundImage={backgroundImage}
            playlist={playlist}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            settings={settings}
            setSettings={setSettings}
            isExporting={isExporting}
            exportProgress={exportProgress}
            exportStatus={exportStatus}
            onFileUpload={handleFileUpload}
            onRemoveTrack={removeTrack}
            onUpdateTrackInfo={updateTrackInfo}
            onSelectTrack={selectTrack}
            onExport={handleExport}
        />

        {/* Right Area: Preview Canvas */}
        <main className="flex-1 bg-black p-8 flex flex-col items-center justify-center relative">
          {/* Main Stage */}
          <div className={`relative transition-all duration-500 shadow-2xl ring-1 ring-white/10 ${
              settings.aspectRatio === AspectRatio.SixteenNine ? 'w-full max-w-4xl aspect-video' : 
              settings.aspectRatio === AspectRatio.OneOne ? 'h-full max-h-[600px] aspect-square' :
              'h-full max-h-[80vh] aspect-[9/16]'
          }`}>
              <Visualizer 
                settings={settings}
                backgroundImage={backgroundImage}
                analyser={analyser}
                currentTrack={currentTrack}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
              />
              
              {/* Empty State Overlay */}
              {playlist.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg z-10 animate-in fade-in duration-700">
                      <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md max-w-sm mx-auto transform transition-all hover:scale-105 hover:bg-white/10 hover:border-amber-500/30">
                          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                              <Icons.Upload className="w-8 h-8 text-black" />
                          </div>
                          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Ignite the Machine</h2>
                          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                              Drop your audio tracks and background visuals here to begin the reaction.
                          </p>
                          <div className="flex gap-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                              <span className="bg-black/30 px-3 py-1 rounded border border-white/5">MP3</span>
                              <span className="bg-black/30 px-3 py-1 rounded border border-white/5">WAV</span>
                              <span className="bg-black/30 px-3 py-1 rounded border border-white/5">JPG</span>
                              <span className="bg-black/30 px-3 py-1 rounded border border-white/5">PNG</span>
                          </div>
                      </div>
                  </div>
              )}
          </div>

          <PlayerControls 
              isPlaying={isPlaying}
              currentTrack={currentTrack}
              currentTime={currentTime}
              duration={duration}
              onPlayPause={playPause}
              onNext={nextTrack}
              onPrev={prevTrack}
          />
        </main>
      </div>
    </div>
  );
};

export default App;
