// Treino (puro, sem DOM): sorteia desafios entre os níveis já liberados, de todos os módulos do curso ou de um só.
// Não vale pontos nem estrelas.
import { statusDoNivel } from './unlock.js';
import { ultimaPorPergunta, foiPerfeita } from './historico.js';

export const TAMANHO_TREINO = 10;

const liberados = (niveis, melhor) => niveis.filter(n => ['aberto', 'feito'].includes(statusDoNivel(n, niveis, melhor)));

/** Desafios dos níveis abertos ou concluídos; modulo (número, 0 = bônus) restringe a um módulo do curso. */
export function desafiosLiberados(niveis, melhor, modulo = null) {
  const todos = liberados(niveis, melhor).flatMap(n => n.desafios);
  return modulo === null ? todos : todos.filter(q => q.modulo === modulo);
}

/** Sorteia até `quantos` desafios distintos; `sorteio` devolve número em [0,1) (injetável nos testes). */
export function sortearTreino(pool, quantos = TAMANHO_TREINO, sorteio = Math.random) {
  const copia = [...pool];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, quantos);
}

/**
 * Situação de cada módulo do curso: total de desafios, quantos já estão liberados e quantos estão dominados
 * (última tentativa acertada de primeira). Módulos sem desafio ficam de fora; o bônus (0) vem por último.
 */
export function resumoPorModulo(niveis, melhor, historico, modulos) {
  const todos = niveis.filter(n => n.desafios).flatMap(n => n.desafios);
  const abertos = new Set(desafiosLiberados(niveis, melhor).map(q => q.id));
  const ultimas = ultimaPorPergunta(historico);
  return [...modulos, { id: 0, nome: 'Bônus (além do curso)' }].map(m => {
    const lista = todos.filter(q => q.modulo === m.id);
    return { id: m.id, nome: m.nome, total: lista.length, liberados: lista.filter(q => abertos.has(q.id)).length,
      dominados: lista.filter(q => ultimas.has(q.id) && foiPerfeita(ultimas.get(q.id))).length };
  }).filter(m => m.total > 0);
}

export const rotuloModulo = (modulos, id) => (id === 0 ? 'Bônus (além do curso)' : `Módulo ${id} · ${modulos.find(m => m.id === id)?.nome ?? ''}`);
