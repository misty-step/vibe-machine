# ADR 005: Rust Path Validation for IPC Security

**Date**: 2024-12 (Commit `85b06b8`)
**Status**: Accepted

## Context

The `export_video` Tauri command receives paths from untrusted frontend JavaScript:

- `audio_path`: File to decode
- `output_path`: File to write (passed to FFmpeg)

Malicious or buggy frontend code could attempt:

- Path traversal (`../../../etc/passwd`)
- Symlink attacks
- Argument injection via filenames starting with `-`
- Writing outside expected directories

## Decision

Create a dedicated `path_guard` module that validates ALL IPC paths BEFORE any file operations or subprocess spawning.

## Rationale

1. **Defense in depth**: Even if frontend validation fails, Rust layer rejects bad paths.

2. **Centralized validation**: Single `guard_export_paths()` function handles all checks. Easy to audit, test, and extend.

3. **Fail-safe design**: Function returns `Result<GuardedExportPaths, String>`. Code cannot accidentally use unvalidated paths.

4. **FFmpeg-specific hardening**: Filenames starting with `-` could be interpreted as FFmpeg flags. Explicitly rejected.

## Validation Rules

```rust
// Audio path:
- Must be absolute
- Must canonicalize successfully (resolves symlinks, validates existence)
- Must be a file (not directory)

// Output path:
- Must be absolute
- Must end with .mp4 (case-insensitive)
- Filename cannot start with '-'
- Parent directory must exist and be a directory
```

## Alternatives Considered

- **Frontend-only validation**: Insufficient. JS can be bypassed.
- **Tauri's built-in scope**: Insufficient granularity for export paths.
- **Sandboxed subprocess**: Overkill for this use case; FFmpeg needs file access.

## Consequences

- All new IPC commands handling paths must use similar guards
- Slightly more verbose command implementations (must destructure `GuardedExportPaths`)
- Test coverage required for edge cases (symlinks, Unicode paths, etc.)
- Error messages are human-readable (returned to frontend for display)

## Test Coverage

```rust
#[test] fn accepts_valid_paths() { ... }
#[test] fn rejects_relative_audio_path() { ... }
#[test] fn rejects_nonexistent_audio() { ... }
#[test] fn rejects_audio_directory() { ... }
#[test] fn rejects_relative_output_path() { ... }
#[test] fn rejects_non_mp4_extension() { ... }
#[test] fn accepts_uppercase_mp4_extension() { ... }
#[test] fn rejects_dash_prefixed_filename() { ... }
#[test] fn rejects_missing_output_parent() { ... }
```

## References

- `src-tauri/src/path_guard.rs`: Implementation and tests
- `src-tauri/src/export_video.rs`: Usage (`guard_export_paths()` call)
- Commit `85b06b8`: Initial implementation
