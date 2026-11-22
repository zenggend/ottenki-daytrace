// This project ships the existing dist directory directly, without transpiling it.
import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const root = new URL("../dist/", import.meta.url),
  html = await readFile(new URL("index.html", root), "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg))"/g))
  await access(new URL(match[1], root));
for (const file of [
  "app.js",
  "director-contract.js",
  "director-data.js",
  "director-ui.js",
  "director-model.js",
  "albums.js",
  "composer.js",
  "home.js",
  "player.js",
])
  execFileSync(process.execPath, ["--check", "dist/" + file]);
const wasm = await readFile(new URL("assets/wllama/wllama.wasm", root));
if (wasm.readUInt32LE(0) !== 0x6d736100)
  throw Error("Missing inference runtime");
console.log("Static diary and local model runtime ready.");
