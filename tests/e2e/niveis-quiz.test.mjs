// Níveis do quiz acrescentados depois da v0.1 (4 em diante): liberação em sequência e jogada completa pela interface.
// A lista de níveis vem de data/questions.json, então o teste acompanha os níveis novos.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';
import { lerResultado, lerHud } from '../helpers/jogador.mjs';

let servidor, navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

const perguntas = JSON.parse(readFileSync(new URL('../../data/questions.json', import.meta.url), 'utf8'));
const NOVOS = [...new Set(perguntas.filter(q => q.nivel > 3).map(q => q.nivel))].sort((a, b) => a - b);
const NIVEIS = JSON.parse(readFileSync(new URL('../../data/levels.json', import.meta.url), 'utf8'));
const PROXIMO_EM_BREVE = Math.max(...NOVOS) + 1;
// 1 se ainda existe um nível "em breve" logo depois do último jogável; 0 quando o jogo já está com todos os níveis
const EM_BREVE_ESPERADO = NIVEIS.some(n => n.id === PROXIMO_EM_BREVE && !n.desafios) ? 1 : 0;
const exato = t => new RegExp('^\\s*' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
const ESTADO = { versao: 4, perfil: { nome: 'Leonardo', criadoEm: '2026-11-16T10:00:00.000Z' },
  quiz: { melhor: { 1: { pts: 900, estrelas: 3 }, 2: { pts: 900, estrelas: 3 }, 3: { pts: 900, estrelas: 3 } }, historico: [] }, conquistas: {} };

async function abrirMapa() {
  const s = await novaPagina(navegador);
  await s.pagina.addInitScript(e => { if (!localStorage.getItem('network-command')) localStorage.setItem('network-command', JSON.stringify(e)); }, ESTADO);
  await s.pagina.goto(servidor.url + '/index.html#/conhecimento');
  await s.pagina.locator('.no').first().waitFor();
  s.salvo = () => s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  return s;
}

/** Resolve a pergunta certa lendo a resposta em data/questions.json. */
async function resolver(pagina, q) {
  switch (q.tipo) {
    case 'pergunta':
      await pagina.locator('.op').filter({ hasText: exato(q.alternativas[q.correta]) }).click(); break;
    case 'ligar':
      for (const p of q.pares) {
        await pagina.locator('[data-esq]').filter({ hasText: exato(p.esquerda) }).click();
        await pagina.locator('[data-dir]').filter({ hasText: exato(p.direita) }).click();
      }
      break;
    case 'classificar':
      for (const i of q.itens) {
        await pagina.locator('#pool .chip').filter({ hasText: exato(i.texto) }).click();
        await pagina.locator(`.grupo-cab[data-grupo="${i.grupo}"]`).first().click();
      }
      break;
    case 'ordenar':
      for (const t of q.itens) await pagina.locator('[data-ord]').filter({ hasText: exato(t) }).click(); break;
    case 'numero':
      await pagina.fill('#resp-num', String(q.resposta));
      await pagina.locator('#form-num button[type=submit]').click(); break;
    default: throw new Error('tipo ' + q.tipo);
  }
}

async function jogar(pagina, nivel) {
  const voltar = pagina.locator('[data-acao="mapa"]');
  if (await voltar.count()) await voltar.first().click();
  await pagina.locator(`.no[data-nivel="${nivel}"]`).click();
  await pagina.locator('.card').waitFor();
  const lista = perguntas.filter(q => q.nivel === nivel);
  for (const q of lista) {
    // o enunciado na tela é o da pergunta certa (evita resolver o desafio errado)
    assert.match(await pagina.locator('.card').innerText(), new RegExp(q.enunciado.slice(0, 25).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await resolver(pagina, q);
    await pagina.locator('#feedback .fb').waitFor();
    await pagina.locator('[data-acao="proximo"]').click();
  }
  return lerResultado(pagina);
}

test('os níveis abrem em sequência (cada um só depois do anterior); o seguinte ao último jogável segue "em breve"', async () => {
  const { pagina, contexto } = await abrirMapa();
  assert.equal(await pagina.locator('.no[data-nivel="4"]').getAttribute('aria-disabled'), null, 'nível 4 liberado pelo 3');
  assert.equal(await pagina.locator('.no[data-nivel="5"]').getAttribute('aria-disabled'), 'true', 'nível 5 bloqueado');
  assert.equal(await pagina.locator('.no[data-nivel="6"]').getAttribute('aria-disabled'), 'true', 'nível 6 bloqueado');
  assert.equal(await pagina.locator(`.no[data-nivel="${PROXIMO_EM_BREVE}"].st-embreve`).count(), EM_BREVE_ESPERADO);
  for (const n of [5, 6]) {
    await pagina.locator(`.no[data-nivel="${n}"]`).click({ force: true, timeout: 2000 });
    assert.equal(await pagina.locator('.card').count(), 0, `nível ${n} não deve abrir`);
  }
  await contexto.close();
});

test('jogada perfeita em todos os níveis novos: 900 pontos, 3 estrelas, progresso salvo e o próximo ainda "em breve"', async () => {
  const { pagina, erros, salvo, contexto } = await abrirMapa();
  for (const nivel of NOVOS) {
    const r = await jogar(pagina, nivel);
    assert.deepEqual(r, { pontos: '900 / 900', acertos: '9 de 9', melhor: '900', estrelas: '3 de 3 estrelas' }, `nível ${nivel}`);
  }
  await pagina.locator('[data-acao="mapa"]').first().click();
  await pagina.locator('.no').first().waitFor();
  assert.equal((await lerHud(pagina)).estrelas, `${(3 + NOVOS.length) * 3} / ${(3 + NOVOS.length) * 3}`);
  const e = await salvo();
  for (const nivel of NOVOS) assert.equal(e.quiz.melhor[nivel].pts, 900, `nível ${nivel}`);
  assert.equal(e.quiz.historico.length, NOVOS.length * 9);
  assert.equal(await pagina.locator(`.no[data-nivel="${PROXIMO_EM_BREVE}"].st-embreve`).count(), EM_BREVE_ESPERADO);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('errar uma pergunta do nível 4 mostra o feedback com a explicação', async () => {
  const { pagina, contexto } = await abrirMapa();
  await pagina.locator('.no[data-nivel="4"]').click();
  await pagina.locator('.card').waitFor();
  const q = perguntas.find(p => p.id === 'ethernet-001');
  await pagina.locator('.op').filter({ hasNotText: exato(q.alternativas[q.correta]) }).first().click();
  const fb = await pagina.locator('#feedback .fb').innerText();
  assert.match(fb, /Não foi dessa vez.*MAC de destino/s);
  await contexto.close();
});
