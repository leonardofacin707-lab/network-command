// Regras do planejamento de rede da empresa (sem DOM): dimensionamento de sub-redes (VLSM) e de equipamentos.
// Usa a aritmética IPv4 do motor (js/sim/ipv4.js). Não simula tráfego: só verifica se o projeto cabe e fecha as contas.
import { lerIPv4, formatarIPv4, mascaraDePrefixo, enderecoDeRede, enderecoDeBroadcast, hostsUteis } from '../sim/ipv4.js';

export const PREFIXO_MIN = 16, PREFIXO_MAX = 30, MAX_QTD = 50;
export const LIMITE_DESPERDICIO = 4; // aviso (não bloqueia) quando a sub-rede oferece mais de 4x o necessário

/** Endereços necessários de um setor: hosts + crescimento (arredondado para cima) + 1 para o gateway. */
export const enderecosNecessarios = (hosts, crescimentoPct) => Math.floor((hosts * (100 + crescimentoPct) + 99) / 100) + 1;

/** Hosts úteis oferecidos por um prefixo (2^(32-p) - 2). */
export const capacidade = prefixo => hostsUteis(mascaraDePrefixo(prefixo));

/** Menor prefixo (maior sub-rede que ainda cabe) que atende à necessidade; usado só nos testes e na resposta de referência. */
export function prefixoMinimoPara(necessarios) {
  for (let p = PREFIXO_MAX; p >= PREFIXO_MIN; p--) if (capacidade(p) >= necessarios) return p;
  return null;
}

/**
 * Aloca blocos dentro do bloco-base, do maior para o menor, em sequência alinhada.
 * itens: [{ id, prefixo }]. Devolve { ok, blocos (na ordem recebida) } ou { ok:false, erro }.
 */
export function alocarVlsm(blocoTexto, itens) {
  const [ipTxt, pTxt] = String(blocoTexto).split('/');
  const base = lerIPv4(ipTxt), pBase = Number(pTxt);
  if (base === null || !Number.isInteger(pBase) || pBase < 8 || pBase > 30) return { ok: false, erro: 'Bloco-base inválido.' };
  const rede0 = enderecoDeRede(base, mascaraDePrefixo(pBase));
  const fim = rede0 + 2 ** (32 - pBase);
  const ordem = itens.map((it, i) => ({ ...it, i })).sort((a, b) => a.prefixo - b.prefixo || a.i - b.i);
  let cursor = rede0;
  const alocados = new Array(itens.length);
  for (const it of ordem) {
    if (!Number.isInteger(it.prefixo) || it.prefixo < pBase || it.prefixo > PREFIXO_MAX) return { ok: false, erro: `Prefixo /${it.prefixo} não cabe no bloco /${pBase}.` };
    const tam = 2 ** (32 - it.prefixo);
    if (cursor + tam > fim) return { ok: false, erro: 'Os blocos escolhidos não cabem no bloco recebido.' };
    const m = mascaraDePrefixo(it.prefixo);
    alocados[it.i] = {
      id: it.id, prefixo: it.prefixo, rede: formatarIPv4(cursor), mascara: formatarIPv4(m),
      primeiro: formatarIPv4(cursor + 1), ultimo: formatarIPv4(enderecoDeBroadcast(cursor, m) - 1), broadcast: formatarIPv4(enderecoDeBroadcast(cursor, m)), uteis: capacidade(it.prefixo)
    };
    cursor += tam;
  }
  return { ok: true, blocos: alocados, usados: cursor - rede0, total: fim - rede0 };
}

/**
 * Avalia um plano { prefixos: {setorId: n}, equip: {equipId: qtd} } contra o projeto.
 * Devolve { itens: [{ id, texto, ok, detalhe }], avisos, custo, aprovado, blocos }.
 */
export function avaliarProjeto(projeto, equipamentos, plano) {
  const itens = [], avisos = [];
  const prefixos = plano.prefixos ?? {}, equip = plano.equip ?? {};

  // 1. Cada setor: escolheu um prefixo e ele comporta hosts + crescimento + gateway.
  const escolhidos = [];
  for (const s of projeto.setores) {
    const need = enderecosNecessarios(s.hosts, projeto.crescimento);
    const p = prefixos[s.id];
    if (!Number.isInteger(p)) { itens.push({ id: `sub-${s.id}`, texto: `Sub-rede de ${s.nome}`, ok: false, detalhe: `escolha um prefixo (precisa de ${need} endereços)` }); continue; }
    const cap = capacidade(p);
    escolhidos.push({ id: s.id, prefixo: p });
    if (cap < need) itens.push({ id: `sub-${s.id}`, texto: `Sub-rede de ${s.nome}`, ok: false, detalhe: `/${p} oferece ${cap} hosts, mas são necessários ${need}` });
    else {
      itens.push({ id: `sub-${s.id}`, texto: `Sub-rede de ${s.nome}`, ok: true, detalhe: `/${p} oferece ${cap} hosts para ${need} necessários` });
      if (cap > need * LIMITE_DESPERDICIO) avisos.push(`${s.nome}: /${p} é muito maior que o necessário (${cap} para ${need}); isso desperdiça endereços.`);
    }
  }

  // 2. Os blocos cabem no bloco recebido (VLSM).
  let blocos = [];
  if (escolhidos.length === projeto.setores.length) {
    const r = alocarVlsm(projeto.bloco, escolhidos);
    if (r.ok) { blocos = r.blocos; itens.push({ id: 'vlsm', texto: `Cabem no bloco ${projeto.bloco}`, ok: true, detalhe: `${r.usados} de ${r.total} endereços usados` }); }
    else itens.push({ id: 'vlsm', texto: `Cabem no bloco ${projeto.bloco}`, ok: false, detalhe: r.erro });
  } else itens.push({ id: 'vlsm', texto: `Cabem no bloco ${projeto.bloco}`, ok: false, detalhe: 'defina todas as sub-redes primeiro' });

  // 3. Portas: cada switch gasta 1 porta com o enlace para o roteador.
  const qtd = id => (Number.isInteger(equip[id]) && equip[id] > 0 ? Math.min(equip[id], MAX_QTD) : 0);
  const switches = equipamentos.filter(e => e.portas > 0);
  const portas = switches.reduce((s, e) => s + qtd(e.id) * e.portas, 0);
  const nSw = switches.reduce((s, e) => s + qtd(e.id), 0);
  const hosts = projeto.setores.reduce((s, x) => s + x.hosts, 0);
  const uteis = portas - nSw;
  itens.push({ id: 'portas', texto: 'Portas para todos os computadores', ok: uteis >= hosts, detalhe: `${Math.max(uteis, 0)} portas úteis (${portas} − ${nSw} de enlace) para ${hosts} dispositivos` });

  // 4. Roteador para ligar as sub-redes.
  const roteadores = equipamentos.filter(e => e.roteador).reduce((s, e) => s + qtd(e.id), 0);
  itens.push({ id: 'roteador', texto: 'Roteador entre as sub-redes', ok: roteadores >= 1, detalhe: roteadores >= 1 ? `${roteadores} roteador(es)` : 'nenhum roteador: as sub-redes não se comunicam' });

  // 5. Orçamento.
  const custo = equipamentos.reduce((s, e) => s + qtd(e.id) * e.custo, 0);
  itens.push({ id: 'orcamento', texto: 'Dentro do orçamento', ok: custo <= projeto.orcamento, detalhe: `custo ${custo} de ${projeto.orcamento}` });

  return { itens, avisos, custo, blocos, aprovado: itens.every(i => i.ok) };
}

/** Valida um projeto lido do JSON; devolve o projeto normalizado ou null. */
export function validarProjeto(p) {
  if (!p || typeof p !== 'object' || !/^[a-z0-9-]{1,40}$/.test(p.id ?? '')) return null;
  if (typeof p.titulo !== 'string' || typeof p.cenario !== 'string') return null;
  const [ip, pTxt] = String(p.bloco ?? '').split('/');
  if (lerIPv4(ip) === null || !Number.isInteger(Number(pTxt)) || Number(pTxt) < 8 || Number(pTxt) > 30) return null;
  const vistos = new Set();
  const setores = (Array.isArray(p.setores) ? p.setores : []).filter(s => s && /^[a-z0-9-]{1,30}$/.test(s.id ?? '') && typeof s.nome === 'string'
    && Number.isInteger(s.hosts) && s.hosts >= 1 && s.hosts <= 500 && !vistos.has(s.id) && vistos.add(s.id));
  if (!setores.length) return null;
  const inteiro = (v, a, b, d) => (Number.isInteger(v) && v >= a && v <= b ? v : d);
  return { id: p.id, titulo: p.titulo, cenario: p.cenario, bloco: p.bloco, setores,
    orcamento: inteiro(p.orcamento, 1, 1e6, 1000), crescimento: inteiro(p.crescimento, 0, 300, 20),
    xp: inteiro(p.xp, 1, 1000, 100), dificuldade: [1, 2, 3].includes(p.dificuldade) ? p.dificuldade : 1,
    habilidades: (Array.isArray(p.habilidades) ? p.habilidades : []).filter(h => typeof h === 'string' && /^[a-z-]{1,30}\.(teoria|pratica|diagnostico)$/.test(h)).slice(0, 4) };
}

export function validarEquipamentos(lista) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).filter(e => e && /^[a-z0-9-]{1,30}$/.test(e.id ?? '') && typeof e.nome === 'string'
    && Number.isInteger(e.portas) && e.portas >= 0 && Number.isInteger(e.custo) && e.custo > 0 && !vistos.has(e.id) && vistos.add(e.id))
    .map(e => ({ id: e.id, nome: e.nome, portas: e.portas, custo: e.custo, roteador: e.roteador === true }));
}

/** XP ganho: o projeto paga uma vez, quando aprovado. */
export const calcularXpProjeto = projeto => projeto.xp;

/** Quanto o projeto aprovado mais barato custaria (referência para testes): busca exaustiva simples. */
export function menorCusto(projeto, equipamentos) {
  const hosts = projeto.setores.reduce((s, x) => s + x.hosts, 0);
  const roteador = equipamentos.find(e => e.roteador);
  const sws = equipamentos.filter(e => e.portas > 0);
  let melhor = Infinity;
  const rec = (i, portas, custo) => {
    if (custo >= melhor) return;
    if (i === sws.length) { if (portas >= hosts) melhor = Math.min(melhor, custo + (roteador?.custo ?? 0)); return; }
    for (let q = 0; q <= 12; q++) rec(i + 1, portas + q * (sws[i].portas - 1), custo + q * sws[i].custo);
  };
  rec(0, 0, 0);
  return melhor;
}
