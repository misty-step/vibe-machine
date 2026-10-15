"""Exercise real macOS bundles in a disposable install and settings directory."""

import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tarfile
import time


def run(*args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()


root = Path(os.environ["RUNNER_TEMP"]) / "vibe-release-smoke"
root.mkdir()
evidence = root / "evidence"
evidence.mkdir()
home = root / "home"
settings = home / "Library/Application Support/com.mistystep.vibemachine/settings.json"
settings.parent.mkdir(parents=True)
fixture = {"settings": {"visualizerColor": "#06b6d4", "showTitle": False}}
settings.write_text(json.dumps(fixture))

release = json.loads(run("gh", "api", "repos/{owner}/{repo}/releases/latest"))
asset, = [a for a in release["assets"] if a["name"].endswith(".app.tar.gz")]
run("gh", "release", "download", release["tag_name"], "--pattern", asset["name"], "--dir", str(root))
archive = root / asset["name"]
assert "sha256:" + hashlib.sha256(archive.read_bytes()).hexdigest() == asset["digest"]
prior = root / "prior"
prior.mkdir()
with tarfile.open(archive) as bundle:
    bundle.extractall(prior, filter="data")
prior_app, = prior.glob("*.app")
candidate, = Path("src-tauri/target/aarch64-apple-darwin/release/bundle/macos").glob("*.app")
installed = root / "installed.app"

for label, source, expected in [
    ("prior", prior_app, release["tag_name"][1:]),
    ("candidate", candidate, os.environ["RELEASE_TAG"][1:]),
    ("rollback", prior_app, release["tag_name"][1:]),
]:
    if installed.exists():
        shutil.rmtree(installed)
    run("ditto", str(source), str(installed))
    info = plistlib.loads((installed / "Contents/Info.plist").read_bytes())
    assert info["CFBundleShortVersionString"] == expected, info
    executable = installed / "Contents/MacOS" / info["CFBundleExecutable"]
    with (evidence / f"{label}.log").open("w") as log:
        process = subprocess.Popen([str(executable)], env={**os.environ, "HOME": str(home)}, stdout=log, stderr=log)
        try:
            time.sleep(7)
            assert process.poll() is None, f"{label} exited: {process.returncode}"
            run("screencapture", "-x", str(evidence / f"{label}.png"))
        finally:
            if process.poll() is None:
                process.terminate()
            process.wait(timeout=10)
    assert json.loads(settings.read_text()) == fixture, f"{label} changed accepted settings"
    print(f"{label}: native bundle {expected} launched; settings preserved", flush=True)

ffmpeg, = [p for p in candidate.rglob("ffmpeg*") if p.is_file() and os.access(p, os.X_OK)]
assert "arm64" in run("file", str(ffmpeg))
video = evidence / "codec-smoke.mp4"
run(str(ffmpeg), "-v", "error", "-f", "lavfi", "-i", "color=c=cyan:s=64x64:r=10", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "0.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(video))
run(str(ffmpeg), "-v", "error", "-i", str(video), "-f", "null", "-")
assert video.stat().st_size > 0
print("ARM sidecar: real H.264/AAC encode and decode passed", flush=True)
