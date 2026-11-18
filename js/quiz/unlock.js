// Regra de liberação de níveis (pura): um nível abre quando o anterior tem pelo menos 1 estrela.
/** niveis = lista ordenada de níveis do catálogo; devolve 'embreve' | 'feito' | 'aberto' | 'bloqueado'. */
export function statusDoNivel(nivel, niveis, melhor) {
  if (!nivel.desafios) return 'embreve';
  const m = melhor[nivel.id];
  if (m && m.estrelas > 0) return 'feito';
  const indice = niveis.indexOf(nivel);
  const anterior = indice > 0 ? niveis[indice - 1] : null;
  if (!anterior || melhor[anterior.id]?.estrelas > 0) return 'aberto';
  return 'bloqueado';
}
