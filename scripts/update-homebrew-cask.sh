#!/bin/bash
# Updates the Homebrew cask in misty-step/homebrew-tap
# Usage: ./update-homebrew-cask.sh <version> <sha256> <token>

set -euo pipefail

VERSION="$1"
SHA256="$2"
TOKEN="$3"

echo "Updating homebrew-tap: version=$VERSION sha256=$SHA256"

# Clone tap repo
git clone "https://x-access-token:${TOKEN}@github.com/misty-step/homebrew-tap.git" /tmp/homebrew-tap
cd /tmp/homebrew-tap

# Generate cask file
cat > Casks/vibe-machine.rb << EOF
cask "vibe-machine" do
  version "$VERSION"
  sha256 "$SHA256"

  url "https://vre6kzshqnquncrg.public.blob.vercel-storage.com/releases/vibe-machine-v#{version}.dmg"
  name "Vibe Machine"
  desc "Cinematic audio visualization for macOS"
  homepage "https://github.com/misty-step/vibe-machine"

  depends_on macos: ">= :big_sur"

  app "vibe-machine.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/vibe-machine.app"]
  end

  zap trash: [
    "~/Library/Application Support/io.mistystep.vibe-machine",
    "~/Library/Preferences/io.mistystep.vibe-machine.plist",
  ]
end
EOF

# Commit and push
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add Casks/vibe-machine.rb
git commit -m "chore: bump vibe-machine to $VERSION"
git push

echo "✓ Homebrew tap updated to v$VERSION"
