import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unstable_readConfig } from "wrangler";
import { verifyBytes } from "./verify-site.mjs";

const revision = process.env.GITHUB_SHA;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Deploy through repository CI only");
assert.match(revision || "", /^[0-9a-f]{40}$/);
const receipt = resolve("dist/site-upload.jsonl");
const common = ["--config", "site/wrangler.jsonc", "--env", "production"];
const config = unstable_readConfig({ config: "site/wrangler.jsonc", env: "production" });
assert.equal(config.name, "vibe-machine-site");
const wrangler = (...args) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args, ...common], { encoding: "utf8" });
async function subdomain(method = "GET", body) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/scripts/${config.name}/subdomain`,
    {
      method,
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
  const payload = await response.json();
  assert.ok(response.ok && payload.success, `Worker preview setting failed: ${response.status}`);
  return payload.result;
}
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
    await verifyBytes(`${origin}${path}?revision=${revision}`, `dist/site/${file}`);
  }
  assert.equal(JSON.parse(download(`${origin}/api/health`)).status, "ok");
}

const previous = current();
const previousVersion = JSON.parse(wrangler("versions", "view", previous, "--json"));
const deployedRevision = previousVersion.annotations?.["workers/tag"];
assert.match(deployedRevision || "", /^[0-9a-f]{40}$/, "Deployed source must be known");
const comparison = execFileSync(
  "gh",
  [
    "api",
    `repos/misty-step/vibe-machine/compare/${deployedRevision}...${revision}`,
    "--jq",
    ".status",
  ],
  { encoding: "utf8" }
).trim();
assert.ok(
  ["ahead", "identical"].includes(comparison),
  "Refusing a regression from deployed source"
);
if (comparison === "identical") {
  for (const origin of origins) await verify(origin);
  console.log(JSON.stringify({ revision, workerVersion: previous, noOp: true, verified: true }));
  process.exit(0);
}
const previousHome = download(origins[0] + "/");
await writeFile("dist/prior-site.html", previousHome);
const settings = await subdomain();
assert.equal(settings.enabled, false, "Retain the existing custom-domain-only production route");
if (!settings.previews_enabled) {
  await subdomain("POST", { enabled: false, previews_enabled: true });
  const confirmed = await subdomain();
  assert.equal(confirmed.enabled, false);
  assert.equal(confirmed.previews_enabled, true);
}
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
  await verifyBytes(origins[0] + "/", "dist/prior-site.html");
  console.error("Prior site artifact restored and verified");
  throw error;
}
