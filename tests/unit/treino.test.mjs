import test from 'node:test';
import assert from 'node:assert/strict';
import { montarCatalogo } from '../../js/quiz/catalog.js';
import { desafiosLiberados, sortearTreino, TAMANHO_TREINO, resumoPorModulo } from '../../js/quiz/treino.js';
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

const modulos = ler('modulos');

test('módulos: todo desafio tem módulo do curso (1 a 17) ou bônus (0), e a lista de módulos é válida', () => {
  assert.equal(modulos.length, 17);
  assert.deepEqual(modulos.map(m => m.id), Array.from({ length: 17 }, (_, i) => i + 1));
  for (const q of cat.perguntas) assert.ok(Number.isInteger(q.modulo) && q.modulo >= 0 && q.modulo <= 17, `${q.id} sem módulo válido`);
});

test('treino por módulo: só desafios liberados daquele módulo', () => {
  const tudo = { ...Object.fromEntries(cat.niveis.map(n => [n.id, { pts: 900, estrelas: 3 }])) };
  const m9 = desafiosLiberados(cat.niveis, tudo, 9);
  assert.ok(m9.length > 0);
  assert.ok(m9.every(q => q.modulo === 9));
  assert.ok(desafiosLiberados(cat.niveis, {}, 9).length < m9.length, 'no início os níveis de IPv4 estão bloqueados');
});

test('resumo por módulo: totais batem com o catálogo e dominados seguem a última tentativa', () => {
  const q = cat.niveis[0].desafios[0];
  const hist = [{ q: q.id, ok: false, erros: 1, pts: 0, em: '2026-01-01T00:00:00.000Z' }, { q: q.id, ok: true, erros: 0, pts: 100, em: '2026-01-02T00:00:00.000Z' }];
  const r = resumoPorModulo(cat.niveis, {}, hist, modulos);
  assert.equal(r.reduce((s, m) => s + m.total, 0), cat.perguntas.length);
  assert.equal(r.find(m => m.id === q.modulo).dominados, 1);
  assert.equal(r.at(-1).id, 0, 'bônus por último');
  const errou = resumoPorModulo(cat.niveis, {}, [...hist, { q: q.id, ok: false, erros: 2, pts: 0, em: '2026-01-03T00:00:00.000Z' }], modulos);
  assert.equal(errou.find(m => m.id === q.modulo).dominados, 0);
});
