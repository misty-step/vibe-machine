#!/usr/bin/env bash
# Install latest Vibe Machine release from GitHub
set -euo pipefail

echo "🔍 Checking for latest release..."
TAG=$(gh release view --json tagName -q .tagName 2>/dev/null || echo "")

if [[ -z "$TAG" ]]; then
  echo "❌ Could not fetch latest release"
  exit 1
fi

CURRENT=$(defaults read /Applications/vibe-machine.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null || echo "none")
LATEST="${TAG#v}"

if [[ "$CURRENT" == "$LATEST" ]]; then
  echo "✅ Already on latest ($LATEST)"
  exit 0
fi

echo "📦 Updating from $CURRENT → $LATEST"

# Check if app is running
if pgrep -x "Vibe Machine" >/dev/null; then
  echo "⚠️  Vibe Machine is running. Close it first."
  exit 1
fi

# Download
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
gh release download "$TAG" --pattern "*.dmg" --dir "$TMPDIR"

DMG=$(find "$TMPDIR" -maxdepth 1 -name "*.dmg" -print -quit)
if [[ -z "$DMG" ]]; then
  echo "❌ Failed to download or find DMG for $TAG"
  exit 1
fi

# Mount and extract mount point dynamically
MOUNT_INFO=$(hdiutil attach "$DMG" -nobrowse 2>&1)
MOUNT_POINT=$(echo "$MOUNT_INFO" | tail -1 | awk '{print $NF}')
if [[ ! -d "$MOUNT_POINT" ]]; then
  echo "❌ Failed to mount DMG"
  exit 1
fi

APP_PATH=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" -print -quit)
cp -Rf "$APP_PATH" /Applications/
hdiutil detach "$MOUNT_POINT" -quiet

echo "✅ Installed Vibe Machine $LATEST"
