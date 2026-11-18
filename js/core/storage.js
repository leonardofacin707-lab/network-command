// Persistência no localStorage, com formato versionado e validação.
// Nunca guarda senhas nem dados pessoais além do nome de exibição escolhido pelo jogador.
export const CHAVE = 'network-command';
export const CHAVE_V1 = 'jornada-do-pacote-v1'; // formato da v0.1: { melhor: { [nivel]: { pts, estrelas } } }
export const VERSAO = 2;

export const estadoInicial = () => ({
  versao: VERSAO,
  perfil: { nome: '', criadoEm: new Date().toISOString() },
  quiz: { melhor: {} }
});

const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/**
 * Limpa o mapa de melhores resultados: descarta entradas inválidas em vez de quebrar o jogo.
 * limites = { [idDoNivel]: pontosMaximos }; níveis que não estão em limites são descartados.
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

/** Converte qualquer coisa lida do disco (v1, v2 ou lixo) em um estado v2 válido. */
export function normalizar(bruto, limites) {
  const base = estadoInicial();
  if (!bruto || typeof bruto !== 'object') return base;
  const ehV2 = bruto.versao === VERSAO;
  const melhorBruto = ehV2 ? bruto.quiz?.melhor : bruto.melhor; // sem "versao" = formato v1
  base.quiz.melhor = limparMelhor(melhorBruto, limites);
  if (ehV2 && typeof bruto.perfil?.nome === 'string') base.perfil.nome = bruto.perfil.nome.slice(0, 40);
  if (ehV2 && typeof bruto.perfil?.criadoEm === 'string' && !Number.isNaN(Date.parse(bruto.perfil.criadoEm))) {
    base.perfil.criadoEm = bruto.perfil.criadoEm;
  }
  return base;
}

function lerJson(armazenamento, chave) {
  try { return JSON.parse(armazenamento.getItem(chave)); } catch { return null; }
}

/** Carrega o estado. Se só existir o formato v1, migra sem apagar o original. */
export function carregar(limites, armazenamento = globalThis.localStorage) {
  if (!armazenamento) return estadoInicial();
  const atual = lerJson(armazenamento, CHAVE);
  if (atual) return normalizar(atual, limites);
  const v1 = lerJson(armazenamento, CHAVE_V1);
  return normalizar(v1, limites);
}

/** Salva o estado. Devolve false se o navegador não permitir (o jogo segue funcionando sem salvar). */
export function salvar(estado, armazenamento = globalThis.localStorage) {
  try { armazenamento.setItem(CHAVE, JSON.stringify(estado)); return true; } catch { return false; }
}
