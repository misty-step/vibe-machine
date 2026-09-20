import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { createSiteServer } from "../site/server";

const CANONICAL_URL = "https://vibe-machine.mistystep.io/";
const servers: ReturnType<typeof createSiteServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
      )
  );
});

async function startServer() {
  const server = createSiteServer();
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("site parity", () => {
  it("declares the production canonical and labels the copy control", async () => {
    const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");

    expect(html).toContain(`<link rel="canonical" href="${CANONICAL_URL}" />`);
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(html).toContain('aria-label="Copy install command"');
  });

  it("serves the site, favicon, and Sentry config from one service", async () => {
    const baseUrl = await startServer();

    const [home, favicon, legacyFavicon, config, health, tombstone] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/favicon.svg`),
      fetch(`${baseUrl}/favicon.ico`),
      fetch(`${baseUrl}/api/sentry-config`),
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/api/canary-config`),
    ]);

    expect(home.status).toBe(200);
    expect(home.headers.get("content-type")).toContain("text/html");
    expect(favicon.status).toBe(200);
    expect(favicon.headers.get("content-type")).toContain("image/svg+xml");
    expect(legacyFavicon.status).toBe(200);
    expect(legacyFavicon.headers.get("content-type")).toContain("image/svg+xml");
    expect(config.status).toBe(200);
    await expect(config.json()).resolves.toMatchObject({ service: "vibe-machine" });
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ service: "vibe-machine" });
    expect(tombstone.status).toBe(410);
    await expect(tombstone.json()).resolves.toEqual({ status: "retired", service: "canary" });
  });

  it("does not expose arbitrary files outside the site root", async () => {
    const baseUrl = await startServer();
    const attempts = await Promise.all([
      fetch(`${baseUrl}/..%2Fpackage.json`),
      fetch(`${baseUrl}/%2e%2e%2fpackage.json`),
      fetch(`${baseUrl}/%E0%A4%A`),
    ]);

    expect(attempts.map(({ status }) => status)).toEqual([404, 404, 400]);
  });
});
