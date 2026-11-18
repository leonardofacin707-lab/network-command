import test from 'node:test';
import assert from 'node:assert/strict';
import { carregar, salvar, normalizar, limparMelhor, limparHistorico, limparConquistas, apagar, CHAVE, CHAVE_V1, VERSAO, MAX_HISTORICO } from '../../js/core/storage.js';

const limites = { 1: 900, 2: 900, 3: 900 };
const ref = { limites, perguntas: new Set(['p1', 'p2', 'p3']), conquistas: new Set(['c1', 'c2']) };
const falso = (dados = {}) => ({
  getItem: k => (k in dados ? dados[k] : null),
  setItem: (k, v) => { dados[k] = v; },
  dados
});

test('sem nada salvo, começa vazio', () => {
  const e = carregar(ref, falso());
  assert.equal(e.versao, VERSAO);
  assert.deepEqual(e.quiz.melhor, {});
  assert.equal(e.perfil.nome, '');
});

test('salvar e carregar devolvem o mesmo progresso', () => {
  const arm = falso();
  const e = normalizar({ versao: 3, perfil: { nome: 'Leo', criadoEm: '2026-01-01T00:00:00.000Z' }, quiz: { melhor: { 1: { pts: 900, estrelas: 3 } }, historico: [{ q: 'p1', ok: true, erros: 0, pts: 100, em: '2026-01-02T10:00:00.000Z' }] }, conquistas: { c1: '2026-01-02T10:00:00.000Z' } }, ref);
  assert.equal(salvar(e, arm), true);
  assert.deepEqual(carregar(ref, arm), e);
});

test('migra o formato v1 sem apagar a chave antiga', () => {
  const arm = falso({ [CHAVE_V1]: JSON.stringify({ melhor: { 1: { pts: 900, estrelas: 3 }, 2: { pts: 500, estrelas: 1 } } }) });
  const e = carregar(ref, arm);
  assert.deepEqual(e.quiz.melhor, { 1: { pts: 900, estrelas: 3 }, 2: { pts: 500, estrelas: 1 } });
  assert.ok(arm.dados[CHAVE_V1], 'a chave v1 deve continuar lá');
});

test('o formato novo tem prioridade sobre o v1', () => {
  const arm = falso({
    [CHAVE]: JSON.stringify({ versao: 2, quiz: { melhor: { 1: { pts: 100, estrelas: 0 } } } }),
    [CHAVE_V1]: JSON.stringify({ melhor: { 1: { pts: 900, estrelas: 3 } } })
  });
  assert.equal(carregar(ref, arm).quiz.melhor[1].pts, 100);
});

test('dados inválidos são descartados, não quebram', () => {
  const lixos = [
    undefined, null, 42, 'texto', [], {}, { melhor: null }, { melhor: [] }, { versao: 2 }, { versao: 2, quiz: null },
    { versao: 2, quiz: { melhor: 'x' } }, { versao: 9, quiz: { melhor: { 1: { pts: 10, estrelas: 1 } } } }
  ];
  for (const lixo of lixos) {
    const e = normalizar(lixo, ref);
    assert.equal(e.versao, VERSAO);
    assert.ok(typeof e.quiz.melhor === 'object' && !Array.isArray(e.quiz.melhor));
  }
});

test('entradas de melhor resultado inválidas são filtradas uma a uma', () => {
  const r = limparMelhor({
    1: { pts: 900, estrelas: 3 },      // válida
    2: null,                            // nula
    3: { pts: 'x', estrelas: 1 },       // pts não numérico
    4: { pts: 100, estrelas: 1 },       // nível inexistente
    abc: { pts: 5, estrelas: 1 }        // chave inválida
  }, limites);
  assert.deepEqual(r, { 1: { pts: 900, estrelas: 3 } });
  for (const m of [{ pts: -1, estrelas: 1 }, { pts: 901, estrelas: 1 }, { pts: 1.5, estrelas: 1 }, { pts: 10, estrelas: 4 }, { pts: 10, estrelas: -1 }, { pts: NaN, estrelas: 1 }, { pts: Infinity, estrelas: 1 }]) {
    assert.deepEqual(limparMelhor({ 1: m }, limites), {}, JSON.stringify(m));
  }
});

test('JSON quebrado no disco vira estado vazio', () => {
  const arm = falso({ [CHAVE]: '{isto não é json' });
  assert.deepEqual(carregar(ref, arm).quiz.melhor, {});
});

test('perfil: nome longo é cortado e data inválida é trocada', () => {
  const e = normalizar({ versao: 2, perfil: { nome: 'x'.repeat(100), criadoEm: 'ontem' }, quiz: { melhor: {} } }, ref);
  assert.equal(e.perfil.nome.length, 40);
  assert.ok(!Number.isNaN(Date.parse(e.perfil.criadoEm)));
});

test('sem localStorage ou com erro ao salvar, o jogo segue funcionando', () => {
  assert.deepEqual(carregar(ref, null).quiz.melhor, {});
  const cheio = { getItem: () => null, setItem: () => { throw new Error('cota excedida'); } };
  assert.equal(salvar({ versao: 2 }, cheio), false);
});

test('o estado salvo não contém senhas nem campos desconhecidos', () => {
  const e = normalizar({ versao: 2, senha: '123', token: 'abc', perfil: { nome: 'A', email: 'a@b.c' }, quiz: { melhor: {} } }, ref);
  assert.equal(JSON.stringify(e).includes('123'), false);
  assert.equal('email' in e.perfil, false);
  assert.deepEqual(Object.keys(e).sort(), ['conquistas', 'perfil', 'quiz', 'versao']);
});

test('formato v2 (sem histórico nem conquistas) é migrado para o v3', () => {
  const e = normalizar({ versao: 2, perfil: { nome: 'Ana', criadoEm: '2026-01-01T00:00:00.000Z' }, quiz: { melhor: { 1: { pts: 500, estrelas: 1 } } } }, ref);
  assert.equal(e.versao, VERSAO);
  assert.equal(e.perfil.nome, 'Ana');
  assert.deepEqual(e.quiz.melhor, { 1: { pts: 500, estrelas: 1 } });
  assert.deepEqual(e.quiz.historico, []);
  assert.deepEqual(e.conquistas, {});
});

test('histórico: registros inválidos ou de perguntas inexistentes são descartados', () => {
  const ok = { q: 'p1', ok: true, erros: 0, pts: 100, em: '2026-01-02T10:00:00.000Z' };
  const r = limparHistorico([ok, null, 5, { ...ok, q: 'inexistente' }, { ...ok, ok: 'sim' }, { ...ok, erros: -1 }, { ...ok, pts: 101 }, { ...ok, em: 'ontem' }, { ...ok, erros: 1.5 }], ref.perguntas);
  assert.deepEqual(r, [ok]);
  assert.deepEqual(limparHistorico('x', ref.perguntas), []);
  assert.deepEqual(limparHistorico(null, ref.perguntas), []);
});

test('histórico: guarda só os registros mais recentes', () => {
  const lista = Array.from({ length: MAX_HISTORICO + 25 }, (_, i) => ({ q: 'p1', ok: true, erros: 0, pts: 100, em: new Date(2026, 0, 1, 0, i).toISOString() }));
  const r = limparHistorico(lista, ref.perguntas);
  assert.equal(r.length, MAX_HISTORICO);
  assert.equal(r.at(-1).em, lista.at(-1).em);
});

test('conquistas: só ids conhecidos com data válida', () => {
  assert.deepEqual(limparConquistas({ c1: '2026-01-02T10:00:00.000Z', c9: '2026-01-02T10:00:00.000Z', c2: 'x' }, ref.conquistas), { c1: '2026-01-02T10:00:00.000Z' });
  assert.deepEqual(limparConquistas([], ref.conquistas), {});
});

test('apagar remove as duas chaves', () => {
  const dados = { [CHAVE]: '{}', [CHAVE_V1]: '{}' };
  const arm = { ...falso(dados), removeItem: k => { delete dados[k]; } };
  assert.equal(apagar(arm), true);
  assert.deepEqual(dados, {});
});
