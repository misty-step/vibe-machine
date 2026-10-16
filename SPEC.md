# Vibe Machine

## Release-critical stories

- On a supported Apple Silicon Mac running macOS 12 or later, a user installs
  the recommended DMG and opens Vibe Machine. The application renders its media
  controls, including **Pick Tracks**, rather than an empty window.
- With no media selected, the application presents its idle state. A user can
  choose local audio and an image, configure the visualization and export video.
- Saved preferences survive application replacement and a compatible rollback.
  Installation replaces the application, not the user's settings.
- A user can find the recommended download through GitHub Releases and the
  Homebrew install command on the public site. A known-broken release is not
  recommended; the previous working download remains available during repair.
- Engineers and users can read the same generated release notes on GitHub and
  `/changelog`. The site exposes its version and source revision at
  `/release.json`; the packaged application's version matches its release.

## Verification boundaries

Startup verification exercises the compiled frontend in a real browser and the
installed macOS DMG. A live process, successful encoder invocation, or saved
screenshot alone does not establish that the application's interface rendered.
The native install/update/rollback journey preserves a privacy-safe settings
fixture and retains screenshots for inspection.

## Open specification gaps

The detailed media-format, rendering-fidelity, export-performance and native
light-theme contracts are not yet specified. Existing README journeys and tests
are evidence, not invented answers to those product questions. This document
records the known release-critical contract, not a complete media-editor spec.
