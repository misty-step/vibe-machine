import { describe, expect, it } from "vitest";

import worker from "../site/worker";

type AssetRequest = { pathname: string; method: string };

function createEnv() {
  const requests: AssetRequest[] = [];
  const env = {
    ASSETS: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        requests.push({ pathname: url.pathname, method: request.method });

        if (url.pathname === "/index.html") {
          return new Response("<!doctype html><title>VIBE MACHINE</title>", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        if (url.pathname === "/favicon.svg") {
          return new Response('<svg xmlns="http://www.w3.org/2000/svg" />', {
            headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
          });
        }
        if (url.pathname === "/sentry.js") {
          return new Response("export {};", {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          });
        }
        return new Response("asset not found", { status: 404 });
      },
    },
  };
  return { env, requests };
}

async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const ORIGIN = "https://vibe-machine.example.test";

function callWorker(path: string, init: RequestInit = {}, env: unknown) {
  const request = new Request(`${ORIGIN}${path}`, init);
  return worker.fetch(request, env);
}

describe("site Workers routing", () => {
  it("serves index.html at the site root", async () => {
    const { env, requests } = createEnv();
    const response = await callWorker("/", {}, env);

    expect(response.status).toBe(200);
    expect(requests).toEqual([{ pathname: "/index.html", method: "GET" }]);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toContain("VIBE MACHINE");
  });

  it("maps /favicon.ico onto favicon.svg", async () => {
    const { env, requests } = createEnv();
    const response = await callWorker("/favicon.ico", {}, env);

    expect(response.status).toBe(200);
    expect(requests).toEqual([{ pathname: "/favicon.svg", method: "GET" }]);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
  });

  it("serves the sentry bootstrap as a public asset", async () => {
    const { env, requests } = createEnv();
    const response = await callWorker("/sentry.js", {}, env);

    expect(response.status).toBe(200);
    expect(requests).toEqual([{ pathname: "/sentry.js", method: "GET" }]);
    expect(response.headers.get("content-type")).toContain("javascript");
  });

  it("answers /api/health with the shared liveness-only handler output", async () => {
    const { env, requests } = createEnv();
    const response = await callWorker("/api/health", {}, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      service: "vibe-machine",
      checks: { liveness: "ok" },
      observability: { canary: { status: "retired" } },
    });
    expect(requests).toEqual([]);
  });

  it("answers /api/sentry-config with injectable config", async () => {
    const { env } = createEnv();

    const disabled = await withEnv({ SENTRY_DSN: undefined, NODE_ENV: undefined }, () =>
      callWorker("/api/sentry-config", {}, env)
    );
    expect(disabled.status).toBe(200);
    await expect(disabled.json()).resolves.toMatchObject({
      enabled: false,
      service: "vibe-machine",
    });

    const enabled = await withEnv({ SENTRY_DSN: "https://public@example.invalid/1" }, () =>
      callWorker("/api/sentry-config", {}, env)
    );
    expect(enabled.status).toBe(200);
    await expect(enabled.json()).resolves.toMatchObject({
      enabled: true,
      dsn: "https://public@example.invalid/1",
    });
  });

  it("keeps the legacy observer config route as a 410 tombstone for every method", async () => {
    const { env, requests } = createEnv();

    for (const method of ["GET", "POST", "DELETE"]) {
      const response = await callWorker("/api/canary-config", { method }, env);
      expect(response.status, method).toBe(410);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      await expect(response.json()).resolves.toEqual({ status: "retired", service: "canary" });
    }

    const head = await callWorker("/api/canary-config", { method: "HEAD" }, env);
    expect(head.status).toBe(410);
    expect(await head.text()).toBe("");
    expect(requests).toEqual([]);
  });

  it("never serves source files or api modules", async () => {
    const { env, requests } = createEnv();
    for (const path of [
      "/server.js",
      "/api/health.js",
      "/api/sentry-config.js",
      "/api/canary-config.js",
      "/worker.js",
      "/wrangler.jsonc",
      "/package.json",
      "/.assetsignore",
    ]) {
      const response = await callWorker(path, {}, env);
      expect(response.status, path).toBe(404);
    }
    expect(requests).toEqual([]);
  });

  it("rejects non-GET methods like the Node server", async () => {
    const { env } = createEnv();
    const response = await callWorker("/", { method: "POST" }, env);

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("refuses traversal and malformed paths", async () => {
    const { env, requests } = createEnv();

    const traversal = await callWorker("/%2e%2e%2fpackage.json", {}, env);
    expect(traversal.status).toBe(404);

    const malformed = await callWorker("/%E0%A4%A", {}, env);
    expect(malformed.status).toBe(400);

    expect(requests).toEqual([]);
  });
});
