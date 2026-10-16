# Blank native interface in v1.5.0

## Impact and recovery

The Apple Silicon v1.5.0 application started but displayed an empty black
client area. Its running process did not mean the editor was usable. External
installation count is unknown; the controlled settings fixture survived the
candidate installation and rollback without changes.

- 2026-10-16 01:21:38 UTC: the release workflow published v1.5.0.
- Screenshot inspection found the blank candidate, unlike the working prior
  and rollback screenshots. The workflow's green result was rejected.
- 2026-10-16 01:27:34 UTC: v1.5.0 was withdrawn to draft. GitHub's latest
  release was restored to v1.4.0, and an actual stable-URL DMG download matched
  SHA256 `2d77e7e4d9605ea917ced1a9981701e565e4ca39befcab6293c50a697ca2c657`.

The v1.5.0 tag and assets remain immutable diagnostic evidence, not a corrected
release. The replacement must come from the existing release generator.

## Cause

The locked frontend combined React 19.2.3 with ReactDOM 19.2.1. A real browser
running the compiled application reproduced React error 527 and an empty root.
React requires the runtime and renderer to have exactly matching versions.

Unit tests, compilation, encoder execution, and process survival missed this
startup failure. The native smoke captured screenshots but did not inspect their
contents before publication. Inspecting them only after publication was a
verification failure, not successful native acceptance.

## Repair

The runtime pair is pinned together and grouped in the existing Dependabot
configuration. The unused CDN import map is removed; pnpm/Vite own dependency
resolution. CI exercises the compiled bundle in real Chrome and requires its
media controls. Native packaging uses that same tested frontend without a second
build. The existing native smoke now captures only its own application's window
and rejects flat blank client regions with the preinstalled macOS SDK; screenshots
remain necessary visual evidence, not a substitute for functional assertions.

The recovery did not change user settings, move a published tag, expand deployment
credentials, or introduce another release controller.

## Evidence

- [Native build and original smoke](https://github.com/misty-step/vibe-machine/actions/runs/38832169567)
- [Immutable failing source](https://github.com/misty-step/vibe-machine/tree/c415315231c920c40a1b934ad7670cea1f2eb28e)
- [React's incompatible-version error](https://react.dev/errors/527)
