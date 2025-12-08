import React from 'react';
import { Icons } from './Icons';
import { Track } from '../types';
import { formatTime } from '../utils';
import { AudioSystem } from '../engine/AudioSystem';

interface PlayerControlsProps {
    isPlaying: boolean;
    currentTrack: Track | null;
    currentTime: number;
    duration: number;
    onPlayPause: () => void;
    onNext: () => void;
    onPrev: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
    isPlaying,
    currentTrack,
    currentTime,
    duration,
    onPlayPause,
    onNext,
    onPrev
}) => {
    const handlePlayPause = async () => {
        // Unlock audio context on user interaction
        await AudioSystem.getInstance().unlock();
        onPlayPause();
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30 w-[400px]">
            
            {/* Track Info (Holographic Float) */}
            <div className="flex items-center justify-between w-full px-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    {currentTrack ? 'Playing' : 'Idle'}
                </span>
                <span className="text-[10px] font-mono text-plasma truncate max-w-[200px] text-right">
                    {currentTrack?.name || "No_Data"}
                </span>
            </div>

            {/* Mechanical Transport Bar */}
            <div className="bg-carbon/90 backdrop-blur-xl border border-white/10 shadow-glow shadow-black/50 p-1 flex items-stretch h-12 w-full">
                
                {/* Previous */}
                <button 
                    className="w-12 flex items-center justify-center border-r border-white/5 hover:bg-white/5 hover:text-white text-zinc-500 transition-colors active:bg-white/10"
                    onClick={onPrev}
                >
                    <Icons.SkipBack className="w-4 h-4" />
                </button>

                {/* Play/Pause */}
                <button 
                    onClick={handlePlayPause}
                    className="w-16 flex items-center justify-center border-r border-white/5 bg-white/5 hover:bg-plasma hover:text-black text-white transition-all active:scale-95"
                >
                    {isPlaying ? <Icons.Pause className="w-5 h-5 fill-current" /> : <Icons.Play className="w-5 h-5 fill-current" />}
                </button>

                {/* Next */}
                <button 
                    className="w-12 flex items-center justify-center border-r border-white/5 hover:bg-white/5 hover:text-white text-zinc-500 transition-colors active:bg-white/10"
                    onClick={onNext}
                >
                    <Icons.SkipForward className="w-4 h-4" />
                </button>

                {/* Time & Progress */}
                <div className="flex-1 flex flex-col justify-center px-4 gap-1 group cursor-default">
                    <div className="flex justify-between text-[9px] font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                    <div className="h-1 bg-black w-full overflow-hidden relative">
                        <div 
                            className="absolute inset-0 bg-zinc-800"
                        ></div>
                        <div 
                            className="absolute top-0 bottom-0 left-0 bg-plasma transition-all duration-100 ease-linear" 
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>

            </div>
        </div>
    );
};