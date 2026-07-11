import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const activeRoots = [
  ".vercel",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "package.json",
  "vercel.json",
  ".github/workflows",
  "site",
];

function files(path: string): string[] {
  if (!existsSync(path)) return [];
  if (/\.test\.[cm]?[jt]sx?$/.test(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    files(join(path, entry.name))
  );
}

describe("retired Vercel authority", () => {
  it("has no active deployment manifest", () => {
    const manifests = activeRoots
      .flatMap((path) => files(join(root, path)))
      .filter((path) => path.endsWith("vercel.json"))
      .map((path) => relative(root, path));

    expect(manifests).toEqual([]);
    expect(existsSync(join(root, ".vercel"))).toBe(false);
  });

  it("has no active runtime or deployment authority", () => {
    const violations = activeRoots.flatMap((path) =>
      files(join(root, path)).flatMap((file) =>
        /\bvercel\b|@vercel\/|VERCEL_[A-Z_]+|\.vercel\.app\b/i.test(readFileSync(file, "utf8"))
          ? [relative(root, file)]
          : []
      )
    );

    expect(violations).toEqual([]);
  });
});
