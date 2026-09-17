/* global Headers, Request, Response, URL */

import canaryConfig from "./api/canary-config.js";
import health from "./api/health.js";

/**
 * Cloudflare Worker for the Vibe Machine landing site.
 *
 * site/server.js owns the routing contract; this worker mirrors it for the
 * Workers runtime so both hosts behave the same:
 *
 *   - "/api/health" and "/api/canary-config" run the same handlers as the
 *     Node server, reading configuration from process.env (nodejs_compat),
 *   - "/" serves index.html and "/favicon.ico" serves favicon.svg,
 *   - every other path resolves under the site root, exactly as requested,
 *   - source files and the api/ directory are never served; see also
 *     site/.assetsignore, which keeps them out of the asset upload.
 *
 * The worker runs before asset serving (assets.run_worker_first) so routing
 * has a single owner; file bytes come from the ASSETS binding.
 */

const DENIED_FILES = new Set([
  ".assetsignore",
  "package.json",
  "server.js",
  "worker.js",
  "wrangler.jsonc",
]);

function textResponse(body, status, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...extraHeaders },
  });
}

function notFound() {
  return textResponse("Not found\n", 404);
}

function badRequest() {
  return textResponse("Bad request\n", 400);
}

function methodNotAllowed() {
  return textResponse("Method not allowed\n", 405, { Allow: "GET, HEAD" });
}

/** Adapts the site/api handlers' setHeader/status/json contract onto Response. */
class JsonResponder {
  constructor() {
    this.headers = new Headers();
    this.statusCode = 200;
    this.payload = undefined;
  }

  setHeader(name, value) {
    this.headers.set(name, value);
    return this;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(payload) {
    this.payload = payload;
    return this;
  }

  toResponse() {
    this.headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(this.payload), {
      status: this.statusCode,
      headers: this.headers,
    });
  }
}

function isDenied(relativePath) {
  if (relativePath === "" || relativePath === "api" || relativePath.startsWith("api/")) {
    return true;
  }
  if (DENIED_FILES.has(relativePath)) return true;
  return relativePath.split("/").some((segment) => segment.startsWith("."));
}

function filePathFor(pathname) {
  if (pathname === "/") return "index.html";
  if (pathname === "/favicon.ico") return "favicon.svg";
  return pathname.replace(/^\/+/, "");
}

async function serveAsset(request, env, relativePath) {
  const url = new URL(request.url);
  url.pathname = `/${relativePath}`;
  const asset = await env.ASSETS.fetch(
    new Request(url, { method: request.method, headers: request.headers })
  );
  if (asset.status === 404) return notFound();

  const headers = new Headers(asset.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(asset.body, { status: asset.status, headers });
}

async function handleRequest(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();

  const { pathname } = new URL(request.url);

  if (pathname === "/api/canary-config" || pathname === "/api/health") {
    const responder = new JsonResponder();
    await (pathname === "/api/health"
      ? health(request, responder)
      : canaryConfig(request, responder));
    return responder.toResponse();
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return badRequest();
  }

  const relativePath = filePathFor(decodedPath);
  if (isDenied(relativePath)) return notFound();

  return serveAsset(request, env, relativePath);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch {
      return textResponse("Internal server error\n", 500);
    }
  },
};
