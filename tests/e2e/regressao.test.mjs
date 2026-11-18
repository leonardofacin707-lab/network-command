// Regressão no navegador real. Por padrão testa /index.html; para testar a versão original congelada:
//   ALVO=legacy npm run test:e2e
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';
import { abrirJogo, jogarNivel, lerHud, voltarAoMapa, larguraExcedente, nosSobrepostos } from '../helpers/jogador.mjs';

const ehLegado = process.env.ALVO === 'legacy';
// Na v0.1 só os níveis 1 a 3 são jogáveis (9 estrelas); a versão atual também tem os níveis 4 a 6 (18 estrelas).
const ESTRELAS = ehLegado ? 9 : 18;
const ALVO = ehLegado ? '/legacy/index-v0.1.html' : '/index.html';
let servidor, navegador;

before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

async function sessao(opcoes) {
  const s = await novaPagina(navegador, opcoes);
  s.abrir = () => abrirJogo(s.pagina, servidor.url, ALVO);
  return s;
}

test('jogada perfeita nos 3 níveis: pontos, estrelas, XP e cargo', async () => {
  const { pagina, erros, contexto } = await sessao();
  await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
  await pagina.locator('.no').first().waitFor();
  for (const id of [1, 2, 3]) {
    const r = await jogarNivel(pagina, id);
    assert.deepEqual(r, { pontos: '900 / 900', acertos: '9 de 9', melhor: '900', estrelas: '3 de 3 estrelas' }, `nível ${id}`);
  }
  await voltarAoMapa(pagina);
  assert.deepEqual(await lerHud(pagina), { cargo: 'Técnico de redes', xp: '2.700', estrelas: `9 / ${ESTRELAS}` });
  assert.equal(await pagina.locator('.no.st-embreve').count(), ehLegado ? 9 : 6, 'os demais níveis seguem como "em breve"');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('erros reduzem a pontuação (pergunta errada = 0; par errado = 60)', async () => {
  const { pagina, erros, contexto } = await sessao();
  await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
  await pagina.locator('.no').first().waitFor();
  const n1 = await jogarNivel(pagina, 1, { falhas: { 0: 'errar' } });
  assert.deepEqual(n1, { pontos: '800 / 900', acertos: '8 de 9', melhor: '800', estrelas: '2 de 3 estrelas' });
  const n2 = await jogarNivel(pagina, 2, { falhas: { 3: 'par-errado' } });
  assert.deepEqual(n2, { pontos: '860 / 900', acertos: '9 de 9', melhor: '860', estrelas: '3 de 3 estrelas' });
  await voltarAoMapa(pagina);
  assert.deepEqual(await lerHud(pagina), { cargo: 'Técnico de suporte', xp: '1.660', estrelas: `5 / ${ESTRELAS}` });
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('o progresso sobrevive ao recarregar a página', async () => {
  const { pagina, contexto } = await sessao();
  await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
  await pagina.locator('.no').first().waitFor();
  await jogarNivel(pagina, 1);
  await pagina.reload();
  await pagina.locator('.no').first().waitFor();
  assert.deepEqual(await lerHud(pagina), { cargo: 'Técnico de suporte', xp: '900', estrelas: `3 / ${ESTRELAS}` });
  assert.equal(await pagina.locator('.no[data-nivel="2"]').getAttribute('aria-disabled'), null, 'nível 2 liberado');
  await contexto.close();
});

test('níveis bloqueados e "em breve" não abrem', async () => {
  const { pagina, contexto } = await sessao();
  await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
  await pagina.locator('.no').first().waitFor();
  for (const id of [2, 3, 4]) {
    assert.equal(await pagina.locator(`.no[data-nivel="${id}"]`).getAttribute('aria-disabled'), 'true');
    await pagina.locator(`.no[data-nivel="${id}"]`).click({ force: true, timeout: 2000 });
    assert.equal(await pagina.locator('.card').count(), 0, `nível ${id} não deve abrir`);
  }
  await contexto.close();
});

test('progresso salvo pela v0.1 (formato v1) continua valendo', async () => {
  const { pagina, erros, contexto } = await sessao({
    antes: () => localStorage.setItem('jornada-do-pacote-v1', JSON.stringify({ melhor: { 1: { pts: 900, estrelas: 3 } } }))
  });
  await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
  await pagina.locator('.no').first().waitFor();
  assert.deepEqual(await lerHud(pagina), { cargo: 'Técnico de suporte', xp: '900', estrelas: `3 / ${ESTRELAS}` });
  assert.equal(await pagina.locator('.no[data-nivel="2"]').getAttribute('aria-disabled'), null);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('layout sem rolagem horizontal e sem nós sobrepostos em 360, 390, 768 e 1280 px', async () => {
  for (const largura of [360, 390, 768, 1280]) {
    const { pagina, erros, contexto } = await sessao({ largura, altura: 800 });
    await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
    await pagina.locator('.no').first().waitFor();
    assert.ok((await larguraExcedente(pagina)) <= 0, `mapa em ${largura}px tem rolagem horizontal`);
    assert.equal(await nosSobrepostos(pagina), 0, `nós sobrepostos em ${largura}px`);
    for (const id of [1, 2, 3]) {
      await jogarNivel(pagina, id, {
        aoAbrir: async (i, d) => assert.ok((await larguraExcedente(pagina)) <= 0, `nível ${id} desafio ${i + 1} (${d.tipo}) em ${largura}px`)
      });
    }
    assert.deepEqual(erros, []);
    await contexto.close();
  }
});

// Defeito conhecido da v0.1 (achado 3 da auditoria): um registro salvo inválido derruba o jogo.
test('v0.1 quebra com progresso salvo inválido (documenta o defeito)', { skip: !ehLegado && 'só se aplica à versão original' }, async () => {
  const { pagina, erros, contexto } = await sessao({
    antes: () => localStorage.setItem('jornada-do-pacote-v1', JSON.stringify({ melhor: { 1: null } }))
  });
  await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
  await pagina.waitForTimeout(500);
  assert.ok(erros.length > 0, 'esperava erro de execução na versão original');
  await contexto.close();
});

test('progresso salvo inválido não derruba o jogo', { skip: ehLegado && 'defeito conhecido da v0.1' }, async () => {
  const casos = [
    () => localStorage.setItem('jornada-do-pacote-v1', JSON.stringify({ melhor: { 1: null, 2: { pts: 'x', estrelas: 9 }, abc: { pts: 5, estrelas: 1 } } })),
    () => localStorage.setItem('network-command', '{isto não é json'),
    () => localStorage.setItem('network-command', JSON.stringify({ versao: 2, quiz: { melhor: { 1: { pts: -50, estrelas: 3 } } } })),
    () => localStorage.setItem('network-command', JSON.stringify({ versao: 2, quiz: null }))
  ];
  for (const [i, antes] of casos.entries()) {
    const { pagina, erros, contexto } = await sessao({ antes });
    await pagina.goto(servidor.url + ALVO + (ehLegado ? '' : '#/conhecimento'));
    await pagina.locator('.no').first().waitFor();
    assert.deepEqual(await lerHud(pagina), { cargo: 'Estagiário de TI', xp: '0', estrelas: `0 / ${ESTRELAS}` }, `caso ${i + 1}`);
    assert.deepEqual(erros, [], `caso ${i + 1}`);
    await contexto.close();
  }
});
