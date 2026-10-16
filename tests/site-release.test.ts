import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSite, renderNotes } from "../scripts/build-site.mjs";
import { createSiteServer } from "../site/server";

const directories: string[] = [];
const servers: ReturnType<typeof createSiteServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))
  );
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function candidate() {
  const output = await mkdtemp(join(tmpdir(), "vibe-site-"));
  directories.push(output);
  const revision = "a".repeat(40);
  const metadata = await buildSite(revision, output);
  return { ...metadata, output };
}

describe("canonical site publication", () => {
  it("projects notes and version without mutating their authority or uploading source", async () => {
    const before = await readFile("CHANGELOG.md", "utf8");
    const metadata = await candidate();
    const home = await readFile(join(metadata.output, "index.html"), "utf8");
    const notes = await readFile(join(metadata.output, "changelog.html"), "utf8");
    expect(home).toContain(`BUILD::${metadata.version}`);
    expect(home).toContain('href="/changelog"');
    expect(notes).toContain(renderNotes(before));
    expect(notes).toContain(`Version ${metadata.version}`);
    expect(notes).toContain(metadata.revision);
    expect(notes).toContain("prefers-color-scheme: light");
    expect(await readFile("CHANGELOG.md", "utf8")).toBe(before);
    expect((await readdir(metadata.output)).sort()).toEqual([
      "changelog.html",
      "favicon.svg",
      "index.html",
      "release.json",
      "sentry.js",
    ]);
    await expect(buildSite("unknown", metadata.output)).rejects.toThrow("full source revision");
  });

  it("renders titles as text, never executable HTML, external images or unsafe links", () => {
    const html = renderNotes(
      "<script>alert(1)</script>\n\n[x](javascript:alert) ![tracking](https://example.invalid/pixel) [release](https://github.com/misty-step/vibe-machine/releases)"
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://github.com/misty-step/vibe-machine/releases"');
  });

  it("serves generated notes through the real HTTP consumer, including HEAD and rejection", async () => {
    const { output } = await candidate();
    const server = createSiteServer(output);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const notes = await fetch(`${origin}/changelog`);
    expect(notes.status).toBe(200);
    expect(await notes.text()).toBe(await readFile(join(output, "changelog.html"), "utf8"));
    expect(await (await fetch(`${origin}/changelog/`, { method: "HEAD" })).text()).toBe("");
    expect((await fetch(`${origin}/changelog`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${origin}/%2e%2e%2fpackage.json`)).status).toBe(404);
    expect((await fetch(`${origin}/server.js`)).status).toBe(404);
  });
});
