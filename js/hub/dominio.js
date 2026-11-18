// Domínio por habilidade e desempenho por assunto, calculados só a partir do histórico real.
import { ultimaPorPergunta, foiPerfeita } from '../quiz/historico.js';

/** { 'fundamentos.teoria': { total, dominadas } }. "Dominada" = a última tentativa foi acerto de primeira. */
export function dominioPorHabilidade(historico, perguntas) {
  const ultimas = ultimaPorPergunta(historico);
  const mapa = {};
  for (const q of perguntas) {
    const h = (mapa[q.habilidade] ??= { total: 0, dominadas: 0 });
    h.total++;
    const r = ultimas.get(q.id);
    if (r && foiPerfeita(r)) h.dominadas++;
  }
  return mapa;
}

/** Lista por assunto com tentativas, acertos de primeira e taxa (0 a 1). Só assuntos já respondidos. */
export function desempenhoPorAssunto(historico, perguntas) {
  const porId = new Map(perguntas.map(q => [q.id, q]));
  const mapa = new Map();
  for (const r of historico) {
    const q = porId.get(r.q);
    if (!q) continue;
    const chave = `${q.categoria}|${q.assunto}`;
    const a = mapa.get(chave) ?? { categoria: q.categoria, assunto: q.assunto, tentativas: 0, perfeitas: 0 };
    a.tentativas++;
    if (foiPerfeita(r)) a.perfeitas++;
    mapa.set(chave, a);
  }
  return [...mapa.values()].map(a => ({ ...a, taxa: a.perfeitas / a.tentativas }));
}

/** Assuntos com taxa abaixo de 100%, do pior para o melhor. */
export const pontosFracos = (desempenho, limite = 3) =>
  desempenho.filter(a => a.taxa < 1).sort((a, b) => a.taxa - b.taxa || b.tentativas - a.tentativas).slice(0, limite);

/**
 * Progresso de Prática e Diagnóstico por habilidade, a partir das missões, do Campus e dos projetos da Empresa concluídos.
 * { 'subnetting.pratica': { total, feitos, itens: [{ id, titulo, feito }] } }. Só aparecem habilidades que têm conteúdo marcado.
 */
export function progressoPratico(estado, missoes, projetos) {
  const mapa = {};
  const somar = (item, feito) => {
    for (const h of item.habilidades ?? []) {
      const e = (mapa[h] ??= { total: 0, feitos: 0, itens: [] });
      e.total++; if (feito) e.feitos++;
      e.itens.push({ id: item.id, titulo: item.titulo, feito });
    }
  };
  for (const m of missoes ?? []) somar(m, estado.missoes?.[m.id]?.concluida === true);
  for (const p of projetos ?? []) somar(p, estado.empresa?.[p.id]?.concluida === true);
  return mapa;
}

/**
 * Resumo da prática por módulo (Missões, Campus, Empresa, Data Center): quantos itens foram concluídos e qual é o próximo.
 * [{ modulo, rotulo, feitos, total, proximo: { id, titulo } | null }]
 */
export function resumoPratica(estado, { missoes = [], empresa, datacenter } = {}) {
  const montar = (modulo, rotulo, itens, concluidos) => {
    const lista = itens ?? [];
    const feitos = lista.filter(i => concluidos?.[i.id]?.concluida === true).length;
    const prox = lista.find(i => concluidos?.[i.id]?.concluida !== true);
    return { modulo, rotulo, feitos, total: lista.length, proximo: prox ? { id: prox.id, titulo: prox.titulo } : null };
  };
  return [
    montar('missoes', 'Missões', missoes.filter(m => m.modulo === 'missoes'), estado.missoes),
    montar('campus', 'Campus de Redes', missoes.filter(m => m.modulo === 'campus'), estado.missoes),
    montar('empresa', 'Empresa', empresa?.projetos, estado.empresa),
    montar('datacenter', 'Data Center', datacenter?.desafios, estado.datacenter)
  ].filter(r => r.total > 0);
}
