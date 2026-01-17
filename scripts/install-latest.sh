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
trap "rm -rf $TMPDIR" EXIT
gh release download "$TAG" --pattern "*.dmg" --dir "$TMPDIR"
DMG=$(ls "$TMPDIR"/*.dmg | head -1)

# Install
hdiutil attach "$DMG" -nobrowse -quiet
cp -Rf "/Volumes/vibe-machine/vibe-machine.app" /Applications/
hdiutil detach "/Volumes/vibe-machine" -quiet

echo "✅ Installed Vibe Machine $LATEST"
