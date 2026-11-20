// Desafio do dia: sorteio estável pela data, sequência de dias e normalização.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarCatalogo } from '../../js/quiz/catalog.js';
import { desafiosDoDia, registrarDia, sequenciaAtual, diaAnterior, diaLocal, limparDiario, diarioVazio, TAMANHO_DIARIO } from '../../js/quiz/diario.js';

const ler = n => JSON.parse(readFileSync(new URL(`../../data/${n}.json`, import.meta.url), 'utf8'));
const cat = montarCatalogo({ perguntas: ler('questions'), niveis: ler('levels'), categorias: ler('categories'), habilidades: ler('skills') });
const ids = l => l.map(q => q.id);

test('mesmo dia, mesmos desafios (mesmo com o catálogo em outra ordem); outro dia, outra seleção', () => {
  const a = desafiosDoDia(cat.perguntas, '2026-11-20');
  assert.equal(a.length, TAMANHO_DIARIO);
  assert.deepEqual(ids(desafiosDoDia([...cat.perguntas].reverse(), '2026-11-20')), ids(a));
  const dias = ['2026-11-21', '2026-11-22', '2026-11-23'].map(d => ids(desafiosDoDia(cat.perguntas, d)).join());
  assert.ok(dias.some(d => d !== ids(a).join()));
});

test('datas: dia anterior atravessa mês e ano; formato local', () => {
  assert.equal(diaAnterior('2026-03-01'), '2026-02-28');
  assert.equal(diaAnterior('2028-03-01'), '2028-02-29');
  assert.equal(diaAnterior('2027-01-01'), '2026-12-31');
  assert.equal(diaLocal(new Date(2026, 10, 5, 23, 59)), '2026-11-05');
});

test('sequência: cresce em dias seguidos, recomeça após falta, não conta duas vezes no mesmo dia', () => {
  let d = diarioVazio();
  d = registrarDia(d, '2026-11-18'); d = registrarDia(d, '2026-11-19'); d = registrarDia(d, '2026-11-19'); d = registrarDia(d, '2026-11-20');
  assert.deepEqual(d, { ultimoDia: '2026-11-20', sequencia: 3, melhor: 3 });
  assert.equal(sequenciaAtual(d, '2026-11-21'), 3, 'ainda dá tempo hoje');
  assert.equal(sequenciaAtual(d, '2026-11-22'), 0, 'perdeu um dia');
  d = registrarDia(d, '2026-11-25');
  assert.deepEqual(d, { ultimoDia: '2026-11-25', sequencia: 1, melhor: 3 });
});

test('normalização do diário salvo', () => {
  assert.deepEqual(limparDiario(null), diarioVazio());
  assert.deepEqual(limparDiario({ ultimoDia: '<script>', sequencia: 5 }), diarioVazio());
  assert.deepEqual(limparDiario({ ultimoDia: '2026-11-20', sequencia: -3, melhor: 'x' }), { ultimoDia: '2026-11-20', sequencia: 1, melhor: 1 });
  assert.deepEqual(limparDiario({ ultimoDia: '2026-11-20', sequencia: 7, melhor: 2 }), { ultimoDia: '2026-11-20', sequencia: 7, melhor: 7 });
});
