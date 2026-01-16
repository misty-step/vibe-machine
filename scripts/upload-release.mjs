#!/usr/bin/env node
import { put } from "@vercel/blob";
import { readFileSync } from "fs";

const dmgPath = process.argv[2];
const version = process.argv[3];

if (!dmgPath || !version) {
  console.error("Usage: upload-release.mjs <dmg-path> <version>");
  process.exit(1);
}

const content = readFileSync(dmgPath);

// Upload versioned copy
const versioned = await put(`releases/vibe-machine-${version}.dmg`, content, {
  access: "public",
  addRandomSuffix: false,
});
console.log(`Uploaded: ${versioned.url}`);

// Upload as "latest" for stable URL (overwrite previous)
const latest = await put("releases/vibe-machine-latest.dmg", content, {
  access: "public",
  addRandomSuffix: false,
  allowOverwrite: true,
});
console.log(`Latest: ${latest.url}`);
