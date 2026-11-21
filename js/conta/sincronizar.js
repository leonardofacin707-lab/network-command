// Sincronização entre aparelhos sem servidor (sem DOM): o progresso vira um código de texto que o jogador leva
// de um aparelho a outro (copiar e colar, ou um link). Ao receber, dá para juntar os dois progressos ou substituir.
// O código só passa pelo caminho que o próprio jogador escolher (ex.: mandar para si mesmo); o jogo não envia nada.
import { MAX_HISTORICO } from '../core/storage.js';

export const PREFIXO_COMPACTO = 'NC1.'; // JSON comprimido (deflate) em base64url
export const PREFIXO_SIMPLES = 'NC0.';  // JSON em base64url, para navegadores sem CompressionStream
export const MAX_CODIGO = 2_000_000;    // caracteres aceitos ao colar
export const MAX_JSON = 1_000_000;      // bytes depois de descomprimir (mesmo limite do backup)
const APP = 'network-command';

const paraBase64url = bytes => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const deBase64url = txt => {
  if (!/^[A-Za-z0-9_-]*$/.test(txt)) throw new Error('caracteres inválidos');
  const bin = atob(txt.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (txt.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

async function lerStream(stream, limite) {
  const leitor = stream.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > limite) { await leitor.cancel(); throw new Error('grande demais'); }
    partes.push(value);
  }
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }
  return saida;
}

const temCompressao = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** Gera o código de sincronização. As preferências do aparelho (config) não entram. */
export async function codificarEstado(estado, { comprimir = temCompressao() } = {}) {
  const { config, ...progresso } = estado;
  const bytes = new TextEncoder().encode(JSON.stringify({ app: APP, estado: progresso }));
  if (!comprimir) return PREFIXO_SIMPLES + paraBase64url(bytes);
  const comprimido = await lerStream(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')), Infinity);
  return PREFIXO_COMPACTO + paraBase64url(comprimido);
}

/** Aceita o código puro ou o link inteiro (…#/sincronizar/<código>). */
export function extrairCodigo(texto) {
  const t = String(texto ?? '').trim();
  const m = t.match(/#\/sincronizar\/([^\s/?#]+)/);
  return (m ? decodeURIComponent(m[1]) : t).replace(/\s+/g, '');
}

/** Lê um código. Devolve { estado } (ainda sem validar: quem chama passa por normalizar) ou { erro }. */
export async function decodificarCodigo(texto) {
  const codigo = extrairCodigo(texto);
  if (!codigo) return { erro: 'Cole o código ou o link de sincronização.' };
  if (codigo.length > MAX_CODIGO) return { erro: 'O código é grande demais.' };
  const compacto = codigo.startsWith(PREFIXO_COMPACTO);
  if (!compacto && !codigo.startsWith(PREFIXO_SIMPLES)) return { erro: 'Isso não parece um código de sincronização do Network Command.' };
  let dados;
  try {
    let bytes = deBase64url(codigo.slice(4));
    if (compacto) {
      if (typeof DecompressionStream !== 'function') return { erro: 'Este navegador não consegue ler códigos comprimidos. Atualize o navegador.' };
      bytes = await lerStream(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')), MAX_JSON);
    } else if (bytes.length > MAX_JSON) return { erro: 'O código é grande demais.' };
    dados = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { erro: 'O código está incompleto ou foi alterado. Copie de novo no outro aparelho.' };
  }
  if (!dados || dados.app !== APP || !dados.estado || typeof dados.estado !== 'object' || Array.isArray(dados.estado)) {
    return { erro: 'Isso não parece um código de sincronização do Network Command.' };
  }
  return { estado: dados.estado };
}

// ---------- junção de dois progressos ----------
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const tempo = s => { const t = Date.parse(s); return Number.isNaN(t) ? Infinity : t; };
const maisCedo = (a, b) => (tempo(b) < tempo(a) ? b : a);

/** Concluído ganha de não concluído; entre dois concluídos, o de mais XP (empate: o mais antigo). */
function melhorProgresso(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.concluida !== b.concluida) return a.concluida ? a : b;
  if (!a.concluida) return a; // nenhum concluído: fica o que está neste aparelho
  if ((b.xp ?? 0) !== (a.xp ?? 0)) return (b.xp ?? 0) > (a.xp ?? 0) ? b : a;
  return tempo(b.em) < tempo(a.em) ? b : a;
}
function juntarMapa(a, b, fn) {
  const saida = { ...obj(a) };
  for (const [id, v] of Object.entries(obj(b))) saida[id] = id in saida ? fn(saida[id], v) : v;
  return saida;
}

/**
 * Junta o progresso deste aparelho (local) com o de outro. Nada se perde: fica o melhor de cada item.
 * Preferências (config) e o laboratório livre deste aparelho têm prioridade. O resultado ainda passa por normalizar.
 */
export function mesclarEstados(local, outro) {
  const a = obj(local), b = obj(outro);
  const historico = new Map();
  for (const r of [...(a.quiz?.historico ?? []), ...(b.quiz?.historico ?? [])]) if (r && typeof r === 'object') historico.set(`${r.q}|${r.em}`, r);
  const diarioA = obj(a.diario), diarioB = obj(b.diario);
  const diaA = diarioA.ultimoDia ?? '', diaB = diarioB.ultimoDia ?? '';
  const diario = {
    ultimoDia: (diaA >= diaB ? diarioA.ultimoDia : diarioB.ultimoDia) ?? null,
    sequencia: diaA === diaB ? Math.max(diarioA.sequencia ?? 0, diarioB.sequencia ?? 0) : (diaA > diaB ? diarioA.sequencia : diarioB.sequencia) ?? 0,
    melhor: Math.max(diarioA.melhor ?? 0, diarioB.melhor ?? 0)
  };
  const tutA = obj(a.tutorial), tutB = obj(b.tutorial);
  return {
    ...b, ...a,
    perfil: { nome: a.perfil?.nome || b.perfil?.nome || '', criadoEm: maisCedo(a.perfil?.criadoEm, b.perfil?.criadoEm) },
    quiz: {
      melhor: juntarMapa(a.quiz?.melhor, b.quiz?.melhor, (x, y) => ({ pts: Math.max(x.pts ?? 0, y.pts ?? 0), estrelas: Math.max(x.estrelas ?? 0, y.estrelas ?? 0) })),
      historico: [...historico.values()].sort((x, y) => tempo(x.em) - tempo(y.em)).slice(-MAX_HISTORICO)
    },
    conquistas: juntarMapa(a.conquistas, b.conquistas, maisCedo),
    lab: (a.lab?.topologia?.dispositivos ?? []).length ? a.lab : (b.lab ?? a.lab),
    missoes: juntarMapa(a.missoes, b.missoes, melhorProgresso),
    empresa: juntarMapa(a.empresa, b.empresa, melhorProgresso),
    datacenter: juntarMapa(a.datacenter, b.datacenter, melhorProgresso),
    diario,
    simulados: juntarMapa(a.simulados, b.simulados, (x, y) => {
      const melhor = (y.melhor ?? 0) > (x.melhor ?? 0) ? y : x;
      return { melhor: melhor.melhor, em: melhor.em, tentativas: Math.max(x.tentativas ?? 1, y.tentativas ?? 1) };
    }),
    tutorial: {
      concluido: tutA.concluido === true || tutB.concluido === true,
      em: tutA.concluido && tutB.concluido ? maisCedo(tutA.em, tutB.em) : tutA.concluido ? tutA.em : tutB.concluido ? tutB.em : null,
      topologia: (tutA.topologia?.dispositivos ?? []).length ? tutA.topologia : tutB.topologia ?? tutA.topologia
    },
    config: a.config
  };
}

/** Números para comparar os dois lados antes de decidir. */
export function resumoProgresso(e) {
  const feitas = m => Object.values(obj(m)).filter(x => x?.concluida).length;
  return {
    nome: e.perfil?.nome || '',
    niveis: Object.keys(obj(e.quiz?.melhor)).length,
    respostas: (e.quiz?.historico ?? []).length,
    missoes: feitas(e.missoes),
    projetos: feitas(e.empresa) + feitas(e.datacenter),
    conquistas: Object.keys(obj(e.conquistas)).length,
    simulados: Object.keys(obj(e.simulados)).length
  };
}
