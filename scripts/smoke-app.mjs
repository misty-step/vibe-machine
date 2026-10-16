import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { preview } from "vite";

const out = join(process.env.RUNNER_TEMP || tmpdir(), "vibe-app-smoke");
await mkdir(out, { recursive: true });
const server = await preview({ preview: { host: "127.0.0.1", port: 0, strictPort: true } });
try {
  const address = server.httpServer.address();
  const { stdout, stderr } = await promisify(execFile)(
    process.env.CHROME_BIN || "google-chrome",
    [
      "--headless",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1440,1000",
      "--virtual-time-budget=10000",
      "--timeout=20000",
      `--screenshot=${join(out, "app.png")}`,
      "--dump-dom",
      `http://127.0.0.1:${address.port}/`,
    ],
    { encoding: "utf8", timeout: 30000, maxBuffer: 2 * 1024 * 1024 }
  );
  await writeFile(join(out, "dom.html"), stdout);
  await writeFile(join(out, "browser.log"), stderr);
  assert.match(
    stdout,
    /<button\b[\s\S]*?(?:Pick|Import) Tracks/i,
    "Compiled application must render media controls"
  );
  console.log("Compiled application: real browser rendered media controls");
} finally {
  server.httpServer.closeAllConnections();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
