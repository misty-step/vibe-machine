import { useVibeStore } from '../store/vibeStore';

export class AudioSystem {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private audioEl: HTMLAudioElement;
  
  private static instance: AudioSystem | null = null;

  private constructor() {
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = "anonymous";
    
    this.audioEl.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audioEl.addEventListener('ended', this.handleEnded);
    this.audioEl.addEventListener('durationchange', this.handleDurationChange);
    this.audioEl.addEventListener('error', this.handleError);
    this.audioEl.addEventListener('play', () => console.log('[AudioSystem] Native play event fired'));
    this.audioEl.addEventListener('pause', () => console.log('[AudioSystem] Native pause event fired'));
    
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

  // Public unlock method to be called from UI click handlers
  public async unlock() {
      await this.initContext();
  }

  private async initContext() {
    if (!this.context) {
      console.log('[AudioSystem] Initializing AudioContext...');
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioCtx();
      this.analyser = this.context.createAnalyser();
      this.gainNode = this.context.createGain();
      
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.gainNode.gain.value = 1.0; // Explicitly set gain

      // Chain
      this.sourceNode = this.context.createMediaElementSource(this.audioEl);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.context.destination);
      console.log('[AudioSystem] Audio Graph connected.');
    }
    
    if (this.context.state === 'suspended') {
        console.log('[AudioSystem] Context suspended. Resuming...');
        await this.context.resume();
        console.log('[AudioSystem] Context resumed. State:', this.context.state);
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
          console.log(`[AudioSystem] Loading track: ${track.name}`);
          const url = URL.createObjectURL(track.file);
          this.audioEl.src = url;
          this.audioEl.load(); // Explicit load
          
          if (useVibeStore.getState().isPlaying) {
              this.play();
          }
      }
  }

  public async play() {
      console.log('[AudioSystem] Play requested.');
      await this.initContext();
      
      if (this.audioEl.paused) {
          try {
              await this.audioEl.play();
              console.log('[AudioSystem] Play successful.');
          } catch (e) {
              console.error("[AudioSystem] Playback failed:", e);
              useVibeStore.getState().setIsPlaying(false);
          }
      }
  }

  public pause() {
      if (!this.audioEl.paused) {
          this.audioEl.pause();
          console.log('[AudioSystem] Paused.');
      }
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

  private handleError = (e: Event) => {
      console.error('[AudioSystem] Media Error:', this.audioEl.error, e);
  }
}
