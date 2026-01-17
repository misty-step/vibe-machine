# Changelog

## [1.2.1](https://github.com/misty-step/vibe-machine/compare/v1.2.0...v1.2.1) (2026-01-17)


### Bug Fixes

* remove unused @morphllm/morphmcp dependency (3 vulnerabilities) ([#68](https://github.com/misty-step/vibe-machine/issues/68)) ([144b152](https://github.com/misty-step/vibe-machine/commit/144b1523b025ae9dcb108162d9c4cad6d44489ce)), closes [#56](https://github.com/misty-step/vibe-machine/issues/56)

## [1.2.0](https://github.com/misty-step/vibe-machine/compare/v1.1.3...v1.2.0) (2026-01-17)


### Features

* add post-merge auto-update hook for local dev ([#66](https://github.com/misty-step/vibe-machine/issues/66)) ([0bc7dfd](https://github.com/misty-step/vibe-machine/commit/0bc7dfdb3c30b069e36202711bbf75541d6ed849))

## [1.1.3](https://github.com/misty-step/vibe-machine/compare/v1.1.2...v1.1.3) (2026-01-17)

### Bug Fixes

- **ci:** sync tauri.conf.json version at build time ([#64](https://github.com/misty-step/vibe-machine/issues/64)) ([4271d61](https://github.com/misty-step/vibe-machine/commit/4271d610a4f7451eb340ec5c89f2d185ef7e82a3))

## [1.1.2](https://github.com/misty-step/vibe-machine/compare/v1.1.1...v1.1.2) (2026-01-16)

### Bug Fixes

- sync versions and fix blob upload script ([98c6eb5](https://github.com/misty-step/vibe-machine/commit/98c6eb508be14d634d83957341325a76d2a6681c))

## [1.1.1](https://github.com/misty-step/vibe-machine/compare/v1.1.0...v1.1.1) (2026-01-16)

### Bug Fixes

- **ci:** unify release workflow to auto-build on version bump ([a66dce7](https://github.com/misty-step/vibe-machine/commit/a66dce787df5fc171153748db32de890a065d037))
- **export:** sync export overlay with preview ([#6](https://github.com/misty-step/vibe-machine/issues/6)) ([4dd5c74](https://github.com/misty-step/vibe-machine/commit/4dd5c748aaddbf952ac88dd12109bc44764c9854))

## [1.1.0](https://github.com/misty-step/vibe-machine/compare/v1.0.1...v1.1.0) (2025-12-16)

### Features

- **site:** add Homebrew install instructions ([486c6ca](https://github.com/misty-step/vibe-machine/commit/486c6caa9178aa0bcbaa04547442bd8ce8351dee))
- **site:** Homebrew-only install with copy button ([18244ba](https://github.com/misty-step/vibe-machine/commit/18244ba5acd18db1d6380cf6b89db36bd68aed82))

## [1.0.1](https://github.com/misty-step/vibe-machine/compare/v1.0.0...v1.0.1) (2025-12-15)

### Bug Fixes

- **ci:** support manual workflow dispatch with tag input ([f738d30](https://github.com/misty-step/vibe-machine/commit/f738d30425be8918b0990d58a4dcebe9024feb3c))

## 1.0.0 (2025-12-15)

### Features

- add automated release workflow ([6c20750](https://github.com/misty-step/vibe-machine/commit/6c20750ad1f78051445ad0fb0f6c5017f177b050))
- Add complete quality infrastructure ([#1](https://github.com/misty-step/vibe-machine/issues/1)) ([3f1c3b9](https://github.com/misty-step/vibe-machine/commit/3f1c3b9c2ecc5afd6e403b75809c03fbbedba7fd))
- **design:** implement Holographic Industrial design system ([dffce78](https://github.com/misty-step/vibe-machine/commit/dffce7803ede80ff74632dc9db85b44f9e38bcb8))
- **engine:** implement Rust-based visualizer engine (WASM) ([5d75bd9](https://github.com/misty-step/vibe-machine/commit/5d75bd9b298ece5006b9f356adaf944877561e02))
- **engine:** implement Vibe Engine architecture ([8ef0f41](https://github.com/misty-step/vibe-machine/commit/8ef0f41b40af8fda300494877e43426b4c655df3))
- **export:** add ExportController with platform detection ([50b2f40](https://github.com/misty-step/vibe-machine/commit/50b2f40340df8a175a8f70bb8e0bf979948e5f62))
- **export:** wire up Native Export button ([75211e6](https://github.com/misty-step/vibe-machine/commit/75211e68ec42ba8e045c53e181cf54155786e5c7))
- fully automate releases ([8fc9b5c](https://github.com/misty-step/vibe-machine/commit/8fc9b5c8ed992fc5f52c88fb60256b2d7271eb43))
- implement security and UX improvements ([3b343b4](https://github.com/misty-step/vibe-machine/commit/3b343b45a84cf1b9a489b9f7790febd9d618f915))
- refactor App.tsx and implement new visualizer modes ([a5adf05](https://github.com/misty-step/vibe-machine/commit/a5adf052e95c03fd783ac333df935d2f876babba))
- **release:** add automated changelogs with release-please ([3c93951](https://github.com/misty-step/vibe-machine/commit/3c939511fcbfb7a7c964ad47a3df501c56cbecc1))
- **release:** host DMG on Vercel Blob for public downloads ([0ac5d7b](https://github.com/misty-step/vibe-machine/commit/0ac5d7b7e9b74cdc81119f3101f91befb166398e))
- **security:** add Rust path validator for export ([85b06b8](https://github.com/misty-step/vibe-machine/commit/85b06b834dad88cb6ff57bc4c28e6def94b3a0db))
- **site:** Industrial Flux landing page ([315b937](https://github.com/misty-step/vibe-machine/commit/315b937a1256f06ee2ba4c370428d7fbdc6878e1))
- **store:** integrate persistent settings ([dd6abca](https://github.com/misty-step/vibe-machine/commit/dd6abca7c59319fe7bc2bf8887a3c83cb84c41db))
- **tauri:** implement export_video native command ([ab516f3](https://github.com/misty-step/vibe-machine/commit/ab516f3988f643a52a9d30c04f01fd3be6a9cf3f))
- **tauri:** initialize Tauri v2 ([a86094f](https://github.com/misty-step/vibe-machine/commit/a86094fe3f2f6ae6c74565a3522c85649385cd6d))

### Bug Fixes

- add missing BarChart2 icon to Icons facade ([8db0095](https://github.com/misty-step/vibe-machine/commit/8db0095eaacd3bdba77ec00f3834fcbccc5ceb50))
- **app:** initialize store on mount ([0c44867](https://github.com/misty-step/vibe-machine/commit/0c44867c8f4a462f9d9e5e7a0cb820ce068c1f26))
- **audio:** auto-select first track on upload ([8695aae](https://github.com/misty-step/vibe-machine/commit/8695aae3c8c465cb4dfb0c38778dabed3da0fba5))
- **audio:** remove redundant playback effect ([f95b8f9](https://github.com/misty-step/vibe-machine/commit/f95b8f931e53365035212302d8d1754098b1339e))
- **audio:** solve autoplay and initialization race conditions ([c8d873e](https://github.com/misty-step/vibe-machine/commit/c8d873ed54e94b545793e5ca3cf6ce2e7e073dfc))
- **build:** install tailwindcss build tools ([79854dd](https://github.com/misty-step/vibe-machine/commit/79854dd702ff3b12a8e44dbae92cb1f5c3de96a1))
- **ci:** add contents:write permission for releases ([fdfb8fc](https://github.com/misty-step/vibe-machine/commit/fdfb8fcdea23266ce04c1e217a607362e2c9bf00))
- **deps:** downgrade tailwindcss to v3.4.17 ([a10bad2](https://github.com/misty-step/vibe-machine/commit/a10bad2c98a57d3fe47a5fe40106c54af292d513))
- **store:** enable subscribeWithSelector middleware ([9904ee9](https://github.com/misty-step/vibe-machine/commit/9904ee96ff975137f98f4336efbc6358cd5d9248))
- **ui:** improve title/artist sizing and alignment ([93b269a](https://github.com/misty-step/vibe-machine/commit/93b269afacc2c04724075925487035a38d7fe270))
- **visualizer:** add defensive rendering ([7eb6b19](https://github.com/misty-step/vibe-machine/commit/7eb6b19e3dee8a6bc7c54cf8373cbb3cceb982ca))
- **visualizer:** bind methods to instance ([a979d43](https://github.com/misty-step/vibe-machine/commit/a979d43a217b53aaf459a95a8f2c4005a83fb565))
- **visualizer:** move constants to class properties ([7c95266](https://github.com/misty-step/vibe-machine/commit/7c952660a09fcb1554fc1bb94d417c892705a622))

### Reverts

- **feature:** remove text overlays ([d2518ba](https://github.com/misty-step/vibe-machine/commit/d2518ba70feddd767bf7cdead8716e3725d654b5))
