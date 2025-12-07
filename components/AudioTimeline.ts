import { Track } from '../types';

interface CachedBuffer {
    buffer: AudioBuffer;
    lastUsed: number;
}

export class AudioTimeline {
    private playlist: Track[];
    private cache: Map<string, CachedBuffer> = new Map();
    private trackStartTimes: number[] = [];
    private totalDuration: number = 0;
    
    // Config
    private maxCacheSize: number = 3; // Keep max 3 tracks decoded in memory

    constructor(playlist: Track[]) {
        this.playlist = playlist;
        this.calculateTimeline();
    }

    private calculateTimeline() {
        let acc = 0;
        this.trackStartTimes = [];
        for (const track of this.playlist) {
            this.trackStartTimes.push(acc);
            acc += track.duration;
        }
        this.totalDuration = acc;
    }

    public getTotalDuration(): number {
        return this.totalDuration;
    }

    public getTrackAtTime(time: number): { track: Track, startTime: number } | null {
        // Binary search or simple find (playlist is usually small < 100)
        const idx = this.trackStartTimes.findIndex((start, i) => {
            const end = start + this.playlist[i].duration;
            return time >= start && time < end;
        });

        if (idx !== -1) {
            return {
                track: this.playlist[idx],
                startTime: this.trackStartTimes[idx]
            };
        }
        return null;
    }

    /**
     * Ensures tracks needed for the window [startTime, startTime + duration] are decoded.
     * Manages LRU cache to free memory.
     */
    public async prepare(ctx: BaseAudioContext, startTime: number, duration: number, onProgress?: (msg: string) => void): Promise<void> {
        const neededTrackIndices = new Set<number>();
        const endTime = startTime + duration;

        // Identify needed tracks
        for (let i = 0; i < this.playlist.length; i++) {
            const start = this.trackStartTimes[i];
            const end = start + this.playlist[i].duration;
            if (end > startTime && start < endTime) {
                neededTrackIndices.add(i);
            }
        }

        // Decode needed
        for (const idx of neededTrackIndices) {
            const track = this.playlist[idx];
            if (!this.cache.has(track.id)) {
                if (onProgress) onProgress(`Decoding ${track.name}...`);
                try {
                    const buffer = await this.decodeTrack(ctx, track);
                    this.cache.set(track.id, { buffer, lastUsed: Date.now() });
                } catch (e) {
                    console.error(`Failed to decode ${track.name}`, e);
                    // We might want to create a silent buffer here to prevent crash?
                }
            } else {
                // Update LRU
                const entry = this.cache.get(track.id)!;
                entry.lastUsed = Date.now();
            }
        }

        // Cleanup (Evict tracks not needed and old)
        // We only evict if we are over limit AND the track is NOT in the current needed set
        if (this.cache.size > this.maxCacheSize) {
            const entries = Array.from(this.cache.entries());
            // Sort by lastUsed ascending (oldest first)
            entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
            
            for (const [id, _] of entries) {
                if (this.cache.size <= this.maxCacheSize) break;
                
                // Is this track needed right now?
                const trackIdx = this.playlist.findIndex(t => t.id === id);
                if (!neededTrackIndices.has(trackIdx)) {
                    this.cache.delete(id);
                    // console.log(`Evicted track ${id} from cache`);
                }
            }
        }
    }

    public getActiveSources(startTime: number, duration: number): { buffer: AudioBuffer, startTime: number }[] {
        const sources: { buffer: AudioBuffer, startTime: number }[] = [];
        const endTime = startTime + duration;

        for (let i = 0; i < this.playlist.length; i++) {
            const trackStart = this.trackStartTimes[i];
            const trackEnd = trackStart + this.playlist[i].duration;
            const track = this.playlist[i];

            if (trackEnd > startTime && trackStart < endTime) {
                const entry = this.cache.get(track.id);
                if (entry) {
                    sources.push({
                        buffer: entry.buffer,
                        startTime: trackStart
                    });
                }
            }
        }
        return sources;
    }

    private async decodeTrack(ctx: BaseAudioContext, track: Track): Promise<AudioBuffer> {
        const arrayBuffer = await track.file.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
    }
}
