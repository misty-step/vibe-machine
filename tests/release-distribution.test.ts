import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const readme = readFileSync("README.md", "utf8");

describe("release distribution", () => {
  it("publishes the DMG only through GitHub Releases", () => {
    expect(releaseWorkflow).toContain("tauri-apps/tauri-action");
    expect(releaseWorkflow).toContain("GitHub Releases is the canonical download origin");
    expect(releaseWorkflow).toContain("gh release upload");
    expect(releaseWorkflow).toContain("vibe-machine-latest.dmg");
    expect(releaseWorkflow).not.toContain("BLOB_READ_WRITE_TOKEN");
    expect(releaseWorkflow).not.toContain("HOMEBREW_TAP_TOKEN");
    expect(releaseWorkflow).not.toContain("vercel");
    expect(packageJson).not.toContain("@vercel/blob");
  });

  it("documents the Homebrew tap as a GitHub Release consumer", () => {
    expect(readme).toContain("GitHub Releases is the canonical origin");
    expect(readme).toContain("misty-step/tap");
  });
});
