// Persistência no localStorage, com formato versionado e validação.
// Nunca guarda senhas nem dados pessoais além do nome de exibição escolhido pelo jogador.
export const CHAVE = 'network-command';
export const CHAVE_V1 = 'jornada-do-pacote-v1'; // formato da v0.1: { melhor: { [nivel]: { pts, estrelas } } }
export const VERSAO = 3;
export const MAX_HISTORICO = 300;
export const MAX_NOME = 40;

export const estadoInicial = () => ({
  versao: VERSAO,
  perfil: { nome: '', criadoEm: new Date().toISOString() },
  quiz: { melhor: {}, historico: [] },
  conquistas: {}
});

const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const dataValida = s => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/**
 * Referência usada para validar o que vem do disco (montada a partir do catálogo):
 *   limites   { [idDoNivel]: pontosMaximos }
 *   perguntas Set com os ids de perguntas que existem
 *   conquistas Set com os ids de conquistas que existem
 */
export function limparMelhor(bruto, limites) {
  const limpo = {};
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return limpo;
  for (const [id, m] of Object.entries(bruto)) {
    const max = limites[id];
    if (max === undefined || !m || typeof m !== 'object') continue;
    if (inteiro(m.pts, 0, max) && inteiro(m.estrelas, 0, 3)) limpo[id] = { pts: m.pts, estrelas: m.estrelas };
  }
  return limpo;
}

export function limparHistorico(bruto, perguntas) {
  if (!Array.isArray(bruto)) return [];
  const limpo = [];
  for (const r of bruto) {
    if (!r || typeof r !== 'object' || !perguntas.has(r.q) || typeof r.ok !== 'boolean') continue;
    if (!inteiro(r.erros, 0, 99) || !inteiro(r.pts, 0, 100) || !dataValida(r.em)) continue;
    limpo.push({ q: r.q, ok: r.ok, erros: r.erros, pts: r.pts, em: r.em });
  }
  return limpo.slice(-MAX_HISTORICO);
}

export function limparConquistas(bruto, conhecidas) {
  const limpo = {};
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return limpo;
  for (const [id, em] of Object.entries(bruto)) if (conhecidas.has(id) && dataValida(em)) limpo[id] = em;
  return limpo;
}

/** Converte qualquer coisa lida do disco (v1, v2, v3 ou lixo) em um estado v3 válido. */
export function normalizar(bruto, ref) {
  const base = estadoInicial();
  if (!bruto || typeof bruto !== 'object') return base;
  const versao = bruto.versao;
  const ehNovo = versao === 2 || versao === VERSAO; // v2 é igual à v3 sem histórico e conquistas
  const melhorBruto = ehNovo ? bruto.quiz?.melhor : bruto.melhor; // sem "versao" = formato v1
  base.quiz.melhor = limparMelhor(melhorBruto, ref.limites);
  if (ehNovo) {
    if (typeof bruto.perfil?.nome === 'string') base.perfil.nome = bruto.perfil.nome.trim().slice(0, MAX_NOME);
    if (dataValida(bruto.perfil?.criadoEm)) base.perfil.criadoEm = bruto.perfil.criadoEm;
    base.quiz.historico = limparHistorico(bruto.quiz?.historico, ref.perguntas);
    base.conquistas = limparConquistas(bruto.conquistas, ref.conquistas);
  }
  return base;
}

function lerJson(armazenamento, chave) {
  try { return JSON.parse(armazenamento.getItem(chave)); } catch { return null; }
}

/** Carrega o estado. Se só existir o formato v1, migra sem apagar o original. */
export function carregar(ref, armazenamento = globalThis.localStorage) {
  if (!armazenamento) return estadoInicial();
  const atual = lerJson(armazenamento, CHAVE);
  if (atual) return normalizar(atual, ref);
  return normalizar(lerJson(armazenamento, CHAVE_V1), ref);
}

/** Salva o estado. Devolve false se o navegador não permitir (o jogo segue funcionando sem salvar). */
export function salvar(estado, armazenamento = globalThis.localStorage) {
  try { armazenamento.setItem(CHAVE, JSON.stringify(estado)); return true; } catch { return false; }
}

/** Apaga o progresso salvo (as duas chaves). */
export function apagar(armazenamento = globalThis.localStorage) {
  try { armazenamento.removeItem(CHAVE); armazenamento.removeItem(CHAVE_V1); return true; } catch { return false; }
}
