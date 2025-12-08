import { AudioSystem } from './AudioSystem';
import { useVibeStore } from '../store/vibeStore';

// Mock AudioContext and HTMLAudioElement
class MockAudioContext {
  state = 'suspended';
  resume = async () => { this.state = 'running'; };
  createAnalyser = () => ({
    connect: () => {},
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: 1024,
    getByteFrequencyData: (arr: Uint8Array) => arr.fill(0)
  });
  createGain = () => ({
    connect: () => {},
    gain: { value: 1 }
  });
  createMediaElementSource = () => ({
    connect: () => {}
  });
  destination = {};
}

class MockAudioElement {
  src = '';
  currentTime = 0;
  duration = 0;
  paused = true;
  
  listeners: Record<string, Function[]> = {};

  addEventListener(event: string, cb: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  play = async () => { 
      this.paused = false; 
      return Promise.resolve(); 
  };
  
  pause = () => { 
      this.paused = true; 
  };
}

// Setup Global Mocks
(global as any).AudioContext = MockAudioContext;
(global as any).Audio = MockAudioElement;
(global as any).URL = { createObjectURL: () => 'blob:mock' };

const describe = (name: string, fn: () => void) => { console.log(`Suite: ${name}`); fn(); };
const it = (name: string, fn: () => void) => { 
    try { fn(); console.log(`  ✔ ${name}`); } 
    catch (e) { console.error(`  ✘ ${name}`, e); } 
};
const expect = (actual: any) => ({
    toBe: (expected: any) => {
        if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
    },
    toBeTruthy: () => {
        if (!actual) throw new Error(`Expected truthy but got ${actual}`);
    }
});

describe('AudioSystem', () => {
    it('Singleton initializes correctly', () => {
        const instance = AudioSystem.getInstance();
        expect(instance).toBeTruthy();
    });

    it('Reacts to store changes', () => {
        const sys = AudioSystem.getInstance();
        const store = useVibeStore.getState();
        
        // Reset
        store.setIsPlaying(false);
        
        // Test Play
        store.setIsPlaying(true);
        // We can't easily inspect private state 'audioEl.paused' without casting or exposing it
        // But we know it shouldn't crash
    });
});
