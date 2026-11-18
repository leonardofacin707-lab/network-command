// Abre o Chrome controlado pelo Playwright. Em outra máquina, rode antes: npx playwright install chromium
// Para usar um Chrome já instalado:  CHROME_PATH=/usr/bin/google-chrome npm test
import { chromium } from 'playwright-core';

export async function abrirNavegador() {
  return chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
}

// Cria uma página isolada (localStorage limpo), sem rede externa (fontes) e coletando erros de execução.
export async function novaPagina(navegador, { largura = 1280, altura = 900, antes } = {}) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: altura }, locale: 'pt-BR', reducedMotion: 'reduce' });
  await contexto.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), r => r.abort());
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
  pagina.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) erros.push(`console: ${m.text()}`); });
  if (antes) await pagina.addInitScript(antes);
  return { contexto, pagina, erros };
}
