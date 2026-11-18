// Histórico de respostas do quiz (funções puras sobre a lista salva no estado).
import { MAX_HISTORICO } from '../core/storage.js';

/** Acrescenta uma resposta ao fim do histórico, mantendo só as mais recentes. */
export function registrarResposta(historico, { q, ok, erros, pts }, agora = new Date()) {
  return [...historico, { q, ok, erros, pts, em: agora.toISOString() }].slice(-MAX_HISTORICO);
}

/** Última tentativa de cada pergunta: Map(id -> registro). */
export function ultimaPorPergunta(historico) {
  const mapa = new Map();
  for (const r of historico) mapa.set(r.q, r);
  return mapa;
}

export const foiPerfeita = r => r.ok && r.erros === 0;

/** Ids das perguntas cuja última tentativa teve erro, da mais recente para a mais antiga. */
export function listaRevisao(historico) {
  const ultimas = [...ultimaPorPergunta(historico).values()].filter(r => !foiPerfeita(r));
  return ultimas.sort((a, b) => b.em.localeCompare(a.em)).map(r => r.q);
}

export function estatisticas(historico) {
  const perfeitas = historico.filter(foiPerfeita).length;
  return { total: historico.length, perfeitas, taxa: historico.length ? perfeitas / historico.length : null };
}
