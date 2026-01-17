import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock window object for node environment
const mockWindow: {
  AudioContext: typeof MockAudioContext | undefined;
  webkitAudioContext: typeof MockAudioContext | undefined;
} = {
  AudioContext: undefined,
  webkitAudioContext: undefined,
};
vi.stubGlobal("window", mockWindow);

// Mock URL constructor
class MockURL {
  href: string;
  constructor(url: string) {
    this.href = url;
  }
  static createObjectURL = vi.fn(() => "blob:mock");
  static revokeObjectURL = vi.fn();
}

// Mock AudioContext
const mockAnalyser = {
  connect: vi.fn(),
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  frequencyBinCount: 1024,
  getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(0)),
};

const mockGain = {
  connect: vi.fn(),
  gain: { value: 1 },
};

const mockMediaSource = {
  connect: vi.fn(),
};

class MockAudioContext {
  state = "suspended";
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createAnalyser = vi.fn(() => mockAnalyser);
  createGain = vi.fn(() => mockGain);
  createMediaElementSource = vi.fn(() => mockMediaSource);
  destination = {};
}

class MockAudioElement {
  src = "";
  currentTime = 0;
  duration = 0;
  paused = true;
  listeners: Record<string, Array<() => void>> = {};

  addEventListener(event: string, cb: () => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  removeEventListener(event: string, cb: () => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((f) => f !== cb);
    }
  }

  play = vi.fn(async () => {
    this.paused = false;
    return Promise.resolve();
  });

  pause = vi.fn(() => {
    this.paused = true;
  });
}

// Setup global mocks before importing AudioSystem
vi.stubGlobal("AudioContext", MockAudioContext);
vi.stubGlobal("Audio", MockAudioElement);
vi.stubGlobal("URL", MockURL);

// Also set on window for browser-style access
mockWindow.AudioContext = MockAudioContext;
mockWindow.webkitAudioContext = MockAudioContext;

describe("AudioSystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton for each test by clearing the module cache
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes as singleton", async () => {
    const { AudioSystem } = await import("../engine/AudioSystem");
    const instance1 = AudioSystem.getInstance();
    const instance2 = AudioSystem.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("creates audio context on init", async () => {
    const { AudioSystem } = await import("../engine/AudioSystem");
    const instance = AudioSystem.getInstance();
    expect(instance).toBeTruthy();
  });

  it("provides analyser node after unlock", async () => {
    const { AudioSystem } = await import("../engine/AudioSystem");
    const instance = AudioSystem.getInstance();

    // Analyser is null before context init (lazy initialization)
    expect(instance.getAnalyser()).toBeNull();

    // Unlock initializes the audio context and graph
    await instance.unlock();

    // Now analyser should be available
    expect(instance.getAnalyser()).toBeTruthy();
  });
});
