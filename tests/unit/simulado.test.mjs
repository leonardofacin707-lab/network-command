// Simulado com tempo: montagem por módulo e geral, nota, aprovação, recorde e normalização.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { opcoesSimulado, montarSimulado, notaSimulado, registrarSimulado, limparSimulados, SEGUNDOS_POR_QUESTAO } from '../../js/quiz/simulado.js';
import { geradorComSemente } from '../../js/quiz/exercicios.js';

const ler = n => JSON.parse(readFileSync(new URL(`../../data/${n}.json`, import.meta.url), 'utf8'));
const perguntas = ler('questions'), modulos = ler('modulos');

test('opções: geral com 20 questões e só módulos com 3 ou mais desafios', () => {
  const o = opcoesSimulado(perguntas, modulos);
  assert.equal(o[0].chave, 'geral'); assert.equal(o[0].total, 20);
  for (const x of o.slice(1)) assert.ok(perguntas.filter(q => `m${q.modulo}` === x.chave).length >= 3, x.chave);
  assert.ok(!o.some(x => x.chave === 'm0'), 'o bônus não entra');
});

test('montagem: só desafios do módulo (ou do curso, no geral), sem repetir, com tempo por questão', () => {
  const p = montarSimulado('m9', perguntas, modulos, geradorComSemente(1));
  assert.ok(p.desafios.every(q => q.modulo === 9));
  assert.equal(new Set(p.desafios.map(q => q.id)).size, p.desafios.length);
  assert.equal(p.limiteSeg, p.desafios.length * SEGUNDOS_POR_QUESTAO);
  const g = montarSimulado('geral', perguntas, modulos, geradorComSemente(2));
  assert.equal(g.desafios.length, 20);
  assert.ok(g.desafios.every(q => q.modulo >= 1));
  assert.equal(montarSimulado('m99', perguntas, modulos), null);
  assert.equal(montarSimulado('<x>', perguntas, modulos), null);
});

test('nota e aprovação com 70%; recorde guarda o melhor e conta tentativas', () => {
  assert.deepEqual(notaSimulado(7, 10), { pct: 70, aprovado: true });
  assert.deepEqual(notaSimulado(13, 20), { pct: 65, aprovado: false });
  let s = registrarSimulado({}, 'm9', 60, new Date('2026-11-20T10:00:00Z'));
  s = registrarSimulado(s, 'm9', 50);
  assert.deepEqual(s.m9, { melhor: 60, em: '2026-11-20T10:00:00.000Z', tentativas: 2 });
  s = registrarSimulado(s, 'm9', 90, new Date('2026-11-21T10:00:00Z'));
  assert.deepEqual(s.m9, { melhor: 90, em: '2026-11-21T10:00:00.000Z', tentativas: 3 });
});

test('normalização descarta chaves e valores inválidos', () => {
  const bom = { melhor: 80, em: '2026-11-20T10:00:00.000Z', tentativas: 2 };
  assert.deepEqual(limparSimulados({ geral: bom, m3: { ...bom, melhor: 101 }, '<script>': bom, m18: bom, m1: { melhor: 50, em: 'x' } }), { geral: bom });
  assert.deepEqual(limparSimulados(null), {});
});
