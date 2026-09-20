/* global process */

const DEFAULT_SERVICE = "vibe-machine";

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Same-origin config for the browser Sentry bootstrap (site/sentry.js).
 *
 * The DSN is injectable at deploy time through SENTRY_DSN. No value is
 * committed to the repository and none is invented: without SENTRY_DSN the
 * endpoint truthfully reports enabled:false and the browser is a no-op.
 * Sentry DSNs are public client-side ingest identifiers by design; the
 * endpoint is still scoped to the same origin the site is served from.
 */
export default function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).json({ status: "error", error: "Method not allowed" });
    return;
  }

  const dsn = envValue("SENTRY_DSN");
  const body = {
    enabled: Boolean(dsn),
    service: DEFAULT_SERVICE,
    environment: envValue("SENTRY_ENVIRONMENT") || process.env.NODE_ENV || "production",
    release: envValue("SENTRY_RELEASE"),
  };

  if (dsn) {
    body.dsn = dsn;
  }

  response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  response.status(200);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.json(body);
}
