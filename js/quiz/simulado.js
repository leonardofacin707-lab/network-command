// Simulado (puro, sem DOM): prova cronometrada por módulo do curso ou geral. Vale o acerto de primeira; aprovação com 70%.
// É treino de estudo: não é o exame oficial do NetAcad, não dá XP nem certificado.
import { sortearTreino } from './treino.js';

export const NOTA_APROVACAO = 0.7;
export const SEGUNDOS_POR_QUESTAO = 90;
export const QUESTOES_MODULO = 10, QUESTOES_GERAL = 20;
const CHAVE = /^(geral|m([1-9]|1[0-7]))$/;

/** Opções de simulado: geral e cada módulo do curso com pelo menos 3 desafios. */
export function opcoesSimulado(perguntas, modulos) {
  const porModulo = id => perguntas.filter(q => q.modulo === id);
  return [
    { chave: 'geral', nome: 'Prova geral (todos os módulos do curso)', total: Math.min(QUESTOES_GERAL, perguntas.filter(q => q.modulo >= 1).length) },
    ...modulos.filter(m => porModulo(m.id).length >= 3).map(m => ({ chave: `m${m.id}`, nome: `Módulo ${m.id} · ${m.nome}`, total: Math.min(QUESTOES_MODULO, porModulo(m.id).length) }))
  ];
}

/** Monta a prova: desafios sorteados, limite de tempo e nome. */
export function montarSimulado(chave, perguntas, modulos, sorteio = Math.random) {
  if (!CHAVE.test(chave)) return null;
  const pool = chave === 'geral' ? perguntas.filter(q => q.modulo >= 1) : perguntas.filter(q => q.modulo === Number(chave.slice(1)));
  if (pool.length < 3) return null;
  const desafios = sortearTreino(pool, chave === 'geral' ? QUESTOES_GERAL : QUESTOES_MODULO, sorteio);
  const m = modulos.find(x => `m${x.id}` === chave);
  return { id: 'simulado', chave, nome: chave === 'geral' ? 'Simulado geral' : `Simulado · Módulo ${m.id}`, revisao: true, simulado: true, desafios, limiteSeg: desafios.length * SEGUNDOS_POR_QUESTAO };
}

/** Nota da prova: acertos de primeira sobre o total (as não respondidas contam como erradas). */
export function notaSimulado(acertosDePrimeira, total) {
  const pct = total ? Math.round(acertosDePrimeira / total * 100) : 0;
  return { pct, aprovado: pct >= NOTA_APROVACAO * 100 };
}

/** Guarda o melhor resultado de cada simulado (sem mutar). */
export function registrarSimulado(simulados, chave, pct, agora = new Date()) {
  const anterior = simulados?.[chave];
  if (anterior && anterior.melhor >= pct) return { ...simulados, [chave]: { ...anterior, tentativas: (anterior.tentativas ?? 1) + 1 } };
  return { ...simulados, [chave]: { melhor: pct, em: agora.toISOString(), tentativas: (anterior?.tentativas ?? 0) + 1 } };
}

export function limparSimulados(b) {
  const limpo = {};
  if (!b || typeof b !== 'object' || Array.isArray(b)) return limpo;
  for (const [k, v] of Object.entries(b)) {
    if (!CHAVE.test(k) || !v || !Number.isInteger(v.melhor) || v.melhor < 0 || v.melhor > 100 || typeof v.em !== 'string' || Number.isNaN(Date.parse(v.em))) continue;
    limpo[k] = { melhor: v.melhor, em: v.em, tentativas: Number.isInteger(v.tentativas) && v.tentativas > 0 && v.tentativas < 100000 ? v.tentativas : 1 };
  }
  return limpo;
}

export const formatarTempo = seg => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
