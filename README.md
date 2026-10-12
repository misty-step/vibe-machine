# Vibe Machine

Tauri desktop app for creating cinematic audio visualizations with 4K/60fps video export.

## Quick Start

```bash
# Install (macOS)
brew install misty-step/tap/vibe-machine

# Or build from source
pnpm install
pnpm tauri dev          # Full desktop app with hot reload
```

Drop an audio file, drop a background image, hit play. Export to MP4 when ready.

## Why

Turn music into shareable video. Real-time preview at 60fps, then export frame-perfect 4K video with the same Rust renderer. No quality gap between preview and final output.

## Architecture

Same Rust code powers both preview and export:

```
vibe-engine (Rust crate)
├── WASM target → React canvas preview (60fps)
└── Native target → FFmpeg pipe (4K/60fps export)
```

Key modules:

- `crates/vibe-engine/` - Pure Rust visualizer: `f(state, freq_data) → pixels`
- `src-tauri/` - Desktop shell, FFmpeg piping, audio decode
- `App.tsx` - React orchestrator: Web Audio, file handling, UI

See `CLAUDE.md` for full architecture details.

## Development

```bash
pnpm dev                # Vite only (web preview, no export)
pnpm tauri dev          # Full desktop app
pnpm build:wasm         # Rebuild WASM after Rust changes
pnpm tauri build        # Package .app/.exe
```

## Releases

GitHub Releases is the canonical origin for signed release metadata and macOS
DMGs. The `misty-step/tap` Homebrew cask follows the latest published GitHub
release. Automation also refreshes `vibe-machine-latest.dmg` on the latest
GitHub release for consumers that need a stable URL; release artifacts are not
mirrored to another public object store.

## Public site

The public experience is the install-command landing page in `site/`, not the
root Vite preview or Tauri application. The former DigitalOcean Node process
ran this subproject at revision `d86e970350cb464be2b882e141b8518270e60f53`.
Its homepage matches that source except for the canonical domain; the favicon
and legacy observer match byte-for-byte. The existing Cloudflare landing page
matches current `site/index.html`, `site/favicon.svg`, and `site/sentry.js`.
The approved Sentry cutover replaces the old observer; no UI or media workflow
is changed by moving the aliases.

`site/wrangler.jsonc` owns the existing `vibe-machine-site` Worker and its three
custom domains: `vibe-machine.mistystep.io`, `vibecheck.design`, and
`www.vibecheck.design`. Each serves the page directly, with the same canonical
URL, rather than redirecting visitors. Static bytes come from Workers Assets;
the Worker runs the shared health and monitoring-config handlers locally.
There is no app database, user upload, WebSocket, or authentication callback
in this landing site. Browser monitoring goes directly to Sentry, not a DO
relay. Desktop media and exports stay outside this deployment.

```bash
pnpm site:deploy --dry-run
pnpm site:deploy --tag <full-reviewed-commit-sha>
```

Deploy only a reviewed, green revision. Authenticate through the existing
Cloudflare native/pass broker; `--keep-vars` preserves deployed configuration
and secrets. No private payloads or credential values belong in deploy output.

The `vibecheck.design` Cloudflare zone must also be active at the registrar:
its assigned nameservers are `elsa.ns.cloudflare.com` and
`miles.ns.cloudflare.com`. Preserve the existing apex verification TXT record
before changing delegation; Worker custom domains replace only the old web
A/CNAME records. A Worker upload alone is not proof that either alias has left
DigitalOcean. Check registry delegation, authoritative DNS, all three domains,
asset hashes, health, and the real install-command copy interaction.

For code rollback, use project-local Wrangler with the captured previous
production version ID and `--config site/wrangler.jsonc --env production`.
For delegation rollback, restore the captured original nameservers and DNS
records while the old origin remains intact. Do not delete the old origin,
provider resources, or data as part of this reversible site cutover. The parent
`K-20261012-infrastructure-gets-simpler-seen-through` owns exact deployment,
DNS, rollback receipts and the global PostgreSQL 16 off-DO backup gate.

## License

MIT
