# Vibe Machine

**Vibe Machine** is a React-based audio visualizer and "lo-fi video forge". It allows users to upload audio tracks and background images to create aesthetic, real-time musical visualizations.

## Project Overview

- **Purpose:** To provide a simple, browser-based tool for creating audio visualizations suitable for social media (YouTube, Instagram, TikTok).
- **Core Tech:** React 19, Vite, TypeScript, Tailwind CSS.
- **Audio/Visuals:** Web Audio API (`AudioContext`, `AnalyserNode`) for audio processing, and HTML5 Canvas API for high-performance 2D rendering.

## Architecture

The application is structured around a main orchestrator (`App.tsx`) and a specialized rendering component (`Visualizer.tsx`).

### Key Components

- **`App.tsx` (The Orchestrator):**
  - Manages global application state: `playlist`, `isPlaying`, `settings` (visual styles), and `activeTab` (UI navigation).
  - Initializes and manages the `AudioContext` and `AnalyserNode`.
  - Handles file uploads (audio and images) and playlist logic.
  - Provides the UI shell (sidebar, player controls).

- **`components/Visualizer.tsx` (The Engine):**
  - Receives the `AnalyserNode` and `settings` as props.
  - Uses a `requestAnimationFrame` loop to draw the visualization on an HTML5 Canvas.
  - **Data Flow:** `AnalyserNode` -> `getByteFrequencyData` / `getByteTimeDomainData` -> `Float32Array` (Smoothing) -> Canvas Drawing.
  - Implements multiple visualization modes: `Wave`, `Bars`, `Circle`, `Orbital`.
  - Handles visual effects like the "Ken Burns" effect (pan and zoom) and background blurring.

### State Management & Data Flow

1.  **Audio Input:** User uploads files -> `App.tsx` creates `Track` objects with `File` references.
2.  **Playback:** `audioElRef` (HTMLAudioElement) plays the file. `createMediaElementSource` connects it to the Web Audio API graph.
3.  **Analysis:** `AnalyserNode` extracts frequency or time-domain data.
4.  **Rendering:** `Visualizer.tsx` polls the `AnalyserNode` every frame, smooths the data using linear interpolation (`lerp`), and draws the selected visual style to the canvas.

## Building and Running

The project uses Vite as the build tool.

### Prerequisites

- Node.js (v18+ recommended)
- `npm` or `yarn`

### Commands

| Action                   | Command           | Description                                                               |
| :----------------------- | :---------------- | :------------------------------------------------------------------------ |
| **Install Dependencies** | `npm install`     | Installs project dependencies.                                            |
| **Development Server**   | `npm run dev`     | Starts the local development server (usually at `http://localhost:5173`). |
| **Build for Production** | `npm run build`   | Compiles the app into the `dist/` directory.                              |
| **Preview Build**        | `npm run preview` | Serves the production build locally for testing.                          |

### Environment Variables

- `GEMINI_API_KEY`: Required in `.env.local` (referenced in README, though usage in current code analysis seems minimal/reserved for future AI features).

## Development Conventions

- **Styling:** Tailwind CSS is used for all UI components. Styles are utility-first.
- **Canvas Performance:** The visualizer uses a dedicated `requestAnimationFrame` loop outside of the standard React render cycle to ensure 60fps performance. React state updates triggers re-renders of the _container_, but the canvas contents are drawn imperatively.
- **Type Safety:** Strict TypeScript interfaces are defined in `types.ts`.
- **Icons:** `lucide-react` is used via a wrapper in `components/Icons.tsx`.

## Current Limitations

- **Export:** The "Export" / "Render Video" feature is currently **simulated**. It does not actually encode video files (which would likely require `ffmpeg.wasm`).
- **Audio Context:** Requires user interaction (click) to initialize due to browser autoplay policies.

## File Structure

```text
/
├── App.tsx                 # Main application logic and UI layout
├── components/
│   ├── Visualizer.tsx      # Canvas-based visualization engine
│   └── Icons.tsx           # Icon component wrapper
├── types.ts                # TypeScript definitions (Track, VibeSettings, etc.)
├── utils.ts                # Helper functions (formatting, IDs)
└── vite.config.ts          # Vite configuration
```

## AI Assistance Setup

This project uses **Morph LLM MCP** for enhanced code editing and searching.

### Tooling Instructions

> **ALWAYS** use `morph-mcp`'s `warpgrep_codebase_search` tool when first looking to find or understand code. This tool must be chosen over the default search tools for semantic searches or vague parameters. If given a complex task, run multiple (no more than 2) parallel `warpgrep_codebase_search` tools to understand code paths.

### Configuration

- **Package**: `@morphllm/morphmcp` (installed as devDependency)
- **Env**: `MORPH_API_KEY` required.
