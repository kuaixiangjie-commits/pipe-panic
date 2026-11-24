// Tiny static file server for local testing: serves the repo root on :8080.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".css": "text/css",
  ".ts": "text/plain",
};

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url || "/", "http://x").pathname);
  // The game lives under game/, so send the root to its page (a redirect,
  // so the page's relative module paths still resolve under /game/).
  if (path === "/") {
    res.writeHead(302, { location: "/game/index.html" });
    res.end();
    return;
  }
  const file = join(root, path);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

server.listen(8080, () => console.log("serving http://localhost:8080/"));
