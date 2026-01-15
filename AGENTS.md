# Repository Guidelines

## Project Structure & Module Organization

- `App.tsx`, `index.tsx`, `index.css`: app entry and global styles.
- `components/`, `hooks/`, `store/`: React UI, custom hooks, Zustand state.
- `crates/vibe-engine/`: Rust render core. Shared by WASM + native.
- `src/vibe-engine-wasm/`: generated WASM output. Do not hand-edit.
- `src-tauri/`: Tauri desktop app, native export pipeline.
- `tests/` and root `*.test.ts`: Vitest suites.
- `public/`, `site/`: static assets and landing page.

## Build, Test, and Development Commands

- `pnpm dev`: Vite web preview.
- `pnpm tauri dev`: full desktop app with hot reload.
- `pnpm build:wasm`: compile Rust to WASM for preview.
- `pnpm build`: WASM + Vite bundle.
- `pnpm tauri build`: package desktop app.
- `pnpm test` / `pnpm test:run`: Vitest watch / CI run.
- `pnpm test:coverage`: coverage run.
- `pnpm lint` / `pnpm format`: ESLint + Prettier.
- `pnpm type-check`: TypeScript `tsc --noEmit`.
- Rust: `cargo build --manifest-path=crates/vibe-engine/Cargo.toml` or `src-tauri/Cargo.toml`.

## Coding Style & Naming Conventions

- TypeScript/React: Prettier + ESLint. 2-space indent, semicolons, double quotes.
- Components in PascalCase (`PlayerControls.tsx`). Hooks `useX`. Stores `*Store`.
- Rust: rustfmt defaults. Types PascalCase, modules snake_case.
- Prefer small, focused modules. Avoid pass-through wrappers.

## Testing Guidelines

- Framework: Vitest. Tests in `tests/` or `*.test.ts`.
- Run targeted tests first, then `pnpm test:run`.
- Coverage: no enforced threshold in repo; cover new logic and edge paths.
- Rust tests: `cargo test --manifest-path=crates/vibe-engine/Cargo.toml` as needed.

## Commit & Pull Request Guidelines

- Commit style: Conventional Commits with optional scope. Example: `feat(site): add install step`.
- PRs: short summary, test notes, screenshots for UI changes, link issues when present.
- Keep diffs small; split large work into stacked PRs when possible.

## Architecture Overview

- One Rust core drives both preview and export. WASM for React canvas, native for FFmpeg export.
- Tauri commands in `src-tauri/src/`. UI orchestrates audio + settings in React.
