import { useVibeStore } from '../store/vibeStore';

export class AudioSystem {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private audioEl: HTMLAudioElement;
  
  // Singleton management
  private static instance: AudioSystem | null = null;

  private constructor() {
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = "anonymous";
    
    // Event Listeners
    this.audioEl.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audioEl.addEventListener('ended', this.handleEnded);
    this.audioEl.addEventListener('durationchange', this.handleDurationChange);
    
    // Auto-subscribe to store changes for playback control
    useVibeStore.subscribe(
        (state) => state.currentTrackId,
        (newId, oldId) => {
            if (newId !== oldId) this.loadTrack(newId);
        }
    );

    useVibeStore.subscribe(
        (state) => state.isPlaying,
        (isPlaying) => {
            if (isPlaying) this.play();
            else this.pause();
        }
    );
  }

  public static getInstance(): AudioSystem {
    if (!AudioSystem.instance) {
      AudioSystem.instance = new AudioSystem();
    }
    return AudioSystem.instance;
  }

  public getAnalyser(): AnalyserNode | null {
      return this.analyser;
  }

  private initContext() {
    if (!this.context) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioCtx();
      this.analyser = this.context.createAnalyser();
      this.gainNode = this.context.createGain();
      
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8; // Slightly faster response for "Industrial" feel

      // Chain
      this.sourceNode = this.context.createMediaElementSource(this.audioEl);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.context.destination);
    }
    
    if (this.context.state === 'suspended') {
        this.context.resume();
    }
  }

  private loadTrack(trackId: string | null) {
      if (!trackId) {
          this.audioEl.src = '';
          return;
      }

      const playlist = useVibeStore.getState().playlist;
      const track = playlist.find(t => t.id === trackId);
      
      if (track) {
          const url = URL.createObjectURL(track.file);
          this.audioEl.src = url;
          // Auto-play if we were already playing
          if (useVibeStore.getState().isPlaying) {
              this.play();
          }
      }
  }

  public async play() {
      this.initContext();
      try {
          await this.audioEl.play();
      } catch (e) {
          console.error("Playback failed", e);
          useVibeStore.getState().setIsPlaying(false);
      }
  }

  public pause() {
      this.audioEl.pause();
  }

  private handleTimeUpdate = () => {
      useVibeStore.getState().setTime(this.audioEl.currentTime);
  };

  private handleDurationChange = () => {
      useVibeStore.getState().setDuration(this.audioEl.duration);
  };

  private handleEnded = () => {
      useVibeStore.getState().selectNextTrack();
  };
}
