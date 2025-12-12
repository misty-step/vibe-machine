/**
 * Platform detection and dynamic Tauri API imports.
 * Keeps web preview alive by isolating Tauri dependencies behind runtime checks.
 */

/** Check if running inside Tauri environment */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/** Dynamic import for Tauri dialog APIs */
export async function tauriDialogs(): Promise<{
  open: (opts: {
    filters?: Array<{ name: string; extensions: string[] }>;
    multiple?: boolean;
  }) => Promise<string | string[] | null>;
  save: (opts: {
    filters?: Array<{ name: string; extensions: string[] }>;
    defaultPath?: string;
  }) => Promise<string | null>;
}> {
  const { open, save } = await import("@tauri-apps/plugin-dialog");
  return { open, save };
}

/** Dynamic import for Tauri invoke */
export async function tauriInvoke(): Promise<
  <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke;
}

/** Dynamic import for Tauri event listener */
export async function tauriListen(): Promise<
  <T>(event: string, handler: (e: { payload: T }) => void) => Promise<() => void>
> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen;
}
