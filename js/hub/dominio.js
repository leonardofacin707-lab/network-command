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
