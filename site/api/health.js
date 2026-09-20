const DEFAULT_SERVICE = "vibe-machine";

/**
 * Liveness check for the Vibe Machine landing site.
 *
 * Truthful and telemetry-independent: `status` reports site liveness only,
 * never error-delivery health. The retired Canary slot stays named so old
 * consumers can read a definitive state instead of a missing field.
 * Browser error monitoring now runs through Sentry (see
 * site/api/sentry-config.js and site/sentry.js) and is deliberately not
 * reported here as a readiness requirement.
 */
export default function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).json({ status: "error", error: "Method not allowed" });
    return;
  }

  const body = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: DEFAULT_SERVICE,
    checks: {
      liveness: "ok",
    },
    observability: {
      canary: {
        status: "retired",
      },
    },
  };

  response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  response.status(200);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.json(body);
}
