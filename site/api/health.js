/* global process */

function configuredValue(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export default function handler(_request, response) {
  const browserKey = configuredValue(process.env.PUBLIC_CANARY_API_KEY);
  const browserConfigured = browserKey !== null;
  const ok = browserConfigured;

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    status: ok ? "ok" : "degraded",
    service: "vibe-machine",
    checks: {
      canary: ok ? "configured" : "missing",
      canaryBrowser: browserConfigured ? "configured" : "missing",
    },
    timestamp: new Date().toISOString(),
  });
}
