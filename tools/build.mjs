// Gera dist/: só os arquivos que vão para o ar (sem testes, ferramentas, legado nem documentação interna),
// com a política de segurança de conteúdo (CSP) no HTML. Uso: npm run build
import { cp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const DIST = join(RAIZ, 'dist');

// Só o próprio site. Estilos embutidos ('unsafe-inline') são necessários porque o jogo usa atributos style
// (barras de progresso, posição de nós); scripts embutidos continuam proibidos.
export const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
  "font-src 'self'", "connect-src 'self'", "manifest-src 'self'", "worker-src 'self'",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'"
].join('; ');

const ENTRADAS = ['index.html', 'privacidade.html', 'LICENSE', 'css', 'js', 'data', 'fonts', 'manifest.webmanifest', 'sw.js', 'icones'];

async function listar(pasta, base = pasta) {
  const saida = [];
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    const c = join(pasta, e.name);
    if (e.isDirectory()) saida.push(...await listar(c, base)); else saida.push(c.slice(base.length + 1).replaceAll('\\', '/'));
  }
  return saida;
}

export async function construir() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST);
  for (const e of ENTRADAS) await cp(join(RAIZ, e), join(DIST, e), { recursive: true }).catch(err => { if (err.code !== 'ENOENT') throw err; });
  for (const html of ['index.html', 'privacidade.html']) {
    const c = join(DIST, html);
    const texto = await readFile(c, 'utf8');
    await writeFile(c, texto.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="no-referrer">\n<meta name="nc-publicado" content="1">`));
  }
  // Versão do cache offline: muda sempre que algum arquivo muda (o service worker baixa tudo de novo).
  const arquivos = (await listar(DIST)).filter(a => a !== 'sw.js').sort();
  const hash = createHash('sha256');
  for (const a of arquivos) hash.update(a).update(await readFile(join(DIST, a)));
  const versao = hash.digest('hex').slice(0, 12);
  const sw = join(DIST, 'sw.js');
  const swTexto = await readFile(sw, 'utf8').catch(() => null);
  if (swTexto) await writeFile(sw, swTexto.replace("'__VERSAO__'", `'${versao}'`).replace("['__ARQUIVOS__']", JSON.stringify(['./', ...arquivos.filter(a => a !== 'LICENSE' && !a.endsWith('.txt'))])));
  return { versao, arquivos: arquivos.length + (swTexto ? 1 : 0) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await construir();
  console.log(`dist/ gerado: ${r.arquivos} arquivos, versão ${r.versao}.`);
}
