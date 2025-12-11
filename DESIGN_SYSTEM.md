# VIBE MACHINE: Design System 2.0 (Holographic Industrial)

> **Philosophy:** The interface should feel like a physical instrument from a near-future timeline. Tactile, precise, and glowing. Less "Software", more "Hardware".

## 1. Visual Foundations

### Color Palette

We are moving from flat colors to **Radiance**.

| Token      | Value                    | Usage                                                     |
| :--------- | :----------------------- | :-------------------------------------------------------- |
| **Void**   | `#030304`                | Main background. Deeper than Obsidian.                    |
| **Carbon** | `#0a0a0b`                | Component backgrounds (Cards, Sidebar).                   |
| **Plasma** | `#ffb703`                | **Primary Accent.** A warmer, electric amber.             |
| **Flux**   | `#0ea5e9`                | **Secondary Accent.** Cyan for "Active/Recording" states. |
| **Vapor**  | `rgba(255,255,255,0.03)` | Subtle surface fills.                                     |
| **Glass**  | `rgba(255,255,255,0.08)` | Borders and highlights.                                   |

### Typography

**Font:** `Geist Sans` (UI) + `JetBrains Mono` (Data).

- **Display:** 12px, All Caps, Wide Tracking (`tracking-widest`), 600 Weight.
- **Body:** 13px, Regular, `text-zinc-400`.
- **Data:** 10px, Mono, `text-plasma`.

### Depth & Texture

The "Flat" look is dead. We introduce **Micro-Depth**.

- **Inner Glow:** All containers have an inner white border (`box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.05)`).
- **Backdrop Blur:** Heavy blur (`backdrop-blur-2xl`) on floating elements.
- **Noise:** Keep the film grain but reduce opacity to `0.02` for subtlety.

---

## 2. Component Architecture

### The "Deck" (Sidebar)

Instead of a list, the Sidebar becomes a **Control Deck**.

- **Structure:** A rigid Grid system (Bento Box style).
- **Inputs:** Chunky, full-width touch targets.
- **Active States:** Glowing borders, not just color changes.

### The "Lens" (Visualizer)

- **Frame:** A "Camera Viewfinder" aesthetic. Corner brackets, REC indicators, grid overlays.
- **Isolation:** The visualizer sits in a deep inset container (`shadow-inner`), emphasizing depth.

### The "Transport" (Player Controls)

- **Design:** Inspired by Teenage Engineering / Braun design.
- **Shape:** Rectilinear, not rounded pills. Mechanical feel.
- **Feedback:** Instant active state response (scale 0.98).

---

## 3. UX Enhancements

- **Transitions:**
  - `duration-200 ease-out` for hover.
  - `duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)` for layout shifts.
- **Empty States:** The "Ignite" screen (already implemented) will be styled to match the new "Void" palette.
- **Drag & Drop:** Whole-screen "Holographic Mesh" overlay when dragging files.

---

## 4. Implementation Plan

1.  **Global CSS:** Update `index.css` with new variables and utility classes for "Inner Glow" and "Plasma".
2.  **Layout Refactor:** Convert `Sidebar.tsx` to use the Grid/Deck layout.
3.  **Controls Redesign:** Rebuild `PlayerControls.tsx` as a mechanical bar.
4.  **Viewfinder:** Add SVG overlays to the `Visualizer` container in `App.tsx`.
