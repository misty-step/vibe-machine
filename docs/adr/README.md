# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting significant architectural decisions in Vibe Machine.

## Index

| ADR                                           | Title                                        | Status            |
| --------------------------------------------- | -------------------------------------------- | ----------------- |
| [0001](./0001-shared-rust-renderer.md)        | Shared Rust Renderer (brief)                 | Superseded by 002 |
| [001](./001-tauri-over-electron.md)           | Tauri v2 Over Electron                       | Accepted          |
| [002](./002-shared-rust-vibe-engine.md)       | Shared Rust Crate for WASM and Native        | Accepted          |
| [003](./003-symphonia-audio-decode.md)        | Symphonia for Audio Decoding                 | Accepted          |
| [004](./004-ffmpeg-sidecar-export.md)         | FFmpeg Sidecar for Video Export              | Accepted          |
| [005](./005-path-guard-security.md)           | Rust Path Validation for IPC Security        | Accepted          |
| [006](./006-zustand-store-architecture.md)    | Zustand Store with Tauri Persistence         | Accepted          |
| [007](./007-platform-abstraction-pattern.md)  | Platform Abstraction for Web/Tauri Dual-Mode | Accepted          |
| [008](./008-export-controller-deep-module.md) | ExportController as Deep Module              | Accepted          |
| [009](./009-audio-system-singleton.md)        | AudioSystem Singleton Pattern                | Accepted          |

## ADR Format

Each ADR follows this structure:

- **Context**: What problem or situation prompted this decision?
- **Decision**: What did we decide to do?
- **Rationale**: Why this approach over alternatives?
- **Alternatives Considered**: What else was evaluated?
- **Consequences**: What are the implications, trade-offs, and follow-on requirements?

## When to Write an ADR

Write an ADR when:

- Future readers will ask "why?" (non-obvious choice)
- Alternatives were seriously considered
- Decision constrains future options
- Getting it wrong would be expensive to reverse

Don't write an ADR for:

- Obvious choices (using React for UI)
- Easily reversible decisions (CSS class naming)
- Implementation details (specific loop optimization)
