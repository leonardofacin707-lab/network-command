import test from 'node:test';
import assert from 'node:assert/strict';
import { pontosPorErros, estrelasPorPontos, registrarResultado, maximoDoNivel } from '../../js/quiz/scoring.js';
import { statusDoNivel } from '../../js/quiz/unlock.js';
import { xpTotal, estrelasTotal, cargoDe } from '../../js/core/progression.js';
import { montarCatalogo } from '../../js/quiz/catalog.js';
import { criarStore } from '../../js/core/store.js';

test('pontuação por erros', () => {
  assert.deepEqual([0, 1, 2, 5].map(pontosPorErros), [100, 60, 30, 30]);
  assert.equal(maximoDoNivel(9), 900);
});

test('estrelas pelos limites de 40%, 70% e 90%', () => {
  const casos = [[0, 0], [359, 0], [360, 1], [629, 1], [630, 2], [809, 2], [810, 3], [900, 3]];
  for (const [pts, estrelas] of casos) assert.equal(estrelasPorPontos(pts, 900), estrelas, `${pts} pts`);
});

test('registrarResultado só grava recorde e nunca reduz as estrelas', () => {
  const inicial = { 1: { pts: 800, estrelas: 2 } };
  const pior = registrarResultado(inicial, 1, 700, 2);
  assert.equal(pior.recorde, false);
  assert.equal(pior.melhor, inicial);
  const melhor = registrarResultado(inicial, 1, 850, 1);
  assert.equal(melhor.recorde, true);
  assert.deepEqual(melhor.melhor[1], { pts: 850, estrelas: 2 });
  assert.deepEqual(inicial[1], { pts: 800, estrelas: 2 }, 'não pode mutar o original');
  assert.deepEqual(registrarResultado({}, 2, 300, 0).melhor[2], { pts: 300, estrelas: 0 });
});

test('liberação de níveis', () => {
  const niveis = [{ id: 1, desafios: [1] }, { id: 2, desafios: [1] }, { id: 3, desafios: [1] }, { id: 4 }];
  const st = melhor => niveis.map(n => statusDoNivel(n, niveis, melhor));
  assert.deepEqual(st({}), ['aberto', 'bloqueado', 'bloqueado', 'embreve']);
  assert.deepEqual(st({ 1: { pts: 300, estrelas: 0 } }), ['aberto', 'bloqueado', 'bloqueado', 'embreve'], '0 estrela não libera');
  assert.deepEqual(st({ 1: { pts: 400, estrelas: 1 } }), ['feito', 'aberto', 'bloqueado', 'embreve']);
  assert.deepEqual(st({ 1: { pts: 900, estrelas: 3 }, 2: { pts: 900, estrelas: 3 } }), ['feito', 'feito', 'aberto', 'embreve']);
});

test('XP, estrelas e cargos', () => {
  const melhor = { 1: { pts: 900, estrelas: 3 }, 2: { pts: 860, estrelas: 3 }, 3: { pts: 400, estrelas: 1 } };
  assert.equal(xpTotal(melhor), 2160);
  assert.equal(estrelasTotal(melhor), 7);
  assert.equal(xpTotal({}), 0);
  const casos = [[0, 'Estagiário de TI'], [899, 'Estagiário de TI'], [900, 'Técnico de suporte'], [2400, 'Técnico de redes'], [9500, 'Arquiteto de redes'], [99999, 'Arquiteto de redes']];
  for (const [xp, cargo] of casos) assert.equal(cargoDe(xp), cargo, `${xp} XP`);
});

test('montarCatalogo resolve os desafios e calcula os limites', () => {
  const perguntas = [{ id: 'a' }, { id: 'b' }];
  const c = montarCatalogo({ perguntas, niveis: [{ id: 1, desafios: ['a', 'b'] }, { id: 2 }], categorias: [], habilidades: {} });
  assert.equal(c.niveis[0].desafios[1], perguntas[1]);
  assert.equal(c.jogaveis.length, 1);
  assert.deepEqual(c.limites, { 1: 200 });
});

test('store notifica quem ouve e não muta o estado antigo', () => {
  const s = criarStore({ n: 1 });
  const vistos = [];
  const parar = s.ouvir(e => vistos.push(e.n));
  const antes = s.obter();
  s.alterar(e => ({ ...e, n: 2 }));
  assert.equal(antes.n, 1);
  assert.deepEqual(vistos, [2]);
  parar();
  s.alterar(e => ({ ...e, n: 3 }));
  assert.deepEqual(vistos, [2]);
});
