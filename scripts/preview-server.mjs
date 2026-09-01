import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'out', 'renderer');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url||'/').split('?')[0]);
    const path = join(dir, url === '/' ? 'index.html' : url);
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(8123, () => console.log('preview server on http://localhost:8123'));
