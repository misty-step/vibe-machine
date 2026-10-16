import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Version promotion is eventually visible at the edge. A 200 from the old
// version is not success: wait for the actual expected artifact, not status alone.
export async function verifyBytes(url, file, attempts = 30, status = 200) {
  const expected = await readFile(file);
  let failure;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const actual = Buffer.from(await response.arrayBuffer());
      if (response.status === status && actual.equals(expected)) return;
      failure = new Error(`Artifact mismatch at ${url} (HTTP ${response.status})`);
    } catch (error) {
      failure = error;
    }
    if (attempt + 1 < attempts) await setTimeout(2000);
  }
  throw failure;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyBytes(process.argv[2], process.argv[3], 30, Number(process.argv[4] || 200));
  console.log(`Verified artifact at ${process.argv[2]}`);
}
