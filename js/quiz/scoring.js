// Regras de pontuação do quiz (puras, sem DOM).
/** Pontos de um desafio: de primeira 100; com 1 erro 60; com mais erros 30. */
export const pontosPorErros = erros => (erros === 0 ? 100 : erros === 1 ? 60 : 30);

export const PONTOS_POR_DESAFIO = 100;
export const maximoDoNivel = totalDeDesafios => totalDeDesafios * PONTOS_POR_DESAFIO;

/** Estrelas pela fração de pontos: 90% = 3, 70% = 2, 40% = 1. */
export function estrelasPorPontos(pontos, maximo) {
  const pct = pontos / maximo;
  return pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.4 ? 1 : 0;
}

/**
 * Aplica o resultado de uma partida ao mapa de melhores resultados (sem mutar o original).
 * Devolve { melhor, recorde, anterior }.
 */
export function registrarResultado(melhor, nivelId, pontos, estrelas) {
  const anterior = melhor[nivelId];
  const recorde = !anterior || pontos > anterior.pts;
  if (!recorde) return { melhor, recorde, anterior };
  const novo = { pts: pontos, estrelas: Math.max(estrelas, anterior ? anterior.estrelas : 0) };
  return { melhor: { ...melhor, [nivelId]: novo }, recorde, anterior };
}
