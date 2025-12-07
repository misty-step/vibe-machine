import React, { useState, useEffect } from 'react';
import { Icons } from './components/Icons';
import Visualizer from './components/Visualizer';
import { VibeSettings, VisualizerMode, AspectRatio, PRESET_COLORS, FontFamily, FontSize } from './types';
import { formatTime } from './utils';
import { useAudioEngine } from './hooks/useAudioEngine';
import { VideoRenderer } from './components/VideoRenderer';

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
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'style' | 'export'>('media');
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
        const url = URL.createObjectURL(file);
        setBackgroundImage(url);
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
  }, [playPause]); // Added playPause dependency

  const randomizeVibe = () => {
      const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
      const fonts = Object.values(FontFamily);
      const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
      
      setSettings(s => ({
          ...s,
          visualizerColor: randomColor,
          fontFamily: randomFont
      }));
  };

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
        
        {/* Left Sidebar: Controls & Settings */}
        <aside className={`w-80 flex flex-col border-r border-white/10 bg-black/30 backdrop-blur-xl z-10 transition-all duration-500 ${isCinemaMode ? '-ml-80' : 'ml-0'}`}>
          
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button 
                onClick={() => setActiveTab('media')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'media' ? 'text-amber-400 border-b-2 border-amber-500 bg-white/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
                Media
            </button>
            <button 
                onClick={() => setActiveTab('style')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'style' ? 'text-amber-400 border-b-2 border-amber-500 bg-white/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
                Style
            </button>
            <button 
                onClick={() => setActiveTab('export')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'export' ? 'text-amber-400 border-b-2 border-amber-500 bg-white/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
                Export
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-8">
            
            {/* MEDIA TAB */}
            {activeTab === 'media' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* Image Drop */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Visual Source</h3>
                  <div className="relative group">
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileUpload(e, 'image')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`border border-dashed border-white/10 rounded-lg p-8 flex flex-col items-center justify-center transition-all duration-300 group-hover:border-amber-500/50 group-hover:bg-white/5 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] ${backgroundImage ? 'bg-zinc-900/50' : ''}`}>
                      {backgroundImage ? (
                        <div className="relative w-full aspect-video rounded overflow-hidden mb-3 shadow-lg">
                            <img src={backgroundImage} className="object-cover w-full h-full" alt="Background" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Icons.Image className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                        </div>
                      )}
                      <span className="text-xs text-zinc-500 font-medium group-hover:text-zinc-300">{backgroundImage ? 'Change Source' : 'Drop Image'}</span>
                    </div>
                  </div>
                </div>

                {/* Audio Drop */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Audio Source</h3>
                     <span className="text-[10px] text-zinc-600 font-mono">{playlist.length} TRACKS</span>
                  </div>
                  
                  <div className="relative group mb-2">
                    <input 
                        type="file" 
                        accept="audio/*" 
                        multiple 
                        onChange={(e) => handleFileUpload(e, 'audio')}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border border-zinc-800 rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-zinc-900 hover:border-zinc-700 transition-all cursor-pointer active:scale-95">
                        <Icons.Upload className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs text-zinc-400 font-medium">Add Tracks</span>
                    </div>
                  </div>

                  {/* Playlist */}
                  <div className="space-y-1">
                    {playlist.map((track, idx) => (
                        <div 
                            key={track.id} 
                            className={`flex items-center p-2 rounded border transition-all duration-200 group ${currentTrackIndex === idx ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}`}
                        >
                            <button 
                                onClick={() => selectTrack(idx)}
                                className={`w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0 mr-3 ${currentTrackIndex === idx && isPlaying ? 'text-amber-400' : 'text-zinc-600 group-hover:text-zinc-300'}`}
                            >
                                {currentTrackIndex === idx && isPlaying ? <Icons.Pause className="w-3.5 h-3.5 fill-current" /> : <Icons.Play className="w-3.5 h-3.5 fill-current" />}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                                <input 
                                    value={track.name}
                                    onChange={(e) => updateTrackInfo(track.id, 'name', e.target.value)}
                                    className={`bg-transparent text-xs font-medium w-full focus:outline-none placeholder-zinc-700 truncate ${currentTrackIndex === idx ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}
                                    placeholder="Track Title"
                                />
                                <div className="flex items-center gap-2">
                                    <input 
                                        value={track.artist}
                                        onChange={(e) => updateTrackInfo(track.id, 'artist', e.target.value)}
                                        className="bg-transparent text-[10px] text-zinc-600 w-full focus:outline-none placeholder-zinc-800"
                                        placeholder="Artist"
                                    />
                                </div>
                            </div>
                            
                            <span className="text-[10px] text-zinc-600 font-mono whitespace-nowrap ml-2">{formatTime(track.duration)}</span>
                            
                            <button onClick={() => removeTrack(track.id)} className="ml-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Icons.Trash className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    {playlist.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-lg bg-white/5">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                <Icons.Music className="w-6 h-6 text-zinc-600" />
                            </div>
                            <p className="text-xs font-medium text-zinc-400">No Audio Loaded</p>
                            <p className="text-[10px] text-zinc-600 mt-1">Drop files to start the vibe</p>
                        </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* STYLE TAB */}
            {activeTab === 'style' && (
              <div className="space-y-8">

                {/* Randomize Button */}
                <button 
                    onClick={randomizeVibe}
                    className="w-full py-3 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-lg hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-400 transition-all text-xs font-bold uppercase tracking-wider text-zinc-400 group"
                >
                    <Icons.Settings className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                    <span>Randomize Vibe</span>
                </button>

                {/* Aspect Ratio */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Format</h3>
                    <div className="flex gap-2">
                        {[
                            { label: 'YouTube (16:9)', value: AspectRatio.SixteenNine, icon: Icons.Monitor },
                            { label: 'Instagram (1:1)', value: AspectRatio.OneOne, icon: Icons.Square },
                            { label: 'TikTok (9:16)', value: AspectRatio.NineSixteen, icon: Icons.Smartphone }
                        ].map((ratio) => (
                            <button
                                key={ratio.value}
                                onClick={() => setSettings(s => ({ ...s, aspectRatio: ratio.value }))}
                                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${settings.aspectRatio === ratio.value ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
                                title={ratio.label}
                            >
                                <ratio.icon className="w-5 h-5 mb-1" />
                                <span className="text-[10px]">{ratio.value}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Colors */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Accent Color</h3>
                    <div className="flex flex-wrap gap-3">
                        {PRESET_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => setSettings(s => ({ ...s, visualizerColor: color }))}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${settings.visualizerColor === color ? 'border-white ring-2 ring-amber-500 ring-offset-2 ring-offset-zinc-900' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                         <input 
                            type="color" 
                            value={settings.visualizerColor}
                            onChange={(e) => setSettings(s => ({ ...s, visualizerColor: e.target.value }))}
                            className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border-0 bg-transparent p-0"
                        />
                    </div>
                </div>

                {/* Typography */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Typography</h3>
                        <div className="relative group">
                            <select
                                value={settings.fontFamily}
                                onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value as FontFamily }))}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400 focus:outline-none focus:border-amber-500/50 focus:text-amber-400 appearance-none cursor-pointer transition-all hover:bg-white/5"
                            >
                                {[
                                    { label: 'Modern (Geist)', value: FontFamily.Geist },
                                    { label: 'Elegant (Playfair)', value: FontFamily.Playfair },
                                    { label: 'Technical (Mono)', value: FontFamily.Mono },
                                    { label: 'Clean (Inter)', value: FontFamily.Inter },
                                    { label: 'Slab (Roboto)', value: FontFamily.RobotoSlab },
                                    { label: 'Cinematic (Cinzel)', value: FontFamily.Cinzel },
                                    { label: 'Geometric (Montserrat)', value: FontFamily.Montserrat }
                                ].map((font) => (
                                    <option key={font.value} value={font.value} className="bg-zinc-900 text-zinc-300">
                                        {font.label}
                                    </option>
                                ))}
                            </select>
                            <Icons.ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-zinc-400 pointer-events-none transition-colors" />
                        </div>
                    </div>
                    
                    {/* Font Size */}
                    <div className="flex gap-2">
                        {[
                             { label: 'S', value: FontSize.Small },
                             { label: 'M', value: FontSize.Medium },
                             { label: 'L', value: FontSize.Large },
                             { label: 'XL', value: FontSize.ExtraLarge }
                        ].map((size) => (
                            <button
                                key={size.label}
                                onClick={() => setSettings(s => ({ ...s, fontSize: size.value }))}
                                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${settings.fontSize === size.value ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}
                            >
                                {size.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                     <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Overlays & Effects</h3>
                     
                     <div className="space-y-2">
                        <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 cursor-pointer">
                            <span className="text-sm text-zinc-300">Show Track Title</span>
                            <input type="checkbox" checked={settings.showTitle} onChange={(e) => setSettings(s => ({ ...s, showTitle: e.target.checked }))} className="accent-amber-500" />
                        </label>
                        <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 cursor-pointer">
                            <span className="text-sm text-zinc-300">Show Progress Bar</span>
                            <input type="checkbox" checked={settings.showProgress} onChange={(e) => setSettings(s => ({ ...s, showProgress: e.target.checked }))} className="accent-amber-500" />
                        </label>
                         <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 cursor-pointer">
                            <span className="text-sm text-zinc-300">Ken Burns Effect</span>
                            <input type="checkbox" checked={settings.kenBurns} onChange={(e) => setSettings(s => ({ ...s, kenBurns: e.target.checked }))} className="accent-amber-500" />
                        </label>
                        <label className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 cursor-pointer">
                            <span className="text-sm text-zinc-300">Darken Background</span>
                            <input type="checkbox" checked={settings.blurBackground} onChange={(e) => setSettings(s => ({ ...s, blurBackground: e.target.checked }))} className="accent-amber-500" />
                        </label>
                     </div>
                </div>

                {/* Intensity Slider */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Reactivity</h3>
                    <input 
                        type="range" 
                        min="0.1" 
                        max="2.0" 
                        step="0.1" 
                        value={settings.visualizerIntensity}
                        onChange={(e) => setSettings(s => ({ ...s, visualizerIntensity: parseFloat(e.target.value) }))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>

              </div>
            )}

            {/* EXPORT TAB */}
            {activeTab === 'export' && (
              <div className="h-full flex flex-col justify-center items-center text-center space-y-6 p-4">
                 <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-2 border border-zinc-800">
                     <Icons.Download className="w-8 h-8 text-zinc-500" />
                 </div>
                 <div>
                     <h3 className="text-lg font-medium text-white">Ready to Render?</h3>
                     <p className="text-sm text-zinc-500 mt-2 max-w-[240px] mx-auto">
                        {isExporting 
                            ? "Sit back. This happens locally on your device." 
                            : "This will compile your visuals and audio into a shareable format."}
                     </p>
                 </div>
                 
                 {!isExporting && (
                     <div className="w-full bg-zinc-900/50 rounded-lg p-4 text-left text-sm space-y-2 border border-zinc-800/50">
                         <div className="flex justify-between">
                             <span className="text-zinc-500">Resolution</span>
                             <span className="text-zinc-300">
                                {settings.aspectRatio === AspectRatio.SixteenNine ? '1920x1080' : 
                                 settings.aspectRatio === AspectRatio.OneOne ? '1080x1080' : '1080x1920'}
                             </span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-zinc-500">Duration</span>
                             <span className="text-zinc-300">{formatTime(playlist.reduce((acc, t) => acc + t.duration, 0))}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-zinc-500">FPS</span>
                             <span className="text-zinc-300">30</span>
                         </div>
                     </div>
                 )}

                 {isExporting && (
                     <div className="w-full space-y-2 animate-in fade-in">
                         <div className="flex justify-between text-xs font-mono text-zinc-400 uppercase">
                             <span>{exportStatus}</span>
                             <span>{exportProgress}%</span>
                         </div>
                         <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                             <div 
                                className="h-full bg-amber-500 transition-all duration-300 ease-out"
                                style={{ width: `${exportProgress}%` }}
                             ></div>
                         </div>
                     </div>
                 )}

                 <button 
                    id="export-btn"
                    onClick={handleExport}
                    disabled={isExporting || playlist.length === 0}
                    className="bg-amber-500 hover:bg-amber-400 text-black px-8 py-3 rounded-full font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                     {isExporting ? 'Rendering...' : 'Render Video (MP4)'}
                 </button>
                 <p className="text-xs text-zinc-600">
                    Uses WebCodecs + H.264. No server upload required.
                 </p>
              </div>
            )}

          </div>
        </aside>

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
          </div>

          {/* Bottom Player Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/40 hover:bg-black/80 backdrop-blur-xl border border-white/10 hover:border-white/20 ring-1 ring-white/5 rounded-full px-6 py-3 flex items-center gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-30 transition-all duration-500">
             
             <button 
                className="text-zinc-400 hover:text-white transition-colors"
                onClick={() => prevTrack()}
             >
                 <Icons.SkipBack className="w-5 h-5" />
             </button>

             <button 
                onClick={playPause}
                className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
             >
                 {isPlaying ? <Icons.Pause className="w-5 h-5 text-black fill-current" /> : <Icons.Play className="w-5 h-5 text-black fill-current translate-x-0.5" />}
             </button>

             <button 
                className="text-zinc-400 hover:text-white transition-colors"
                onClick={() => nextTrack()}
             >
                 <Icons.SkipForward className="w-5 h-5" />
             </button>

             <div className="w-px h-6 bg-white/10 mx-2"></div>
             
             <div className="flex flex-col w-48">
                 <span className="text-xs font-medium text-white truncate">
                    {currentTrack?.name || "No Track Selected"}
                 </span>
                 <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1">
                     <span>{formatTime(currentTime)}</span>
                     <div className="flex-1 mx-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-amber-500 rounded-full" 
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        ></div>
                     </div>
                     <span>{formatTime(duration)}</span>
                 </div>
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;