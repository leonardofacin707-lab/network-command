import { normalizarTopologia, topologiaVazia } from '../sim/topologia.js';
import { diarioVazio, limparDiario } from '../quiz/diario.js';
import { limparSimulados } from '../quiz/simulado.js';
import { configPadrao, limparConfig } from './config.js';

// Persistência no localStorage, com formato versionado e validação.
// Nunca guarda senhas nem dados pessoais além do nome de exibição escolhido pelo jogador.
export const CHAVE = 'network-command';
export const CHAVE_V1 = 'jornada-do-pacote-v1'; // formato da v0.1: { melhor: { [nivel]: { pts, estrelas } } }
export const VERSAO = 4;
export const MAX_HISTORICO = 300;
export const MAX_NOME = 40;
/** Caracteres aceitos no nome de exibição (também na importação de backup: defesa em profundidade contra injeção). */
export const NOME_VALIDO = /^[\p{L}\p{N} ._'-]+$/u;

export const estadoInicial = () => ({
  versao: VERSAO,
  perfil: { nome: '', criadoEm: new Date().toISOString() },
  quiz: { melhor: {}, historico: [] },
  conquistas: {},
  lab: { topologia: topologiaVazia() },   // laboratório livre
  missoes: {},                            // { [id]: { topologia, concluida, em, xp, dicas } }
  datacenter: {},                         // { [desafioId]: { unidades: {camada: n}, concluida, em, xp } }
  empresa: {},                            // { [projetoId]: { prefixos: {setor: n}, equip: {item: qtd}, concluida, em, xp } }
  diario: diarioVazio(),                  // desafio do dia: { ultimoDia, sequencia, melhor }
  simulados: {},                          // { geral | m<n>: { melhor (%), em, tentativas } }
  tutorial: tutorialVazio(),              // { concluido, em, topologia } (tutorial guiado)
  config: configPadrao()                  // preferências deste aparelho (não vão na sincronização)
});

export const tutorialVazio = () => ({ concluido: false, em: null, topologia: topologiaVazia() });
/** Tutorial: conclusão só vale com data válida; a topologia passa pela mesma validação do laboratório. */
export function limparTutorial(b) {
  const t = tutorialVazio();
  if (!b || typeof b !== 'object' || Array.isArray(b)) return t;
  if (b.concluido === true && dataValida(b.em)) { t.concluido = true; t.em = b.em; }
  t.topologia = normalizarTopologia(b.topologia);
  return t;
}

const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const dataValida = s => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/**
 * Referência usada para validar o que vem do disco (montada a partir do catálogo):
 *   limites   { [idDoNivel]: pontosMaximos }
 *   perguntas Set com os ids de perguntas que existem
 *   conquistas Set com os ids de conquistas que existem
 *   missoes   Set com os ids de missões que existem
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

export function limparMissoes(bruto, conhecidas) {
  const limpo = {};
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return limpo;
  for (const [id, m] of Object.entries(bruto)) {
    if (!conhecidas.has(id) || !m || typeof m !== 'object') continue;
    const concluida = m.concluida === true && inteiro(m.xp, 1, 1000) && dataValida(m.em); // conclusão sem XP ou data válidos não vale
    limpo[id] = {
      topologia: normalizarTopologia(m.topologia),
      concluida,
      em: concluida && dataValida(m.em) ? m.em : null,
      xp: concluida && inteiro(m.xp, 0, 1000) ? m.xp : 0,
      dicas: inteiro(m.dicas, 0, 9) ? m.dicas : 0
    };
  }
  return limpo;
}

const CHAVE_ID = /^[a-z0-9-]{1,40}$/;
/** Projetos da Empresa: só ids conhecidos; prefixos e quantidades são números inteiros em faixas válidas. */
export function limparEmpresa(bruto, conhecidos) {
  const limpo = {};
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return limpo;
  const mapa = (o, a, b) => {
    const saida = {};
    if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) if (CHAVE_ID.test(k) && inteiro(v, a, b) && Object.keys(saida).length < 30) saida[k] = v;
    return saida;
  };
  for (const [id, p] of Object.entries(bruto)) {
    if (!conhecidos.has(id) || !p || typeof p !== 'object') continue;
    const concluida = p.concluida === true && inteiro(p.xp, 1, 1000) && dataValida(p.em);
    limpo[id] = { prefixos: mapa(p.prefixos, 8, 30), equip: mapa(p.equip, 0, 50), concluida,
      em: concluida && dataValida(p.em) ? p.em : null, xp: concluida && inteiro(p.xp, 0, 1000) ? p.xp : 0 };
  }
  return limpo;
}

/** Desafios do Data Center: só ids conhecidos; unidades por camada são inteiros de 0 a 8. */
export function limparDatacenter(bruto, conhecidos) {
  const limpo = {};
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return limpo;
  for (const [id, p] of Object.entries(bruto)) {
    if (!conhecidos.has(id) || !p || typeof p !== 'object') continue;
    const unidades = {};
    if (p.unidades && typeof p.unidades === 'object' && !Array.isArray(p.unidades)) {
      for (const [k, v] of Object.entries(p.unidades)) if (CHAVE_ID.test(k) && inteiro(v, 0, 8) && Object.keys(unidades).length < 30) unidades[k] = v;
    }
    const concluida = p.concluida === true && inteiro(p.xp, 1, 1000) && dataValida(p.em);
    limpo[id] = { unidades, concluida, em: concluida ? p.em : null, xp: concluida ? p.xp : 0 };
  }
  return limpo;
}

/** Converte qualquer coisa lida do disco (v1 a v4 ou lixo) em um estado v4 válido. */
export function normalizar(bruto, ref) {
  const base = estadoInicial();
  if (!bruto || typeof bruto !== 'object') return base;
  const versao = bruto.versao;
  const ehNovo = versao === 2 || versao === 3 || versao === VERSAO; // v2 e v3 são versões anteriores do mesmo formato
  const melhorBruto = ehNovo ? bruto.quiz?.melhor : bruto.melhor; // sem "versao" = formato v1
  base.quiz.melhor = limparMelhor(melhorBruto, ref.limites);
  if (ehNovo) {
    if (typeof bruto.perfil?.nome === 'string') {
      const nome = bruto.perfil.nome.replace(/\s+/g, ' ').trim().slice(0, MAX_NOME).trim();
      if (NOME_VALIDO.test(nome)) base.perfil.nome = nome;
    }
    if (dataValida(bruto.perfil?.criadoEm)) base.perfil.criadoEm = bruto.perfil.criadoEm;
    base.quiz.historico = limparHistorico(bruto.quiz?.historico, ref.perguntas);
    base.conquistas = limparConquistas(bruto.conquistas, ref.conquistas);
    base.lab = { topologia: normalizarTopologia(bruto.lab?.topologia) };
    base.missoes = limparMissoes(bruto.missoes, ref.missoes ?? new Set());
    base.empresa = limparEmpresa(bruto.empresa, ref.empresa ?? new Set());
    base.datacenter = limparDatacenter(bruto.datacenter, ref.datacenter ?? new Set());
    base.diario = limparDiario(bruto.diario);
    base.simulados = limparSimulados(bruto.simulados);
    base.tutorial = limparTutorial(bruto.tutorial);
    base.config = limparConfig(bruto.config);
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
