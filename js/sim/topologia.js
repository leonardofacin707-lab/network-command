// Modelo da topologia do laboratório: dispositivos, interfaces e cabos. Funções puras e imutáveis, sem DOM.
// Cada operação devolve { topologia, ... } ou { erro } com uma mensagem em português.
import { lerIPv4, lerMascara, validarEnderecoDeHost, formatarIPv4, enderecoDeRede, mesmaRede } from './ipv4.js';

export const LARGURA = 900;
export const ALTURA = 520;
export const MAX_DISPOSITIVOS = 16;
export const TIPOS = {
  pc: { rotulo: 'Computador', prefixo: 'PC', idPrefixo: 'pc', portas: [{ id: 'eth0', rotulo: 'Ethernet0', ip: true }] },
  switch: { rotulo: 'Switch', prefixo: 'SW', idPrefixo: 'sw', portas: Array.from({ length: 8 }, (_, i) => ({ id: `fa${i + 1}`, rotulo: `Fa0/${i + 1}`, ip: false })) },
  roteador: { rotulo: 'Roteador', prefixo: 'R', idPrefixo: 'r', portas: [{ id: 'gi0', rotulo: 'Gi0/0', ip: true }, { id: 'gi1', rotulo: 'Gi0/1', ip: true }] }
};

export const topologiaVazia = () => ({ dispositivos: [], cabos: [] });

export const dispositivo = (t, id) => t.dispositivos.find(d => d.id === id) ?? null;
export const rotuloDaPorta = (d, portaId) => TIPOS[d.tipo].portas.find(p => p.id === portaId)?.rotulo ?? portaId;
export const portaUsada = (t, id, portaId) => t.cabos.some(c => (c.a.d === id && c.a.p === portaId) || (c.b.d === id && c.b.p === portaId));
export const portasLivres = (t, id) => TIPOS[dispositivo(t, id).tipo].portas.filter(p => !portaUsada(t, id, p.id));

/** Quem está do outro lado de cada cabo deste dispositivo: [{ cabo, minhaPorta, outro: { d, p } }]. */
export function vizinhos(t, id) {
  const lista = [];
  for (const c of t.cabos) {
    if (c.a.d === id) lista.push({ cabo: c, minhaPorta: c.a.p, outro: c.b });
    else if (c.b.d === id) lista.push({ cabo: c, minhaPorta: c.b.p, outro: c.a });
  }
  return lista;
}

const NOME_VALIDO = /^[A-Za-z0-9][A-Za-z0-9_-]{0,14}$/;
const limitar = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

function novoDispositivo(t, tipo, pos) {
  const def = TIPOS[tipo];
  let n = 1;
  while (t.dispositivos.some(d => d.id === `${def.idPrefixo}${n}`)) n++;
  const d = {
    id: `${def.idPrefixo}${n}`, tipo, nome: `${def.prefixo}${n}`,
    x: limitar(pos?.x ?? 120 + (t.dispositivos.length % 5) * 150, 40, LARGURA - 40),
    y: limitar(pos?.y ?? 110 + Math.floor(t.dispositivos.length / 5) * 140, 40, ALTURA - 40),
    interfaces: def.portas.filter(p => p.ip).map(p => ({ id: p.id, ip: '', mascara: '' }))
  };
  if (tipo === 'pc') d.gateway = '';
  if (tipo === 'roteador') d.rotas = []; // rotas estáticas: [{ rede, mascara, via }]
  if (tipo === 'switch') d.portas = {}; // configuração das portas, só o que foge do padrão (access, VLAN 1)
  return d;
}

export function adicionarDispositivo(t, tipo, pos) {
  if (!TIPOS[tipo]) return { erro: 'Tipo de dispositivo desconhecido.' };
  if (t.dispositivos.length >= MAX_DISPOSITIVOS) return { erro: `O laboratório comporta no máximo ${MAX_DISPOSITIVOS} dispositivos.` };
  const d = novoDispositivo(t, tipo, pos);
  return { topologia: { ...t, dispositivos: [...t.dispositivos, d] }, id: d.id };
}

const trocar = (t, id, fn) => ({ ...t, dispositivos: t.dispositivos.map(d => (d.id === id ? fn(d) : d)) });

export function moverDispositivo(t, id, x, y) {
  if (!dispositivo(t, id)) return { erro: 'Dispositivo não encontrado.' };
  return { topologia: trocar(t, id, d => ({ ...d, x: limitar(x, 40, LARGURA - 40), y: limitar(y, 40, ALTURA - 40) })) };
}

export function renomear(t, id, nome) {
  if (!dispositivo(t, id)) return { erro: 'Dispositivo não encontrado.' };
  const limpo = String(nome ?? '').trim();
  if (!NOME_VALIDO.test(limpo)) return { erro: 'Nome inválido. Use de 1 a 15 caracteres: letras, números, hífen ou sublinhado, começando por letra ou número.' };
  if (t.dispositivos.some(d => d.id !== id && d.nome.toLowerCase() === limpo.toLowerCase())) return { erro: 'Já existe um dispositivo com esse nome.' };
  return { topologia: trocar(t, id, d => ({ ...d, nome: limpo })) };
}

/** Configura IP e máscara de uma interface. Os dois vazios limpam a configuração. */
export function configurarInterface(t, id, portaId, { ip, mascara }) {
  const d = dispositivo(t, id);
  const interf = d?.interfaces.find(i => i.id === portaId);
  if (!interf) return { erro: 'Interface não encontrada.' };
  const ipTxt = String(ip ?? '').trim(), mTxt = String(mascara ?? '').trim();
  if (!ipTxt && !mTxt) return { topologia: trocar(t, id, x => ({ ...x, interfaces: x.interfaces.map(i => (i.id === portaId ? { id: i.id, ip: '', mascara: '' } : i)) })) };
  const ipN = lerIPv4(ipTxt), mN = lerMascara(mTxt);
  if (!ipTxt) return { erro: 'Informe o endereço IP (ou limpe também a máscara).' };
  if (!mTxt) return { erro: 'Informe a máscara de sub-rede (ou limpe também o IP).' };
  const erro = validarEnderecoDeHost(ipN, mN);
  if (erro) return { erro };
  const novo = { id: portaId, ip: formatarIPv4(ipN), mascara: formatarIPv4(mN) };
  return { topologia: trocar(t, id, x => ({ ...x, interfaces: x.interfaces.map(i => (i.id === portaId ? novo : i)) })) };
}

export const VLAN_MIN = 1, VLAN_MAX = 4094;
export const PORTA_PADRAO = Object.freeze({ modo: 'access', vlan: 1 });

/** Configuração de uma porta de switch: { modo: 'access'|'trunk', vlan }. Padrão: access na VLAN 1. */
export const configDaPortaSwitch = (d, portaId) => d.portas?.[portaId] ?? PORTA_PADRAO;

/** VLANs em uso nas portas de acesso que têm cabo (para o desenho do switch). */
export function vlansDoSwitch(t, id) {
  const d = dispositivo(t, id);
  const usadas = new Set();
  for (const v of vizinhos(t, id)) { const c = configDaPortaSwitch(d, v.minhaPorta); if (c.modo === 'access') usadas.add(c.vlan); }
  return [...usadas].sort((a, b) => a - b);
}

/** Configura uma porta de switch como access (com VLAN) ou trunk (leva todas as VLANs; VLAN nativa 1). */
export function configurarPortaSwitch(t, id, portaId, { modo, vlan }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'switch') return { erro: 'Só switches têm portas configuráveis.' };
  if (!TIPOS.switch.portas.some(p => p.id === portaId)) return { erro: 'Porta inexistente.' };
  if (modo !== 'access' && modo !== 'trunk') return { erro: 'Modo inválido. Use access ou trunk.' };
  let nova;
  if (modo === 'trunk') nova = { modo: 'trunk', vlan: 1 };
  else {
    const txt = String(vlan ?? '').trim();
    if (!/^\d{1,4}$/.test(txt) || Number(txt) < VLAN_MIN || Number(txt) > VLAN_MAX) return { erro: `VLAN inválida. Use um número de ${VLAN_MIN} a ${VLAN_MAX}.` };
    nova = { modo: 'access', vlan: Number(txt) };
  }
  const portas = { ...(d.portas ?? {}) };
  if (nova.modo === 'access' && nova.vlan === 1) delete portas[portaId]; else portas[portaId] = nova;
  return { topologia: trocar(t, id, x => ({ ...x, portas })) };
}

export const MAX_ROTAS = 16;

/**
 * Acrescenta uma rota estática a um roteador: "para chegar em rede/máscara, envie ao próximo salto (via)".
 * O próximo salto precisa estar em uma rede ligada diretamente ao roteador (alguma interface já configurada).
 */
export function adicionarRotaEstatica(t, id, { rede, mascara, via }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores têm rotas estáticas.' };
  const rN = lerIPv4(String(rede ?? '').trim()), mN = lerMascara(String(mascara ?? '').trim()), vN = lerIPv4(String(via ?? '').trim());
  if (rN === null) return { erro: 'Endereço da rede inválido. Use quatro números de 0 a 255 separados por ponto.' };
  if (mN === null) return { erro: 'Máscara inválida. Use, por exemplo, 255.255.255.0 ou /24.' };
  if (enderecoDeRede(rN, mN) !== rN) return { erro: `Isso não é um endereço de rede para essa máscara. O endereço de rede seria ${formatarIPv4(enderecoDeRede(rN, mN))}.` };
  if (vN === null) return { erro: 'Próximo salto inválido. Use o endereço IP do roteador vizinho.' };
  const minhas = d.interfaces.filter(i => i.ip);
  if (minhas.some(i => lerIPv4(i.ip) === vN)) return { erro: 'O próximo salto não pode ser um endereço deste próprio roteador.' };
  if (!minhas.some(i => mesmaRede(lerIPv4(i.ip), vN, lerMascara(i.mascara)))) {
    return { erro: 'O próximo salto precisa estar em uma rede ligada diretamente a este roteador. Configure antes o IP da interface correspondente.' };
  }
  const rotas = d.rotas ?? [];
  if (rotas.length >= MAX_ROTAS) return { erro: `Limite de ${MAX_ROTAS} rotas estáticas por roteador.` };
  const nova = { rede: formatarIPv4(rN), mascara: formatarIPv4(mN), via: formatarIPv4(vN) };
  if (rotas.some(r => r.rede === nova.rede && r.mascara === nova.mascara)) return { erro: 'Já existe uma rota para essa rede.' };
  return { topologia: trocar(t, id, x => ({ ...x, rotas: [...rotas, nova] })) };
}

export function removerRotaEstatica(t, id, indice) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador' || !Number.isInteger(indice) || indice < 0 || indice >= (d.rotas ?? []).length) return { erro: 'Rota não encontrada.' };
  return { topologia: trocar(t, id, x => ({ ...x, rotas: x.rotas.filter((_, i) => i !== indice) })) };
}

export function configurarGateway(t, id, gateway) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores têm gateway padrão.' };
  const txt = String(gateway ?? '').trim();
  if (!txt) return { topologia: trocar(t, id, x => ({ ...x, gateway: '' })) };
  const n = lerIPv4(txt);
  if (n === null) return { erro: 'Gateway inválido. Use quatro números de 0 a 255 separados por ponto.' };
  return { topologia: trocar(t, id, x => ({ ...x, gateway: formatarIPv4(n) })) };
}

/** Liga dois dispositivos usando a primeira porta livre de cada um (ou as portas indicadas). */
export function conectar(t, idA, idB, portaA, portaB) {
  const a = dispositivo(t, idA), b = dispositivo(t, idB);
  if (!a || !b) return { erro: 'Dispositivo não encontrado.' };
  if (idA === idB) return { erro: 'Não dá para ligar um dispositivo a ele mesmo.' };
  const pa = portaA ?? portasLivres(t, idA)[0]?.id, pb = portaB ?? portasLivres(t, idB)[0]?.id;
  if (!pa) return { erro: `${a.nome} não tem porta livre.` };
  if (!pb) return { erro: `${b.nome} não tem porta livre.` };
  if (!TIPOS[a.tipo].portas.some(p => p.id === pa) || !TIPOS[b.tipo].portas.some(p => p.id === pb)) return { erro: 'Porta inexistente.' };
  if (portaUsada(t, idA, pa) || portaUsada(t, idB, pb)) return { erro: 'Essa porta já está em uso.' };
  let n = 1;
  while (t.cabos.some(c => c.id === `c${n}`)) n++;
  const cabo = { id: `c${n}`, a: { d: idA, p: pa }, b: { d: idB, p: pb } };
  return { topologia: { ...t, cabos: [...t.cabos, cabo] }, cabo };
}

export const removerCabo = (t, caboId) => ({ topologia: { ...t, cabos: t.cabos.filter(c => c.id !== caboId) } });

export function removerDispositivo(t, id) {
  return { topologia: { dispositivos: t.dispositivos.filter(d => d.id !== id), cabos: t.cabos.filter(c => c.a.d !== id && c.b.d !== id) } };
}

/**
 * Valida uma topologia vinda de fora (arquivo salvo, importação, dados de missão).
 * Descarta o que for inválido em vez de quebrar; nunca confia na estrutura recebida.
 */
export function normalizarTopologia(bruto) {
  const saida = topologiaVazia();
  if (!bruto || typeof bruto !== 'object') return saida;
  const ids = new Set(), nomes = new Set();
  for (const b of Array.isArray(bruto.dispositivos) ? bruto.dispositivos : []) {
    if (saida.dispositivos.length >= MAX_DISPOSITIVOS) break;
    const def = b && TIPOS[b.tipo];
    if (!def || typeof b.id !== 'string' || !/^[a-z]{1,3}\d{1,3}$/.test(b.id) || ids.has(b.id)) continue;
    let nome = typeof b.nome === 'string' && NOME_VALIDO.test(b.nome) ? b.nome : b.id.toUpperCase();
    if (nomes.has(nome.toLowerCase())) nome = b.id.toUpperCase();
    if (nomes.has(nome.toLowerCase())) continue;
    const d = {
      id: b.id, tipo: b.tipo, nome, x: limitar(b.x, 40, LARGURA - 40), y: limitar(b.y, 40, ALTURA - 40),
      interfaces: def.portas.filter(p => p.ip).map(p => {
        const orig = Array.isArray(b.interfaces) ? b.interfaces.find(i => i && i.id === p.id) : null;
        const ipN = lerIPv4(orig?.ip), mN = lerMascara(orig?.mascara);
        return ipN !== null && mN !== null && !validarEnderecoDeHost(ipN, mN)
          ? { id: p.id, ip: formatarIPv4(ipN), mascara: formatarIPv4(mN) } : { id: p.id, ip: '', mascara: '' };
      })
    };
    if (b.tipo === 'pc') { const g = lerIPv4(b.gateway); d.gateway = g === null ? '' : formatarIPv4(g); }
    if (b.tipo === 'roteador') {
      d.rotas = [];
      for (const r of Array.isArray(b.rotas) ? b.rotas : []) {
        if (d.rotas.length >= MAX_ROTAS || !r || typeof r !== 'object') continue;
        const rN = lerIPv4(r.rede), mN = lerMascara(r.mascara), vN = lerIPv4(r.via);
        if (rN === null || mN === null || vN === null || enderecoDeRede(rN, mN) !== rN) continue;
        const rede = formatarIPv4(rN), mascara = formatarIPv4(mN);
        if (d.rotas.some(x => x.rede === rede && x.mascara === mascara)) continue;
        d.rotas.push({ rede, mascara, via: formatarIPv4(vN) });
      }
    }
    if (b.tipo === 'switch') {
      d.portas = {};
      if (b.portas && typeof b.portas === 'object' && !Array.isArray(b.portas)) {
        for (const p of TIPOS.switch.portas) {
          const c = b.portas[p.id];
          if (!c || typeof c !== 'object') continue;
          if (c.modo === 'trunk') d.portas[p.id] = { modo: 'trunk', vlan: 1 };
          else if (c.modo === 'access' && Number.isInteger(c.vlan) && c.vlan >= VLAN_MIN && c.vlan <= VLAN_MAX && c.vlan !== 1) d.portas[p.id] = { modo: 'access', vlan: c.vlan };
        }
      }
    }
    ids.add(d.id); nomes.add(nome.toLowerCase());
    saida.dispositivos.push(d);
  }
  const usadas = new Set(), caboIds = new Set();
  for (const c of Array.isArray(bruto.cabos) ? bruto.cabos : []) {
    if (!c || typeof c.id !== 'string' || caboIds.has(c.id) || !/^c\d{1,3}$/.test(c.id)) continue;
    const da = dispositivo(saida, c.a?.d), db = dispositivo(saida, c.b?.d);
    if (!da || !db || da.id === db.id) continue;
    const okPorta = (d, p) => TIPOS[d.tipo].portas.some(x => x.id === p);
    if (!okPorta(da, c.a.p) || !okPorta(db, c.b.p)) continue;
    const ka = `${da.id}:${c.a.p}`, kb = `${db.id}:${c.b.p}`;
    if (usadas.has(ka) || usadas.has(kb)) continue;
    usadas.add(ka); usadas.add(kb); caboIds.add(c.id);
    saida.cabos.push({ id: c.id, a: { d: da.id, p: c.a.p }, b: { d: db.id, p: c.b.p } });
  }
  return saida;
}
