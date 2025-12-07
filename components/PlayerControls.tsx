import React from 'react';
import { Icons } from './Icons';
import { Track } from '../types';
import { formatTime } from '../utils';

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
    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/40 hover:bg-black/80 backdrop-blur-xl border border-white/10 hover:border-white/20 ring-1 ring-white/5 rounded-full px-6 py-3 flex items-center gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-30 transition-all duration-500">
             
             <button 
                className="text-zinc-400 hover:text-white transition-colors"
                onClick={onPrev}
             >
                 <Icons.SkipBack className="w-5 h-5" />
             </button>

             <button 
                onClick={onPlayPause}
                className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-white/10"
             >
                 {isPlaying ? <Icons.Pause className="w-5 h-5 text-black fill-current" /> : <Icons.Play className="w-5 h-5 text-black fill-current translate-x-0.5" />}
             </button>

             <button 
                className="text-zinc-400 hover:text-white transition-colors"
                onClick={onNext}
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
    );
};
