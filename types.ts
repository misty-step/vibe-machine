export interface Track {
  id: string;
  file: File;
  name: string;
  artist: string;
  duration: number;
}

export enum VisualizerMode {
  Bars = 'Bars',
  Orbital = 'Orbital',
  Wave = 'Wave'
}

export enum FontFamily {
  Geist = 'Geist Sans',
  Playfair = 'Playfair Display',
  Mono = 'JetBrains Mono',
  Inter = 'Inter',
  RobotoSlab = 'Roboto Slab',
  Cinzel = 'Cinzel',
  Montserrat = 'Montserrat'
}

export enum FontSize {
  Small = 0.8,
  Medium = 1.0,
  Large = 1.5,
  ExtraLarge = 2.0
}

export enum AspectRatio {
  SixteenNine = '16/9',
  NineSixteen = '9/16',
  OneOne = '1/1'
}

export interface VibeSettings {
  visualizerMode: VisualizerMode;
  aspectRatio: AspectRatio;
  fontFamily: FontFamily;
  fontSize: FontSize;
  showTitle: boolean;
  showProgress: boolean;
  kenBurns: boolean;
  blurBackground: boolean;
  visualizerColor: string;
  visualizerIntensity: number; // 0 to 1
}

export const PRESET_COLORS = [
  '#ffffff', // White
  '#f59e0b', // Electric Amber
  '#84cc16', // Acid Lime
  '#06b6d4', // Cyber Cyan
  '#a855f7', // Neon Purple
  '#ec4899', // Hot Pink
  '#ef4444', // Crimson
];