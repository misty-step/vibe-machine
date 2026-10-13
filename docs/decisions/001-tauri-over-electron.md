# 001: Tauri over Electron

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** desktop runtime
- **Powder:** none recorded

## Context

The desktop app needs native file access, FFmpeg subprocesses, and distributable
macOS/Windows bundles. Electron bundles Chromium and complicates sharing Rust
between browser preview and native export.

## Decision

Use Tauri v2 as the desktop runtime; do not introduce Electron or a separate
native UI codebase. Tauri's Rust backend links the shared renderer and its
capability model controls IPC ([configuration](../../src-tauri/tauri.conf.json)).

## Consequences

Downloads stay smaller and Rust integration stays direct. Development requires
the Rust toolchain, and system WebViews can differ in supported web APIs.
Revisit if: system WebView limitations prevent the required desktop features.
