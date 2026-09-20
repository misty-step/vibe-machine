import { describe, expect, it } from "vitest";

import canaryConfigHandler from "../site/api/canary-config";
import healthHandler from "../site/api/health";
import sentryConfigHandler from "../site/api/sentry-config";
import { SDK_URL, installSentry, loadConfig, sanitizeEvent } from "../site/sentry";

type MockResponse = {
  headers: Record<string, string>;
  statusCode?: number;
  body?: unknown;
  ended?: boolean;
  setHeader(name: string, value: string): void;
  status(code: number): MockResponse;
  json(payload: unknown): MockResponse;
  end(): MockResponse;
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

function run(
  handler: (request: { method: string }, response: MockResponse) => void,
  request: { method: string } = { method: "GET" }
) {
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
    end() {
      this.ended = true;
      return this;
    },
  };

  handler(request, response);
  return response;
}

function flush(rounds = 12) {
  let chain = Promise.resolve();
  for (let i = 0; i < rounds; i += 1) {
    chain = chain.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  return chain;
}

type FakeScript = {
  src?: string;
  crossOrigin?: string;
  onload?: () => void;
  onerror?: () => void;
};

function makePage() {
  const appended: FakeScript[] = [];
  const inits: Array<Record<string, unknown>> = [];
  const page = {
    document: {
      createElement() {
        return {} as FakeScript;
      },
      head: {
        appendChild(script: FakeScript) {
          appended.push(script);
        },
      },
    },
    Sentry: {
      init(options: Record<string, unknown>) {
        inits.push(options);
      },
    },
    fetch: async () => {
      throw new Error("unexpected fetch");
    },
  };
  return { page, appended, inits };
}

describe("site Sentry API", () => {
  it("reports disabled without a DSN and never invents one", () => {
    withEnv(
      {
        SENTRY_DSN: undefined,
        SENTRY_ENVIRONMENT: undefined,
        SENTRY_RELEASE: undefined,
        NODE_ENV: undefined,
      },
      () => {
        const result = run(sentryConfigHandler);

        expect(result.statusCode).toBe(200);
        expect(result.headers["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
        expect(result.body).toMatchObject({
          enabled: false,
          service: "vibe-machine",
          environment: "production",
          release: null,
        });
        expect("dsn" in (result.body as Record<string, unknown>)).toBe(false);
      }
    );
  });

  it("passes the DSN through when configured", () => {
    withEnv(
      {
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENVIRONMENT: "staging",
        SENTRY_RELEASE: "release-1",
      },
      () => {
        const result = run(sentryConfigHandler);

        expect(result.body).toMatchObject({
          enabled: true,
          dsn: "https://public@example.invalid/1",
          environment: "staging",
          release: "release-1",
        });
      }
    );
  });

  it("treats whitespace-only values as missing", () => {
    withEnv({ SENTRY_DSN: "   ", SENTRY_ENVIRONMENT: "   ", NODE_ENV: undefined }, () => {
      const result = run(sentryConfigHandler);

      expect(result.body).toMatchObject({ enabled: false, environment: "production" });
    });
  });

  it("answers HEAD without a body and rejects other methods", () => {
    const head = run(sentryConfigHandler, { method: "HEAD" });
    expect(head.ended).toBe(true);
    expect(head.body).toBeUndefined();

    const post = run(sentryConfigHandler, { method: "POST" });
    expect(post.statusCode).toBe(405);
    expect(post.headers.Allow).toBe("GET, HEAD");
  });

  it("keeps health truthful liveness-only with the canary slot retired", () => {
    const result = run(healthHandler);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
    expect(result.body).toMatchObject({
      status: "ok",
      service: "vibe-machine",
      checks: { liveness: "ok" },
      observability: { canary: { status: "retired" } },
    });
  });

  it("keeps the legacy observer config route as a 410 tombstone", () => {
    for (const method of ["GET", "POST", "DELETE"]) {
      const result = run(canaryConfigHandler, { method });

      expect(result.statusCode).toBe(410);
      expect(result.headers["Cache-Control"]).toBe("no-store");
      expect(result.body).toEqual({ status: "retired", service: "canary" });
    }

    const head = run(canaryConfigHandler, { method: "HEAD" });
    expect(head.statusCode).toBe(410);
    expect(head.ended).toBe(true);
    expect(head.body).toBeUndefined();
  });
});

describe("site Sentry bootstrap", () => {
  it("returns null for disabled, malformed, or failing configs", async () => {
    const disabled = await loadConfig(
      async () =>
        ({
          ok: true,
          async json() {
            return { enabled: false };
          },
        }) as Response
    );
    const malformed = await loadConfig(
      async () =>
        ({
          ok: true,
          async json() {
            return { enabled: true };
          },
        }) as Response
    );
    const failing = await loadConfig(async () => ({ ok: false }) as Response);

    expect(disabled).toBeNull();
    expect(malformed).toBeNull();
    expect(failing).toBeNull();
  });

  it("is a truthful no-op when config is disabled", async () => {
    const { page, appended, inits } = makePage();
    const installed = installSentry({ window: page, configPromise: Promise.resolve(null) });
    await flush();

    expect(installed).toBe(true);
    expect(appended).toHaveLength(0);
    expect(inits).toHaveLength(0);
  });

  it("loads the pinned official SDK only when enabled and inits privacy-safe", async () => {
    const { page, appended, inits } = makePage();
    const config = {
      enabled: true,
      dsn: "https://public@example.invalid/1",
      environment: "production",
      release: "abc123",
    };

    installSentry({ window: page, configPromise: Promise.resolve(config) });
    await flush();

    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe(SDK_URL);
    expect(appended[0].src).toContain("browser.sentry-cdn.com/10.70.0/");

    appended[0].onload?.();

    expect(inits).toHaveLength(1);
    expect(inits[0]).toMatchObject({
      dsn: config.dsn,
      environment: "production",
      release: "abc123",
      sendDefaultPii: false,
    });
    expect(typeof inits[0].beforeSend).toBe("function");
  });

  it("strips identity and request material in beforeSend", () => {
    const event = {
      user: { email: "user@example.com" },
      request: {
        headers: { authorization: "Bearer x" },
        cookies: "a=b",
        data: { secret: true },
        url: "https://vibe-machine.example.test/",
      },
      message: "boom",
    };

    const sanitized = sanitizeEvent(event);

    expect(sanitized).toBe(event);
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.request.headers).toBeUndefined();
    expect(sanitized.request.cookies).toBeUndefined();
    expect(sanitized.request.data).toBeUndefined();
    expect(sanitized.request.url).toBe("https://vibe-machine.example.test/");
    expect(sanitized.message).toBe("boom");
  });

  it("never breaks the page when config loading fails", async () => {
    const { page, appended } = makePage();
    installSentry({ window: page, configPromise: Promise.reject(new Error("network")) });
    await flush();

    expect(appended).toHaveLength(0);
  });

  it("installs only once per page", async () => {
    const { page } = makePage();
    const first = installSentry({ window: page, configPromise: Promise.resolve(null) });
    const second = installSentry({ window: page, configPromise: Promise.resolve(null) });
    await flush();

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
