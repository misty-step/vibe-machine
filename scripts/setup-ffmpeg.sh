#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    target=aarch64-apple-darwin
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT
    curl --fail --location --retry 2 --output "$work/ffmpeg.zip" \
      https://www.osxexperts.net/ffmpeg71arm.zip
    printf '%s  %s\n' \
      0878f3313311c2c1b2c818e7c955c0bd828c97b357fa86211b42a5c36d01e36f \
      "$work/ffmpeg.zip" | shasum -a 256 --check
    unzip -p "$work/ffmpeg.zip" ffmpeg > "src-tauri/bin/ffmpeg-$target"
    lipo "src-tauri/bin/ffmpeg-$target" -verify_arch arm64
    ;;
  Darwin-x86_64)
    target=x86_64-apple-darwin
    lipo "src-tauri/bin/ffmpeg-$target" -verify_arch x86_64
    ;;
  Linux-x86_64)
    target=x86_64-unknown-linux-gnu
    cp "$(command -v ffmpeg)" "src-tauri/bin/ffmpeg-$target"
    ;;
  *)
    printf 'Unsupported FFmpeg platform\n' >&2
    exit 1
    ;;
esac

chmod +x "src-tauri/bin/ffmpeg-$target"
"src-tauri/bin/ffmpeg-$target" -version
