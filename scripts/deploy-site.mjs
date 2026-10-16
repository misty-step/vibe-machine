import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const revision = process.env.GITHUB_SHA;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Deploy through repository CI only");
assert.match(revision || "", /^[0-9a-f]{40}$/);
const receipt = resolve("dist/site-upload.jsonl");
const common = ["--config", "site/wrangler.jsonc", "--env", "production"];
const wrangler = (...args) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args, ...common], { encoding: "utf8" });
const source = () =>
  execFileSync(
    "gh",
    ["api", "repos/misty-step/vibe-machine/git/ref/heads/master", "--jq", ".object.sha"],
    { encoding: "utf8" }
  ).trim();
const download = (url) =>
  execFileSync("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--retry",
    "8",
    "--retry-all-errors",
    "--retry-delay",
    "2",
    "--max-time",
    "20",
    url,
  ]);
const deployments = () => JSON.parse(wrangler("deployments", "list", "--json"));
const current = () => {
  const deployment = deployments().at(-1);
  assert.equal(deployment.versions.length, 1, "Refusing to overwrite a split deployment");
  assert.equal(deployment.versions[0].percentage, 100);
  return deployment.versions[0].version_id;
};
const origins = [
  "https://vibe-machine.mistystep.io",
  "https://vibecheck.design",
  "https://www.vibecheck.design",
];
const expected = JSON.parse(await readFile("dist/site/release.json", "utf8"));
assert.equal(expected.revision, revision);

async function verify(origin) {
  for (const [path, file] of [
    ["/", "index.html"],
    ["/changelog", "changelog.html"],
    ["/release.json", "release.json"],
    ["/sentry.js", "sentry.js"],
    ["/favicon.ico", "favicon.svg"],
  ]) {
    assert.deepEqual(
      download(`${origin}${path}?revision=${revision}`),
      await readFile(`dist/site/${file}`),
      `Artifact mismatch at ${origin}${path}`
    );
  }
  assert.equal(JSON.parse(download(`${origin}/api/health`)).status, "ok");
}

assert.equal(source(), revision, "Refusing stale site source");
const previous = current();
const previousHome = download(origins[0] + "/");
await rm(receipt, { force: true });
process.env.WRANGLER_OUTPUT_FILE_PATH = receipt;
process.stdout.write(
  wrangler(
    "versions",
    "upload",
    resolve("dist/worker/worker.js"),
    "--no-bundle",
    "--keep-vars",
    "--tag",
    revision,
    "--var",
    `SENTRY_RELEASE:${revision}`,
    "--var",
    "SENTRY_ENVIRONMENT:production"
  )
);
const records = (await readFile(receipt, "utf8")).trim().split("\n").map(JSON.parse);
const uploaded = records.find((record) => record.type === "version-upload");
assert.equal(uploaded?.worker_name, "vibe-machine-site");
assert.match(uploaded.version_id, /^[0-9a-f-]{36}$/);
assert.ok(uploaded.preview_url, "A native preview URL is required before promotion");
await verify(uploaded.preview_url.replace(/\/$/, ""));
assert.equal(source(), revision, "Source moved while the candidate was verified");

try {
  process.stdout.write(
    wrangler("versions", "deploy", `${uploaded.version_id}@100%`, "--yes", "--message", revision)
  );
  assert.equal(current(), uploaded.version_id);
  for (const origin of origins) await verify(origin);
  console.log(
    JSON.stringify({
      revision,
      version: expected.version,
      workerVersion: uploaded.version_id,
      previous,
      preview: uploaded.preview_url,
      origins,
      verified: true,
    })
  );
} catch (error) {
  process.stdout.write(
    wrangler(
      "versions",
      "deploy",
      `${previous}@100%`,
      "--yes",
      "--message",
      "Automatic rollback after failed site readback"
    )
  );
  assert.equal(current(), previous);
  assert.deepEqual(
    download(origins[0] + "/"),
    previousHome,
    "Rollback did not restore the prior homepage"
  );
  console.error("Prior site artifact restored and verified");
  throw error;
}
