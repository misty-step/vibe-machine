/* global URL, console, process */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import canaryConfig from "./api/canary-config.js";
import health from "./api/health.js";

const SITE_ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
]);

function apiResponse(response) {
  return {
    setHeader(name, value) {
      response.setHeader(name, value);
    },
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(payload) {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(payload));
      return this;
    },
  };
}

async function serveFile(response, relativePath, headOnly) {
  const candidate = resolve(SITE_ROOT, relativePath);
  if (
    relativePath.startsWith("api/") ||
    (candidate !== SITE_ROOT && !candidate.startsWith(`${SITE_ROOT}${sep}`))
  ) {
    response.writeHead(404).end("Not found\n");
    return;
  }

  try {
    const body = await readFile(candidate);
    response.setHeader(
      "Content-Type",
      CONTENT_TYPES.get(extname(relativePath)) || "application/octet-stream"
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.statusCode = 200;
    response.end(headOnly ? undefined : body);
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "EISDIR") throw error;
    response.writeHead(404).end("Not found\n");
  }
}

export function createSiteServer() {
  return createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD");
        response.writeHead(405).end("Method not allowed\n");
        return;
      }

      const { pathname } = new URL(request.url || "/", "http://localhost");
      if (pathname === "/api/canary-config") {
        await canaryConfig(request, apiResponse(response));
        return;
      }
      if (pathname === "/api/health") {
        await health(request, apiResponse(response));
        return;
      }

      let decodedPath;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        response.writeHead(400).end("Bad request\n");
        return;
      }
      const relativePath =
        decodedPath === "/"
          ? "index.html"
          : decodedPath === "/favicon.ico"
            ? "favicon.svg"
            : decodedPath.replace(/^\/+/, "");
      await serveFile(response, relativePath, request.method === "HEAD");
    } catch {
      response.writeHead(500).end("Internal server error\n");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT || "8080", 10);
  const host = process.env.HOST || "0.0.0.0";
  createSiteServer().listen(port, host, () => {
    console.log(`vibe-machine site listening on ${host}:${port}`);
  });
}
