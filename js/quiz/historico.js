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

/**
 * Repetição espaçada: depois de errar, cada acerto de primeira empurra a próxima revisão para mais longe
 * (1, 3 e 7 dias). Depois de 3 acertos espaçados o desafio sai da revisão. Devolve, para cada desafio que já teve erro,
 * { q, acertosSeguidos, venceEm (Date ou null se já saiu) }.
 */
export const INTERVALOS_DIAS = [1, 3, 7];
const DIA_MS = 86400000;
export function agendaRevisao(historico) {
  const porQ = new Map();
  for (const r of historico) { if (!porQ.has(r.q)) porQ.set(r.q, []); porQ.get(r.q).push(r); }
  const agenda = [];
  for (const [q, lista] of porQ) {
    const ultimoErro = lista.findLastIndex(r => !foiPerfeita(r));
    if (ultimoErro === -1) continue; // nunca errou: fora da revisão
    // acertos de primeira depois do último erro; só contam os que respeitaram o intervalo (acertar de novo no mesmo dia não adianta)
    let acertos = 0, base = Date.parse(lista[ultimoErro].em);
    for (const r of lista.slice(ultimoErro + 1)) {
      const quando = Date.parse(r.em);
      if (acertos === 0 || quando - base >= INTERVALOS_DIAS[acertos - 1] * DIA_MS) { acertos++; base = quando; }
    }
    const ultima = lista.at(-1);
    const venceEm = !foiPerfeita(ultima) ? new Date(Date.parse(ultima.em)) : acertos > INTERVALOS_DIAS.length ? null : new Date(base + INTERVALOS_DIAS[acertos - 1] * DIA_MS);
    agenda.push({ q, acertosSeguidos: foiPerfeita(ultima) ? acertos : 0, venceEm, errouPorUltimo: !foiPerfeita(ultima) });
  }
  return agenda;
}

/**
 * Lista para revisar agora: primeiro os que tiveram erro na última tentativa (mais recentes primeiro), depois os
 * reforços espaçados que venceram. agora: Date (injetável nos testes).
 */
export function revisaoDeHoje(historico, agora = new Date()) {
  const agenda = agendaRevisao(historico);
  const erros = listaRevisao(historico);
  const reforcos = agenda.filter(a => !a.errouPorUltimo && a.venceEm && a.venceEm <= agora).sort((a, b) => a.venceEm - b.venceEm).map(a => a.q);
  return { erros, reforcos, ids: [...erros, ...reforcos], futuras: agenda.filter(a => !a.errouPorUltimo && a.venceEm && a.venceEm > agora).sort((a, b) => a.venceEm - b.venceEm) };
}

export function estatisticas(historico) {
  const perfeitas = historico.filter(foiPerfeita).length;
  return { total: historico.length, perfeitas, taxa: historico.length ? perfeitas / historico.length : null };
}
