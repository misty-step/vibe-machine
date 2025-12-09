#!/bin/bash
# scripts/setup-ffmpeg.sh

# Detect OS and Architecture
OS=$(uname -s)
ARCH=$(uname -m)

echo "Detected OS: $OS, Arch: $ARCH"

TARGET=""
URL=""

if [ "$OS" == "Darwin" ]; then
    if [ "$ARCH" == "arm64" ]; then
        TARGET="aarch64-apple-darwin"
        URL="https://www.osxexperts.net/ffmpeg71arm.zip" # Example URL, might need a stable one
        # Better to use ffbinaries or similar reliable source
        # Using a known working static build for Mac ARM
        URL="https://evermeet.cx/ffmpeg/ffmpeg-7.1.zip" # Universal? usually intel.
        # Let's use a reliable source for automation: ffbinaries.com API or github releases.
        
        # For this environment (likely Mac ARM given "Darwin" and recent user logs), 
        # let's try to download a specific release.
        # But wait, 'evermeet.cx' is standard for mac.
        URL="https://evermeet.cx/ffmpeg/get/zip"
    else
        TARGET="x86_64-apple-darwin"
        URL="https://evermeet.cx/ffmpeg/get/zip"
    fi
elif [ "$OS" == "Linux" ]; then
    TARGET="x86_64-unknown-linux-gnu"
    URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
else
    echo "Windows setup not auto-scripted yet."
    exit 0
fi

echo "Target Triple: $TARGET"
echo "Downloading FFmpeg..."

# Download
curl -L -o ffmpeg.zip "$URL"

# Extract
if [[ "$URL" == *.zip ]]; then
    unzip -o ffmpeg.zip
else
    tar -xf ffmpeg.zip
fi

# Move and Rename
# Provide both sidecar name and just 'ffmpeg' for local dev if needed
mv ffmpeg src-tauri/bin/ffmpeg-$TARGET
chmod +x src-tauri/bin/ffmpeg-$TARGET

# Cleanup
rm ffmpeg.zip

echo "FFmpeg setup complete at src-tauri/bin/ffmpeg-$TARGET"
