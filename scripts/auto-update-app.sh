#!/usr/bin/env bash
# Auto-update Vibe Machine app after release merges (runs in background)
set -euo pipefail

# Only run for release merges
COMMIT_MSG=$(git log -1 --format=%s)
if [[ ! "$COMMIT_MSG" =~ ^chore\(master\):\ release ]]; then
  exit 0
fi

# Extract version from commit message
VERSION=$(echo "$COMMIT_MSG" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
if [[ -z "$VERSION" ]]; then
  exit 0
fi

TAG="v$VERSION"
LOG="/tmp/vibe-machine-update.log"

notify() {
  osascript -e "display notification \"$1\" with title \"Vibe Machine\""
}

{
  echo "$(date): Waiting for release $TAG to build..."

  # Poll for the release DMG (max 10 min)
  for i in {1..60}; do
    if gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null | grep -q ".dmg"; then
      echo "$(date): Release ready, installing..."

      # Check if app is running
      if pgrep -x "Vibe Machine" >/dev/null; then
        notify "Update available: $VERSION (close app to install)"
        exit 0
      fi

      # Install
      TMPDIR=$(mktemp -d)
      trap "rm -rf $TMPDIR" EXIT
      gh release download "$TAG" --pattern "*.dmg" --dir "$TMPDIR"
      DMG=$(ls "$TMPDIR"/*.dmg | head -1)

      hdiutil attach "$DMG" -nobrowse -quiet
      cp -Rf "/Volumes/vibe-machine/vibe-machine.app" /Applications/
      hdiutil detach "/Volumes/vibe-machine" -quiet

      notify "Updated to $VERSION ✓"
      echo "$(date): Installed $VERSION"
      exit 0
    fi
    sleep 10
  done

  echo "$(date): Timeout waiting for release"
  notify "Update $VERSION build timed out"
} >> "$LOG" 2>&1
