import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const readme = readFileSync("README.md", "utf8");

const scripts = [...releaseWorkflow.matchAll(/ {10}script: \|\n((?: {12}.*\n|\n)+)/g)].map(
  (match) => match[1].replace(/^ {12}/gm, "")
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function checkSource(head: string, conclusion?: string) {
  await new AsyncFunction(
    "github",
    "context",
    scripts.find((s) => s.includes("Refusing stale"))
  )(
    {
      rest: {
        repos: { getBranch: async () => ({ data: { commit: { sha: head } } }) },
        actions: {
          listWorkflowRuns: async () => ({ data: { workflow_runs: [{ conclusion }] } }),
        },
      },
    },
    { repo: { owner: "misty-step", repo: "vibe-machine" }, payload: {}, sha: "candidate" }
  );
}

async function checkDraftSource(
  conclusion?: string,
  changes: Partial<{ draft: boolean; tag_name: string; target_commitish: string }> = {}
) {
  const sha = "a".repeat(40);
  return new AsyncFunction(
    "github",
    "context",
    "process",
    scripts.find((s) => s.includes("Missing release source"))
  )(
    {
      rest: {
        repos: {
          getRelease: async (request: { release_id: number }) => {
            expect(request.release_id).toBe(7);
            return {
              data: { draft: true, tag_name: "candidate-tag", target_commitish: sha, ...changes },
            };
          },
        },
        actions: {
          listWorkflowRuns: async (request: { head_sha: string }) => {
            expect(request.head_sha).toBe(sha);
            return { data: { workflow_runs: [{ conclusion }] } };
          },
        },
      },
    },
    { repo: {} },
    { env: { RELEASE_SHA: sha, RELEASE_ID: "7", RELEASE_TAG: "candidate-tag" } }
  );
}

describe("release distribution", () => {
  it("uses manifest mode and Tauri's native package version reference", () => {
    expect(releaseWorkflow).not.toMatch(/^ {10}release-type:/m);
    expect(releaseWorkflow).toContain("45996ed1f6d02564a971a2fa1b5860e934307cf7");
    expect(JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version).toBe(
      "../package.json"
    );
    expect(releaseWorkflow).not.toContain("Sync Tauri version");
  });

  it("refuses stale, missing, failed and skipped source CI", async () => {
    await expect(checkSource("moved", "success")).rejects.toThrow("stale");
    for (const conclusion of [undefined, "failure", "skipped", "cancelled"]) {
      await expect(checkSource("candidate", conclusion)).rejects.toThrow("successful CI");
    }
    await expect(checkSource("candidate", "success")).resolves.toBeUndefined();
  });

  it("checks the draft's actual source, not a later green commit", async () => {
    for (const conclusion of [undefined, "failure", "skipped", "success"]) {
      const check = checkDraftSource(conclusion);
      if (conclusion === "success") await expect(check).resolves.toBeUndefined();
      else await expect(check).rejects.toThrow("Actual release source");
    }
    expect(JSON.parse(readFileSync("release-please-config.json", "utf8")).draft).toBe(true);
    expect(releaseWorkflow).toContain("--draft=false --latest");
  });

  it("binds the canonical release ID to its unpublished source and tag", async () => {
    for (const changes of [
      { draft: false },
      { tag_name: "untagged-fixture" },
      { target_commitish: "b".repeat(40) },
    ]) {
      await expect(checkDraftSource("success", changes)).rejects.toThrow("Draft ID does not match");
    }
  });

  it("publishes the DMG only through GitHub Releases", () => {
    expect(releaseWorkflow).toContain("tauri-apps/tauri-action");
    expect(releaseWorkflow).toContain("releaseId: ${{ needs.release-please.outputs.release_id }}");
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
