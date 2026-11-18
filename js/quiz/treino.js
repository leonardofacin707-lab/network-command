// Treino misto (puro, sem DOM): sorteia desafios entre os níveis já liberados. Não vale pontos nem estrelas.
import { statusDoNivel } from './unlock.js';

export const TAMANHO_TREINO = 10;

/** Desafios dos níveis abertos ou concluídos (níveis bloqueados e "em breve" ficam de fora). */
export function desafiosLiberados(niveis, melhor) {
  return niveis
    .filter(n => ['aberto', 'feito'].includes(statusDoNivel(n, niveis, melhor)))
    .flatMap(n => n.desafios);
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
