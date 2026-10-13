# 009: One AudioSystem owns the audio lifecycle

- **Status:** accepted
- **Date:** 2024-12
- **Primitives:** AudioSystem, vibeStore
- **Powder:** none recorded

## Context

Web Audio requires user-gesture context creation and permits only one media
source node per audio element. Multiple component instances can create
conflicting contexts, while playback must remain synchronized with the store.

## Decision

Use the singleton [AudioSystem](../../engine/AudioSystem.ts) to own the audio
context, analyser, and audio element outside React. Playback follows store
subscriptions; do not scatter imperative playback calls or bind audio lifetime
to component mounting.

## Consequences

Re-renders do not recreate audio, and visualization gets a stable analyser.
Initialization and user-interaction unlock are explicit; hot reload preserves
audio state. Audio lifecycle debugging happens outside React, and CORS audio
requires `crossOrigin = "anonymous"`.
Revisit if: playback requires multiple independent audio contexts or lifecycles.
