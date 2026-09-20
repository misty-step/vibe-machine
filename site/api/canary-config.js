/**
 * Legacy Canary observer config route — retired 2026-09-20.
 *
 * The Canary error pipeline is gone and this app does not replace it with a
 * relay. This route is deliberately a tombstone: every method answers 410,
 * it never reads, stores, logs, or forwards a request body, it discloses no
 * keys or endpoints, and it enables no CORS. Kept until a separate removal
 * decision deletes the path entirely. Browser error monitoring now runs
 * through Sentry via /api/sentry-config (see site/sentry.js).
 */
const TOMBSTONE = { status: "retired", service: "canary" };

export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.status(410);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.json(TOMBSTONE);
}
