import { describe, expect, it } from "vitest";

import configHandler from "../site/api/canary-config";
import healthHandler from "../site/api/health";
import {
  createPayload,
  installCanaryObserver,
  loadConfig,
  redact,
  reportToCanary,
} from "../site/canary-observer";

type MockResponse = {
  headers: Record<string, string>;
  statusCode?: number;
  body?: unknown;
  setHeader(name: string, value: string): void;
  status(code: number): MockResponse;
  json(payload: unknown): MockResponse;
};

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function run(handler: (_request: unknown, response: MockResponse) => void) {
  const response: MockResponse = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  handler({}, response);
  return response;
}

describe("site Canary API", () => {
  it("reports ok when the browser reporter key is configured", () => {
    withEnv(
      {
        CANARY_API_KEY: undefined,
        PUBLIC_CANARY_API_KEY: "browser-key",
      },
      () => {
        const result = run(healthHandler);

        expect(result.statusCode).toBe(200);
        expect(result.headers["Cache-Control"]).toBe("no-store");
        expect(result.body).toMatchObject({
          status: "ok",
          service: "vibe-machine",
          checks: {
            canary: "configured",
            canaryBrowser: "configured",
          },
        });
      }
    );
  });

  it("treats whitespace-only keys as missing", () => {
    withEnv(
      {
        CANARY_API_KEY: "   ",
        PUBLIC_CANARY_API_KEY: "   ",
      },
      () => {
        const health = run(healthHandler);
        const config = run(configHandler);

        expect(health.body).toMatchObject({
          status: "degraded",
          checks: {
            canaryBrowser: "missing",
          },
        });
        expect(config.body).toMatchObject({ apiKey: null });
      }
    );
  });

  it("does not expose a browser key that matches the server key", () => {
    withEnv(
      {
        CANARY_API_KEY: "same-key",
        PUBLIC_CANARY_API_KEY: "same-key",
      },
      () => {
        const config = run(configHandler);
        const health = run(healthHandler);

        expect(config.body).toMatchObject({
          service: "vibe-machine",
          apiKey: null,
        });
        expect(health.body).toMatchObject({
          status: "degraded",
          checks: { canaryBrowser: "missing" },
        });
      }
    );
  });
});

describe("site Canary browser observer", () => {
  it("redacts credentials and query strings", () => {
    const output = redact(
      [
        "user@example.com",
        "Bearer abc.def.ghi",
        ["sk", "live", "abcdefghijklmnopqrstuvwxyz1234567890"].join("_"),
        "https://vibe.example.test/install?token=secret",
        "/local?api_key=secret",
        "abcdefghijklmnopqrstuvwxyz1234567890ABCDEF",
      ].join(" ")
    );

    expect(output).toContain("[redacted-email]");
    expect(output).toContain("[redacted-key]");
    expect(output).toContain("[redacted-query]");
    expect(output).not.toContain("user@example.com");
    expect(output).not.toContain("abc.def.ghi");
    expect(output).not.toContain("secret");
  });

  it("keeps the Vibe Machine service contract and preserves ErrorEvent messages", () => {
    const payload = createPayload(
      { service: "vibe-machine", environment: "production" },
      { message: "script boom" },
      {
        location: { href: "https://vibe-machine-eight.vercel.app/?token=secret" },
        navigator: { userAgent: "test-agent" },
      }
    );

    expect(payload).toMatchObject({
      service: "vibe-machine",
      environment: "production",
      error_class: "Error",
      message: "script boom",
    });
    expect(payload.context.page_url).toBe(
      "https://vibe-machine-eight.vercel.app/?[redacted-query]"
    );
  });

  it("posts browser errors to Canary once installed", async () => {
    const listeners = new Map<string, (event: unknown) => Promise<void>>();
    const calls: Array<{ url: string; options: RequestInit }> = [];
    const page = {
      location: { href: "https://vibe-machine-eight.vercel.app/" },
      navigator: { userAgent: "test-agent" },
      fetch: async (url: string, options: RequestInit) => {
        calls.push({ url, options });
        return { ok: true };
      },
      addEventListener(type: string, listener: (event: unknown) => Promise<void>) {
        listeners.set(type, listener);
      },
    };

    const installed = await installCanaryObserver({
      window: page,
      configPromise: Promise.resolve({
        service: "vibe-machine",
        environment: "test",
        endpoint: "https://canary.example.test/",
        apiKey: "public-key",
      }),
    });
    const secondInstall = await installCanaryObserver({ window: page });

    await listeners.get("error")?.({ error: new Error("vibe smoke") });

    expect(installed).toBe(true);
    expect(secondInstall).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://canary.example.test/api/v1/errors");
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.headers).toMatchObject({
      Authorization: "Bearer public-key",
      "Content-Type": "application/json",
    });
  });

  it("ignores incomplete config", async () => {
    const result = await loadConfig(
      async () =>
        ({
          ok: true,
          async json() {
            return { endpoint: "https://canary.example.test", apiKey: "" };
          },
        }) as Response
    );

    expect(result).toBeNull();
  });

  it("returns false when reporting without a key", async () => {
    await expect(reportToCanary({ endpoint: "https://canary.example.test" }, {})).resolves.toBe(
      false
    );
  });
});
