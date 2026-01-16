import { FontFamily, FontSize, Track, VibeSettings } from "../types";

export const mapFontSize = (size: FontSize) => {
  switch (size) {
    case FontSize.Small:
      return 36;
    case FontSize.Medium:
      return 48;
    case FontSize.Large:
      return 60;
    case FontSize.ExtraLarge:
      return 72;
    default:
      return 48;
  }
};

export const mapFontFamily = (family: FontFamily) => {
  switch (family) {
    case FontFamily.Playfair:
      return "Playfair Display";
    case FontFamily.Mono:
      return "JetBrains Mono";
    case FontFamily.Inter:
      return "Inter";
    case FontFamily.RobotoSlab:
      return "Roboto Slab";
    case FontFamily.Cinzel:
      return "Cinzel";
    case FontFamily.Montserrat:
      return "Montserrat";
    case FontFamily.Geist:
    default:
      return "Geist Sans, sans-serif";
  }
};

export const drawTitleArtist = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  settings: VibeSettings,
  currentTrack: Track | null,
  width: number,
  height: number
) => {
  if (!settings.showTitle) return;
  const padding = 32;
  const titleFontSize = mapFontSize(settings.fontSize);
  const title = currentTrack?.name || "Untitled";
  const artist = currentTrack?.artist || "";

  const barsBaseline = height - 80;
  const titleArtistGap = 12;
  const artistFontSize = Math.floor(titleFontSize * 0.55);
  const artistY = barsBaseline - artistFontSize;
  const titleY = artistY - titleArtistGap - titleFontSize;

  ctx.textBaseline = "top";
  ctx.font = `600 ${titleFontSize}px ${mapFontFamily(settings.fontFamily)}`;
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(title, padding, titleY);

  if (artist) {
    ctx.font = `500 ${artistFontSize}px ${mapFontFamily(settings.fontFamily)}`;
    ctx.fillStyle = "rgba(248,250,252,0.65)";
    ctx.fillText(artist, padding, artistY);
  }
};
