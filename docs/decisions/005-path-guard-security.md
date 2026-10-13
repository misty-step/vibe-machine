# 005: Validate IPC paths in Rust before file access

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** path_guard, native export
- **Powder:** none recorded

## Context

Export receives audio and output paths from untrusted frontend JavaScript.
Frontend-only validation cannot prevent traversal, symlink attacks, or filenames
being interpreted as FFmpeg arguments.

## Decision

Validate all IPC paths in Rust before file operations or subprocess spawning.
Use [path_guard](../../src-tauri/src/path_guard.rs) and `guard_export_paths()`
for export; frontend checks and Tauri scopes alone are insufficient.

## Consequences

Audio paths must be absolute, canonicalize, and identify a file. Output paths
must be absolute MP4 paths with an existing directory parent and no dash-prefixed
filename. Commands must handle guarded paths and human-readable errors; new
path-handling IPC commands need similar guards and edge-case tests.
Revisit if: export path requirements change or these guards cannot address a
new path-related threat.
