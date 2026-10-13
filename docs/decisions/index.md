# Decisions

A steering veto list. Open it before proposing a new primitive, surface, or
storage home. Write a record after deciding _not_ to build something the next
agent will otherwise re-propose. Do not write one per PR. Start from
[0000-template.md](0000-template.md).

## Steering

- [001](001-tauri-over-electron.md): Tauri over Electron.
- [002](002-shared-rust-vibe-engine.md): one Rust renderer for preview and export.
- [004](004-ffmpeg-sidecar-export.md): bundle FFmpeg rather than require a user installation.
- [005](005-path-guard-security.md): validate IPC paths in Rust before file access.
- [006](006-zustand-store-architecture.md): keep app state in one Zustand store.
- [007](007-platform-abstraction-pattern.md): isolate Tauri APIs behind runtime helpers.
- [008](008-export-controller-deep-module.md): keep export orchestration out of React components.
- [009](009-audio-system-singleton.md): one AudioSystem owns the audio lifecycle.

## Historical

Former ADRs; their numbers stay reserved. Original prose is retained; the
superseded renderer brief's link to 002 is adjusted for its new location.

- [003](historical/003-symphonia-audio-decode.md): Symphonia library selection for native audio decoding.
- [0010](historical/0010-shared-rust-renderer.md): superseded shared renderer brief (formerly 0001; renumbered because it was dated later than 001, Tauri over Electron).

## Migration provenance

The originals are preserved in commit
`9ddf2dcb59119282181f3ede4b7b19d1474dfbbc`, before the migration.
Steering records 001, 002, and 004–009 retain their original filenames from
`docs/adr/`. Git may show their condensed rewrites as deletions and additions
because rename detection depends on content similarity, even when a move is
used. Retrieve an original explicitly, for example:

```sh
git show 9ddf2dcb59119282181f3ede4b7b19d1474dfbbc:docs/adr/001-tauri-over-electron.md
```

Historical 003 retains its original filename; historical 0010 came from
`docs/adr/0001-shared-rust-renderer.md` in that commit.

Migrated steering records retain `2024-12`, the precision given by their
originals. Date validation must accept `YYYY-MM` for these migrated records;
adding a day would invent information. New records use `YYYY-MM-DD`.
Primitive names are provisional until `docs/architecture/primitives.yaml`
exists; `tauri` names the desktop runtime selected by 001.
