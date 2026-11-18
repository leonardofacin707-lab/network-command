import test from 'node:test';
import assert from 'node:assert/strict';
import { montarCatalogo } from '../../js/quiz/catalog.js';
import { desafiosLiberados, sortearTreino, TAMANHO_TREINO } from '../../js/quiz/treino.js';
import { readFileSync } from 'node:fs';

const ler = n => JSON.parse(readFileSync(new URL(`../../data/${n}.json`, import.meta.url), 'utf8'));
const cat = montarCatalogo({ perguntas: ler('questions'), niveis: ler('levels'), categorias: ler('categories'), habilidades: ler('skills') });

test('treino: só entram desafios de níveis abertos ou concluídos', () => {
  const inicio = desafiosLiberados(cat.niveis, {});
  assert.deepEqual(inicio.map(q => q.id), cat.niveis[0].desafios.map(q => q.id), 'só o nível 1 está aberto no início');
  const depois = desafiosLiberados(cat.niveis, { [cat.niveis[0].id]: { pts: 900, estrelas: 3 } });
  assert.equal(depois.length, cat.niveis[0].desafios.length + cat.niveis[1].desafios.length);
});

test('treino: sorteio distinto, no tamanho pedido e sem alterar o conjunto original', () => {
  const pool = cat.perguntas;
  const copia = [...pool];
  const sorteados = sortearTreino(pool);
  assert.equal(sorteados.length, TAMANHO_TREINO);
  assert.equal(new Set(sorteados.map(q => q.id)).size, TAMANHO_TREINO);
  assert.deepEqual(pool, copia);
  assert.equal(sortearTreino(pool.slice(0, 3)).length, 3, 'com poucos desafios devolve todos');
});

test('treino: o sorteio é determinístico quando a fonte de aleatoriedade é fixa', () => {
  const a = sortearTreino(cat.perguntas, 5, () => 0.3).map(q => q.id);
  const b = sortearTreino(cat.perguntas, 5, () => 0.3).map(q => q.id);
  assert.deepEqual(a, b);
});
