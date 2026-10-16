# 0011: Keep release-please as the release authority

Status: accepted
Date: 2026-10-15

The [release convention](https://github.com/misty-step/harness/blob/master/docs/release-convention.md)
and [Foundations](https://foundations.mistystep.io/) own the shared policy.

Vibe Machine keeps its existing release-please Node strategy in manifest mode.
The immutable baseline is `v1.4.0` at
`e56ebe0b2fc6f3fc818f49d29d19190049ecee60`; the manifest records 1.4.0.
This is one release unit: the desktop app and its public install site.
`package.json` is the generated application version. Tauri reads that file
natively instead of keeping a second version or rewriting tagged source.
The internal Rust package version is not a distributed application version.

The release workflow runs after successful default-branch CI, refuses stale
source, and serializes publication. Generated PRs use native GitHub CI approval,
not a new credential or a synthetic passing check. GitHub Releases remains the
artifact origin; the stable DMG alias and Homebrew consumers remain unchanged.
No second release generator or release-note service is introduced.

The site projects the same `CHANGELOG.md` at build time using Marked, with raw
HTML, external images and non-repository links disabled. Its CSS comes from the
existing landing template, not a second design system. CI promotes the tested
Worker and assets through native Cloudflare versions, retaining existing domain
routes and monitoring bindings. `/release.json` binds version and full source SHA;
live byte readback failures restore the previous immutable Worker version.

`SPEC.md` records the known startup, distribution and settings-preservation
stories. Detailed media/rendering and native theme contracts remain explicit
product-specification gaps rather than invented release acceptance.
