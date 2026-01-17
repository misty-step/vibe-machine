#!/usr/bin/env bash
# Auto-update Vibe Machine app after release merges (runs in background)
set -euo pipefail

# Only run for release merges
COMMIT_MSG=$(git log -1 --format=%s)
if [[ ! "$COMMIT_MSG" =~ ^chore\(master\):\ release ]]; then
  exit 0
fi

# Extract version from commit message (anchored pattern for robustness)
VERSION=$(echo "$COMMIT_MSG" | sed -n 's/^chore(master): release \([0-9]\+\.[0-9]\+\.[0-9]\+\).*/\1/p')
if [[ -z "$VERSION" ]]; then
  exit 0
fi

TAG="v$VERSION"
LOG="$HOME/Library/Logs/vibe-machine-update.log"
mkdir -p "$(dirname "$LOG")"

notify() {
  osascript -e "display notification \"$1\" with title \"Vibe Machine\""
}

{
  echo "$(date): Waiting for release $TAG to build..."

  # Poll for the release DMG (max 10 min)
  for _ in {1..60}; do
    if gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null | grep -q '\.dmg$'; then
      echo "$(date): Release ready, installing..."

      # Check if app is running
      if pgrep -x "Vibe Machine" >/dev/null; then
        notify "Update available: $VERSION (close app to install)"
        exit 0
      fi

      # Install
      TMPDIR=$(mktemp -d)
      trap 'rm -rf "$TMPDIR"' EXIT
      gh release download "$TAG" --pattern "*.dmg" --dir "$TMPDIR"

      DMG=$(find "$TMPDIR" -maxdepth 1 -name "*.dmg" -print -quit)
      if [[ -z "$DMG" ]]; then
        echo "$(date): Failed to find downloaded DMG for $TAG"
        notify "Update $VERSION download failed"
        exit 1
      fi

      # Mount and extract mount point dynamically
      MOUNT_INFO=$(hdiutil attach "$DMG" -nobrowse 2>&1)
      MOUNT_POINT=$(echo "$MOUNT_INFO" | tail -1 | awk '{print $NF}')
      if [[ ! -d "$MOUNT_POINT" ]]; then
        echo "$(date): Failed to mount DMG"
        notify "Update $VERSION mount failed"
        exit 1
      fi

      APP_PATH=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" -print -quit)
      cp -Rf "$APP_PATH" /Applications/
      hdiutil detach "$MOUNT_POINT" -quiet

      notify "Updated to $VERSION ✓"
      echo "$(date): Installed $VERSION"
      exit 0
    fi
    sleep 10
  done

  echo "$(date): Timeout waiting for release"
  notify "Update $VERSION build timed out"
} >> "$LOG" 2>&1
