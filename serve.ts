// Pipe Panic! — tiny static file server for local testing (port 8080).
// Serves the repository root so the game loads at /game/index.html.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".ts": "text/plain",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
    if (path.endsWith("/")) path += "index.html";
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
    const file = join(root, safe);
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(8080, () => {
  console.log("serving http://localhost:8080");
});
