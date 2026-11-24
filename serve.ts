import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.css': 'text/css',
};
const port = Number(process.env.PORT || 8905);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/game/index.html' });
    res.end();
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, '').replace(/^[/\\]/, '');
  const file = join(root, rel);
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

server.listen(port, '127.0.0.1', () => console.log('serving on ' + port));
