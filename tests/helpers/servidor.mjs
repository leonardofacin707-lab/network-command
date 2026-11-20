// Servidor estático mínimo, usado pelos testes e para abrir o projeto localmente:  npm run serve
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

/** raiz: pasta servida (padrão: a do projeto; os testes da versão publicada usam dist/). */
export function iniciarServidor(porta = 0, raiz = RAIZ) {
  const servidor = createServer(async (req, res) => {
    try {
      let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (caminho.endsWith('/')) caminho += 'index.html';
      const arquivo = normalize(join(raiz, caminho));
      if (!arquivo.startsWith(raiz)) { res.writeHead(403).end('Proibido'); return; }
      const dados = await readFile(arquivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(dados);
    } catch {
      res.writeHead(404).end('Não encontrado');
    }
  });
  return new Promise(resolve => {
    servidor.listen(porta, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${servidor.address().port}`,
      fechar: () => new Promise(ok => servidor.close(ok))
    }));
  });
}

// Executado diretamente (npm run serve): fica de pé na porta 5173.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { url } = await iniciarServidor(Number(process.env.PORTA) || 5173);
  console.log(`Network Command em ${url}  (Ctrl+C para parar)`);
}
