// Versão de publicação (dist/): CSP sem violações, nada carregado de fora, página de privacidade e modo offline (PWA).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { construir } from '../../tools/build.mjs';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
let servidor, navegador;
before(async () => { await construir(); servidor = await iniciarServidor(0, DIST); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

const VIOLACOES = () => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); };

async function abrir(rota, opcoes = {}) {
  const s = await novaPagina(navegador, { largura: 390, altura: 800, antes: VIOLACOES, ...opcoes });
  s.externos = [];
  s.pagina.on('request', r => { if (!r.url().startsWith(servidor.url)) s.externos.push(r.url()); });
  await s.pagina.goto(`${servidor.url}/${rota}`);
  return s;
}

test('publicado: CSP no HTML, todas as telas abrem sem violação e sem pedir nada a outro site', async () => {
  const html = readFileSync(DIST + 'index.html', 'utf8');
  assert.match(html, /Content-Security-Policy" content="default-src 'self'; script-src 'self'/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)/, 'sem script embutido');
  const { pagina, erros, externos, contexto } = await abrir('index.html#/dashboard');
  for (const rota of ['dashboard', 'conhecimento', 'laboratorio', 'missoes/nat-saida-da-empresa', 'empresa', 'datacenter', 'campus', 'perfil', 'habilidades']) {
    await pagina.goto(`${servidor.url}/index.html#/${rota}`);
    await pagina.locator('#app h2').first().waitFor();
  }
  await pagina.goto(`${servidor.url}/index.html#/conhecimento`);
  await pagina.locator('.no').first().click();
  await pagina.locator('.card').waitFor();
  assert.deepEqual(await pagina.evaluate(() => window.__csp), []);
  assert.deepEqual(externos, []);
  assert.equal(await pagina.evaluate(() => document.fonts.check('600 16px "Chakra Petch"')), true, 'fonte servida pelo próprio site');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('publicado: página de privacidade, manifesto e ícones', async () => {
  const { pagina, erros, contexto } = await abrir('privacidade.html');
  assert.match(await pagina.locator('h1').innerText(), /Privacidade/);
  assert.match(await pagina.locator('main').innerText(), /não coleta, não envia/);
  assert.deepEqual(await pagina.evaluate(() => window.__csp), []);
  const manifesto = await (await pagina.request.get(`${servidor.url}/manifest.webmanifest`)).json();
  assert.equal(manifesto.display, 'standalone');
  for (const i of manifesto.icons) assert.equal((await pagina.request.get(`${servidor.url}/${i.src}`)).status(), 200, i.src);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('publicado: depois da primeira visita, o jogo abre e funciona sem internet', async () => {
  const { pagina, erros, contexto } = await abrir('index.html#/conhecimento');
  await pagina.locator('.no').first().waitFor();
  await pagina.evaluate(async () => { await navigator.serviceWorker.ready; });
  await pagina.reload();
  await pagina.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await contexto.setOffline(true);
  await pagina.goto(`${servidor.url}/index.html#/missoes/cabo-esquecido`);
  await pagina.locator('.disp').first().waitFor();
  await pagina.goto(`${servidor.url}/index.html#/conhecimento`);
  await pagina.locator('.no').first().click();
  await pagina.locator('.card').waitFor();
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('desenvolvimento: sem a marca de publicação, nenhum service worker é registrado', async () => {
  const dev = await iniciarServidor();
  const s = await novaPagina(navegador);
  await s.pagina.goto(`${dev.url}/index.html#/dashboard`);
  await s.pagina.locator('#app h2').first().waitFor();
  await s.pagina.waitForTimeout(300);
  assert.equal(await s.pagina.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  await s.contexto.close(); await dev.fechar();
});
