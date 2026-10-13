# 004: Bundle FFmpeg rather than require a user installation

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** native export
- **Powder:** none recorded

## Context

Export needs H.264/MP4 video and AAC audio from raw RGBA frames. Requiring a
user-installed FFmpeg introduces PATH, Gatekeeper, and version inconsistencies;
embedded encoders also require encoding and muxing integration.

## Decision

Bundle FFmpeg as a Tauri sidecar and pipe rendered frames through stdin in the
[export pipeline](../../src-tauri/src/export_video.rs). Do not require users to
install FFmpeg or embed a separate video encoder.

## Consequences

Export works out of the box, and rendering remains separate from encoding.
Bundles grow and platform-specific FFmpeg binaries must be maintained. Paths
need [Rust validation](005-path-guard-security.md); streaming requires careful
stdin and process lifecycle management.
Revisit if: bundled FFmpeg cannot meet export codec or distribution requirements.
