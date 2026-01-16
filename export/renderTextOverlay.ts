import { VibeSettings, Track } from "../types";
import { drawTitleArtist, mapFontFamily, mapFontSize } from "../utils/overlayText";

const ensureFontLoaded = async (settings: VibeSettings) => {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const family = mapFontFamily(settings.fontFamily);
  const titleSize = mapFontSize(settings.fontSize);
  const artistSize = Math.floor(titleSize * 0.55);
  await document.fonts.load(`600 ${titleSize}px ${family}`);
  await document.fonts.load(`500 ${artistSize}px ${family}`);
  await document.fonts.ready;
};

export const renderTextOverlay = async (
  settings: VibeSettings,
  track: Track | null,
  width: number,
  height: number
): Promise<string> => {
  if (!settings.showTitle) return "";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  await ensureFontLoaded(settings);
  ctx.clearRect(0, 0, width, height);
  drawTitleArtist(ctx, settings, track, width, height);

  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.split(",")[1] ?? "";
};
