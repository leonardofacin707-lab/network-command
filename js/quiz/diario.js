// Desafio do dia (puro, sem DOM): 3 desafios sorteados pela data (iguais o dia todo neste aparelho) e sequência de dias.
import { sortearTreino } from './treino.js';

export const TAMANHO_DIARIO = 3;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Data local no formato AAAA-MM-DD. */
export const diaLocal = (data = new Date()) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;

/** Dia anterior (AAAA-MM-DD), sem depender de fuso: a conta é feita em UTC sobre a própria data. */
export function diaAnterior(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** Gerador pseudoaleatório com semente (mulberry32): mesma data, mesma sequência. */
function gerador(texto) {
  let h = 1779033703 ^ texto.length;
  for (const c of texto) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Os desafios do dia, sorteados entre os liberados (em ordem de id, para o sorteio não depender da ordem do catálogo). */
export function desafiosDoDia(pool, dia) {
  const ordenados = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sortearTreino(ordenados, TAMANHO_DIARIO, gerador('network-command:' + dia));
}

export const diarioVazio = () => ({ ultimoDia: null, sequencia: 0, melhor: 0 });

/** Registra o dia como feito: a sequência cresce se o último foi ontem, recomeça se houve falta, não muda se já foi hoje. */
export function registrarDia(diario, dia) {
  const d = diario ?? diarioVazio();
  if (d.ultimoDia === dia) return d;
  const sequencia = d.ultimoDia === diaAnterior(dia) ? d.sequencia + 1 : 1;
  return { ultimoDia: dia, sequencia, melhor: Math.max(d.melhor, sequencia) };
}

/** Sequência em vigor hoje: some se o último dia feito não foi hoje nem ontem. */
export const sequenciaAtual = (diario, dia) => (diario?.ultimoDia === dia || diario?.ultimoDia === diaAnterior(dia) ? diario.sequencia : 0);

/** Normaliza o que veio do disco. */
export function limparDiario(b) {
  if (!b || typeof b !== 'object' || !DIA.test(b.ultimoDia ?? '') || Number.isNaN(Date.parse(b.ultimoDia))) return diarioVazio();
  const n = v => (Number.isInteger(v) && v >= 1 && v <= 100000 ? v : 1);
  const sequencia = n(b.sequencia);
  return { ultimoDia: b.ultimoDia, sequencia, melhor: Math.max(sequencia, n(b.melhor)) };
}
