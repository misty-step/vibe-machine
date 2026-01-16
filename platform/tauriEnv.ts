/**
 * Platform detection and dynamic Tauri API imports.
 * Keeps web preview alive by isolating Tauri dependencies behind runtime checks.
 */

/** Check if running inside Tauri environment */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri v2 always injects __TAURI_INTERNALS__; __TAURI__ only when withGlobalTauri=true.
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export function normalizeFilePath(path: string): string {
  if (path.startsWith("file://")) {
    let stripped = decodeURIComponent(path.replace("file://", ""));
    if (/^\/[A-Za-z]:\//.test(stripped)) stripped = stripped.slice(1);
    return stripped;
  }
  return path;
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

/** Dynamic import for Tauri convertFileSrc */
export async function tauriConvertFileSrc(): Promise<
  (filePath: string, protocol?: string) => string
> {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc;
}

/** Dynamic import for Tauri event listener */
export async function tauriListen(): Promise<
  <T>(event: string, handler: (e: { payload: T }) => void) => Promise<() => void>
> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen;
}
