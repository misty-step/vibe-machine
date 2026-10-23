"""Install real release DMGs in a disposable install and settings directory."""

import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess

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
fixture = {"settings": {"visualizerColor": "#06b6d4", "showTitle": False}, "unknown": {"keep": "synthetic"}}
settings.write_text(json.dumps(fixture))

release = json.loads(run("gh", "api", "repos/{owner}/{repo}/releases/latest"))
asset, = [a for a in release["assets"] if a["name"] == "vibe-machine-latest.dmg"]
run("gh", "release", "download", release["tag_name"], "--pattern", asset["name"], "--dir", str(root))
prior = root / asset["name"]
assert "sha256:" + hashlib.sha256(prior.read_bytes()).hexdigest() == asset["digest"]
candidate, = Path("src-tauri/target/aarch64-apple-darwin/release/bundle/dmg").glob("*.dmg")
installed = root / "installed.app"

for label, image, expected in [
    ("prior", prior, release["tag_name"][1:]),
    ("candidate", candidate, os.environ["RELEASE_TAG"][1:]),
    ("rollback", prior, release["tag_name"][1:]),
]:
    if installed.exists():
        shutil.rmtree(installed)
    mount = root / f"{label}-volume"
    mount.mkdir()
    run("hdiutil", "attach", str(image), "-nobrowse", "-readonly", "-mountpoint", str(mount))
    try:
        source, = mount.glob("*.app")
        run("ditto", str(source), str(installed))
    finally:
        run("hdiutil", "detach", str(mount), "-quiet")
    info = plistlib.loads((installed / "Contents/Info.plist").read_bytes())
    assert info["CFBundleShortVersionString"] == expected, info
    executable = installed / "Contents/MacOS" / info["CFBundleExecutable"]
    with (evidence / f"{label}.log").open("w") as log:
        process = subprocess.Popen([str(executable)], env={**os.environ, "HOME": str(home)}, stdout=log, stderr=log)
        try:
            time.sleep(7)
            assert process.poll() is None, f"{label} exited: {process.returncode}"
            print(run("swift", "scripts/check-native-ui.swift", str(evidence / f"{label}.png"), str(process.pid)), flush=True)
        finally:
            if process.poll() is None:
                process.terminate()
            process.wait(timeout=10)
    assert json.loads(settings.read_text()) == fixture, f"{label} changed accepted settings"
    print(f"{label}: native bundle {expected} launched; settings preserved", flush=True)

    if label in ("prior", "candidate"):
        original = settings.read_bytes()
        corrupt = b'{"settings": invalid-synthetic-fixture'
        settings.write_bytes(corrupt)
        process = None
        try:
            with (evidence / f"{label}-settings-recovery.log").open("w") as log:
                process = subprocess.Popen([str(executable)], env={**os.environ, "HOME": str(home)}, stdout=log, stderr=log)
                time.sleep(7)
                assert process.poll() is None, f"{label} recovery launch exited"
                if label == "candidate":
                    run("swift", "scripts/check-native-ui.swift", str(evidence / "settings-load-error.png"), str(process.pid), "contains", "Preferences could not be loaded")
                # Request an ordinary application quit, not SIGTERM: this must
                # exercise the native store plugin's save-on-exit behavior.
                run("swift", "scripts/check-native-ui.swift", "quit", str(process.pid))
                process.wait(timeout=10)
            preserved = settings.read_bytes() == corrupt
            (evidence / f"{label}-corruption-result.json").write_text(json.dumps({"corrupt_file_preserved_after_native_exit": preserved}))
            if label == "candidate":
                assert preserved, "Candidate overwrote unread preferences on native exit"
            print(f"{label}: corrupt settings preserved after native exit = {preserved}", flush=True)

            if label == "candidate":
                settings.write_bytes(corrupt)
                with (evidence / "candidate-settings-retry.log").open("w") as log:
                    process = subprocess.Popen([str(executable)], env={**os.environ, "HOME": str(home)}, stdout=log, stderr=log)
                    time.sleep(7)
                    assert process.poll() is None, "Candidate retry launch exited"
                    run("swift", "scripts/check-native-ui.swift", str(evidence / "settings-style-tab.png"), str(process.pid), "click", "style")
                    time.sleep(1)
                    run("swift", "scripts/check-native-ui.swift", str(evidence / "settings-session-edit.png"), str(process.pid), "click", "Orbital")
                    time.sleep(1)
                    assert settings.read_bytes() == corrupt, "Session edit overwrote unread preferences"
                    settings.write_bytes(original)
                    run("swift", "scripts/check-native-ui.swift", str(evidence / "settings-retry.png"), str(process.pid), "click", "Retry preferences")
                    time.sleep(2)
                    recovered = json.loads(settings.read_text())
                    assert recovered["settings"]["visualizerColor"] == fixture["settings"]["visualizerColor"]
                    assert recovered["settings"]["showTitle"] is False
                    assert recovered["settings"]["visualizerMode"] == "Orbital"
                    assert recovered["unknown"] == fixture["unknown"]
                    run("swift", "scripts/check-native-ui.swift", str(evidence / "settings-recovered.png"), str(process.pid))
                    run("swift", "scripts/check-native-ui.swift", "quit", str(process.pid))
                    process.wait(timeout=10)
                    assert json.loads(settings.read_text()) == recovered
                    print("Installed candidate: explicit retry preserved saved values, session edit, and unknown keys through native exit", flush=True)
        finally:
            if process is not None and process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
            # This path is exclusively the disposable HOME created above.
            settings.write_bytes(original)

    if label == "candidate":
        ffmpeg, = [p for p in installed.rglob("ffmpeg*") if p.is_file() and os.access(p, os.X_OK)]
        run("lipo", str(ffmpeg), "-verify_arch", "arm64")
        video = evidence / "codec-smoke.mp4"
        run(str(ffmpeg), "-v", "error", "-f", "lavfi", "-i", "color=c=cyan:s=64x64:r=10", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "0.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(video))
        run(str(ffmpeg), "-v", "error", "-i", str(video), "-f", "null", "-")
        assert video.stat().st_size > 0
        print("Installed ARM sidecar: real H.264/AAC encode and decode passed", flush=True)

