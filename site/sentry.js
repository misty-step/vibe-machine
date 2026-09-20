/* global window, document, fetch */

/**
 * Sentry browser bootstrap for the Vibe Machine landing site.
 *
 * Reads the same-origin config endpoint (injectable at deploy through the
 * SENTRY_* environment; see site/api/sentry-config.js) and loads the
 * official @sentry/browser bundle from Sentry's CDN only when it is
 * enabled. Errors travel from the SDK straight to Sentry ingest: this app
 * owns no relay and stores nothing. Disabled config is a truthful no-op.
 */

export const SDK_VERSION = "10.70.0";
export const SDK_URL = `https://browser.sentry-cdn.com/${SDK_VERSION}/bundle.min.js`;

const CONFIG_PATH = "/api/sentry-config";
const INSTALL_FLAG = "__vibeMachineSentryInstalled";
const EXTENSION_URLS = [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//];

// Error capture only: never ship identity or request material that may
// carry secrets (headers, cookies, bodies).
export function sanitizeEvent(event) {
  if (!event || typeof event !== "object") return event;
  delete event.user;
  if (event.request && typeof event.request === "object") {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
  }
  return event;
}

export function initSentry(page, dsn, config) {
  if (!page?.Sentry || typeof page.Sentry.init !== "function") return false;

  page.Sentry.init({
    dsn,
    environment: config.environment,
    release: config.release || undefined,
    sendDefaultPii: false,
    denyUrls: EXTENSION_URLS.slice(),
    beforeSend: sanitizeEvent,
  });
  return true;
}

export function loadSdk(page, onReady) {
  const script = page.document.createElement("script");
  script.src = SDK_URL;
  script.crossOrigin = "anonymous";
  script.onload = onReady;
  script.onerror = () => {
    // Reporting must never affect the page.
  };
  page.document.head.appendChild(script);
  return script;
}

export async function loadConfig(fetchImpl = fetch, configPath = CONFIG_PATH) {
  const response = await fetchImpl(configPath, {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const config = await response.json();
  if (!config || config.enabled !== true || !config.dsn) return null;

  return config;
}

export function installSentry(options = {}) {
  const page = options.window || window;
  if (page[INSTALL_FLAG]) return false;
  page[INSTALL_FLAG] = true;

  const fetchImpl = options.fetch || page.fetch.bind(page);
  const configPromise = options.configPromise || loadConfig(fetchImpl);

  Promise.resolve(configPromise)
    .then((config) => {
      if (!config) return;
      loadSdk(page, () => {
        initSentry(page, config.dsn, config);
      });
    })
    .catch(() => {
      // Reporting must never affect the page.
    });

  return true;
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installSentry());
  } else {
    installSentry();
  }
}
