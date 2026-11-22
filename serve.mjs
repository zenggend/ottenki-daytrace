import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const mime = {
  ".wasm": "application/wasm",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    let filename = path.resolve(root, "." + pathname);
    if (
      !filename.startsWith(path.resolve(root) + path.sep) &&
      filename !== path.resolve(root)
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if ((await stat(filename)).isDirectory())
      filename = path.join(filename, "index.html");
    const data = await readFile(filename);
    res.writeHead(200, {
      "Content-Type":
        mime[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? "Port 4173 is in use. Open http://127.0.0.1:4173 or stop the other server."
      : e.message,
  );
  process.exit(1);
});
server.listen(4173, "127.0.0.1", () =>
  console.log("DAYTRACE: http://127.0.0.1:4173\nPress Ctrl+C to stop."),
);
