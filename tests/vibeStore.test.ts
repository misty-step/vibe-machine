import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-store", () => {
  class MockLazyStore {
    constructor(_path: string) {}
    async get<T>(_key: string): Promise<T | null> {
      return null;
    }
    async set(_key: string, _value: unknown) {}
    async save() {}
  }

  return { LazyStore: MockLazyStore };
});

let useVibeStore: typeof import("../store/vibeStore").useVibeStore;

const loadStore = async () => {
  if (!useVibeStore) {
    ({ useVibeStore } = await import("../store/vibeStore"));
  }
  return useVibeStore;
};

const makeTrack = (id: string) => ({
  id,
  name: `Track ${id}`,
  artist: "",
  duration: 120,
});

describe("vibeStore reorderTracks", () => {
  beforeEach(async () => {
    const store = await loadStore();
    store.setState({ playlist: [], currentTrackId: null });
  });

  it("reorders tracks by index", () => {
    const store = useVibeStore;
    const a = makeTrack("a");
    const b = makeTrack("b");
    const c = makeTrack("c");
    store.setState({ playlist: [a, b, c] });

    store.getState().reorderTracks(0, 2);

    expect(store.getState().playlist.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps current track id stable after reorder", () => {
    const store = useVibeStore;
    const a = makeTrack("a");
    const b = makeTrack("b");
    store.setState({ playlist: [a, b], currentTrackId: "b" });

    store.getState().reorderTracks(1, 0);

    expect(store.getState().currentTrackId).toBe("b");
  });

  it("ignores invalid indices", () => {
    const store = useVibeStore;
    const a = makeTrack("a");
    const b = makeTrack("b");
    store.setState({ playlist: [a, b] });

    store.getState().reorderTracks(-1, 1);
    store.getState().reorderTracks(0, 9);

    expect(store.getState().playlist.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
