import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const escape = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function renderNotes(notes) {
  return new Marked({
    renderer: {
      html: ({ text }) => escape(text),
      image: ({ text }) => escape(text),
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens);
        return /^https:\/\/github\.com\/misty-step\/vibe-machine(?:\/|$)/.test(href)
          ? `<a href="${escape(href)}">${text}</a>`
          : text;
      },
    },
  }).parse(notes.replace(/^# Changelog\s*\n/, ""));
}

export async function buildSite(revision, output = resolve("dist/site")) {
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("A full source revision is required");
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  const template = await readFile("site/index.html", "utf8");
  const home = template.replaceAll("{{version}}", version);
  const notes = renderNotes(await readFile("CHANGELOG.md", "utf8"));
  const styles = template.match(/<style>([\s\S]*?)<\/style>/)[1];
  const changelog = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Changelog · Vibe Machine</title><meta name="description" content="Vibe Machine releases, generated from the changes inside this build.">
<link rel="icon" href="/favicon.svg"><link rel="canonical" href="https://vibe-machine.mistystep.io/changelog">
<style>${styles}
body { overflow: auto; } main { display: block; max-width: 54rem; min-height: auto; margin: 3rem auto; text-align: left; padding: 1.5rem; line-height: 1.7; overflow-wrap: anywhere; }
h1 { font-size: clamp(2.5rem, 8vw, 5rem); margin: 2rem 0 1rem; animation: none; text-shadow: none; }
h2 { margin: 3rem 0 1rem; font-size: 1.65rem; } h3 { margin: 1.5rem 0 .5rem; font-size: 1.1rem; }
p, ul { margin: 1rem 0; } ul { padding-left: 1.5rem; } li { margin: .75rem 0; }
a { color: var(--flux); text-underline-offset: .2em; } a:focus-visible { outline: 2px solid var(--plasma); outline-offset: 4px; }
</style><script type="module" src="/sentry.js"></script></head>
<body><main><nav aria-label="Project"><a href="/">Vibe Machine</a> / Changelog</nav>
<h1>Changelog</h1><p>Version ${version} · <a href="https://github.com/misty-step/vibe-machine/commit/${revision}">${revision.slice(0, 12)}</a></p>
<article aria-label="Release notes">${notes}</article></main></body></html>`;
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(resolve(output, "index.html"), home),
    writeFile(resolve(output, "changelog.html"), changelog),
    writeFile(resolve(output, "release.json"), JSON.stringify({ version, revision }) + "\n"),
    ...["favicon.svg", "sentry.js"].map((name) => copyFile(`site/${name}`, resolve(output, name))),
  ]);
  return { version, revision, output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const revision =
    process.env.GITHUB_SHA ||
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  console.log(JSON.stringify(await buildSite(revision)));
}
