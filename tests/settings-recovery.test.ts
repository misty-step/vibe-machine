import { beforeEach, describe, expect, it, vi } from "vitest";

const persistence = vi.hoisted(() => ({
  read: vi.fn(),
  set: vi.fn(),
  save: vi.fn(),
  desktop: true,
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get = persistence.read;
    set = persistence.set;
    save = persistence.save;
  },
}));
vi.mock("../platform/tauriEnv", () => ({
  isTauri: () => persistence.desktop,
  tauriInvoke: async () => persistence.read,
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.resetModules();
  persistence.read.mockReset().mockResolvedValue({ visualizerColor: "#123456", showTitle: false });
  persistence.set.mockReset().mockResolvedValue(undefined);
  persistence.save.mockReset().mockResolvedValue(undefined);
  persistence.desktop = true;
});

describe("settings recovery", () => {
  it("does not write unread preferences after a read failure or repeated failures", async () => {
    persistence.read.mockRejectedValue(new Error("private path must not appear in UI"));
    const { useVibeStore: store } = await import("../store/vibeStore");
    await store.getState().initialize();
    store.getState().updateSettings({ showProgress: false });
    await flush();
    expect(persistence.set).not.toHaveBeenCalled();
    expect(persistence.save).not.toHaveBeenCalled();
    expect(store.getState().settingsError).toContain("could not be loaded");
    expect(store.getState().settingsError).not.toContain("private path");
    await store.getState().initialize();
    expect(persistence.set).not.toHaveBeenCalled();
    expect(store.getState().settings.showProgress).toBe(false);
  });

  it("explicit retry recovers saved preferences and only overlays session edits", async () => {
    persistence.read.mockRejectedValueOnce(new Error("unavailable"));
    const { useVibeStore: store } = await import("../store/vibeStore");
    await store.getState().initialize();
    store.getState().updateSettings({ showProgress: false });
    await store.getState().initialize();
    expect(store.getState().settings).toMatchObject({
      visualizerColor: "#123456",
      showTitle: false,
      showProgress: false,
      kenBurns: true,
    });
    expect(persistence.read).toHaveBeenLastCalledWith("load_settings");
    expect(persistence.set).toHaveBeenCalledTimes(1);
    expect(persistence.set).toHaveBeenCalledWith("settings", store.getState().settings);
    expect(persistence.save).toHaveBeenCalledTimes(1);
    expect(store.getState().settingsError).toBeNull();
  });

  it("shares one pending read and preserves edits made while it is loading", async () => {
    const read = deferred<{ showTitle: boolean }>();
    persistence.read.mockReturnValue(read.promise);
    const { useVibeStore: store } = await import("../store/vibeStore");
    const first = store.getState().initialize();
    const second = store.getState().initialize();
    expect(first).toBe(second);
    store.getState().updateSettings({ visualizerColor: "#abcdef" });
    read.resolve({ showTitle: false });
    await first;
    expect(persistence.read).toHaveBeenCalledTimes(1);
    expect(store.getState().settings).toMatchObject({
      showTitle: false,
      visualizerColor: "#abcdef",
    });
    expect(persistence.set).toHaveBeenCalledTimes(1);
    await store.getState().initialize();
    expect(persistence.read).toHaveBeenCalledTimes(1);
    expect(persistence.set).toHaveBeenCalledTimes(1);
  });

  it("does not save a successful unchanged read", async () => {
    const { useVibeStore: store } = await import("../store/vibeStore");
    await store.getState().initialize();
    expect(store.getState().settings.showTitle).toBe(false);
    expect(store.getState().settings.kenBurns).toBe(true);
    expect(persistence.set).not.toHaveBeenCalled();
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it("awaits each set before saving and serializes subsequent edits", async () => {
    const set = deferred<void>();
    persistence.set.mockReturnValueOnce(set.promise);
    const { useVibeStore: store } = await import("../store/vibeStore");
    await store.getState().initialize();
    store.getState().updateSettings({ visualizerColor: "#aaaaaa" });
    store.getState().updateSettings({ visualizerColor: "#bbbbbb" });
    await flush();
    expect(persistence.set).toHaveBeenCalledTimes(1);
    expect(persistence.save).not.toHaveBeenCalled();
    set.resolve();
    await flush();
    expect(persistence.set).toHaveBeenCalledTimes(2);
    expect(persistence.save).toHaveBeenCalledTimes(2);
    expect(persistence.set.mock.calls[1][1].visualizerColor).toBe("#bbbbbb");
  });

  it("keeps edits visible on save failure and retries without rereading stale disk state", async () => {
    persistence.save.mockRejectedValueOnce(new Error("private disk detail"));
    const { useVibeStore: store } = await import("../store/vibeStore");
    await store.getState().initialize();
    store.getState().updateSettings({ showTitle: true });
    await flush();
    expect(store.getState().settingsError).toContain("could not be saved");
    expect(store.getState().settingsError).not.toContain("private disk detail");
    expect(store.getState().settings.showTitle).toBe(true);
    await store.getState().initialize();
    expect(persistence.read).toHaveBeenCalledTimes(1);
    expect(persistence.save).toHaveBeenCalledTimes(2);
    expect(store.getState().settingsError).toBeNull();
  });

  it("reports a failed set without saving and recovers on the next edit", async () => {
    persistence.set.mockRejectedValueOnce(new Error("unavailable"));
    const { useVibeStore: store } = await import("../store/vibeStore");
    await store.getState().initialize();
    store.getState().updateSettings({ showTitle: true });
    await flush();
    expect(persistence.save).not.toHaveBeenCalled();
    expect(store.getState().settingsError).toContain("could not be saved");
    store.getState().updateSettings({ showProgress: false });
    await flush();
    expect(persistence.save).toHaveBeenCalledTimes(1);
    expect(store.getState().settingsError).toBeNull();
  });

  it("keeps browser preview usable without native persistence", async () => {
    persistence.desktop = false;
    const { useVibeStore: store } = await import("../store/vibeStore");
    await store.getState().initialize();
    store.getState().updateSettings({ showTitle: false });
    await flush();
    expect(store.getState().settings.showTitle).toBe(false);
    expect(persistence.read).not.toHaveBeenCalled();
    expect(persistence.set).not.toHaveBeenCalled();
  });
});
