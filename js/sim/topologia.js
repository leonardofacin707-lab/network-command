// Modelo da topologia do laboratório: dispositivos, interfaces e cabos. Funções puras e imutáveis, sem DOM.
// Cada operação devolve { topologia, ... } ou { erro } com uma mensagem em português.
import { lerIPv6, formatarIPv6, lerPrefixo6, rede6, mesmaRede6, ehLinkLocal, ehMulticast } from './ipv6.js';
import { lerIPv4, lerMascara, validarEnderecoDeHost, formatarIPv4, enderecoDeRede, mesmaRede } from './ipv4.js';

export const LARGURA = 900;
export const ALTURA = 520;
export const MAX_DISPOSITIVOS = 16;
export const TIPOS = {
  pc: { rotulo: 'Computador', prefixo: 'PC', idPrefixo: 'pc', portas: [{ id: 'eth0', rotulo: 'Ethernet0', ip: true }] },
  switch: { rotulo: 'Switch', prefixo: 'SW', idPrefixo: 'sw', portas: Array.from({ length: 8 }, (_, i) => ({ id: `fa${i + 1}`, rotulo: `Fa0/${i + 1}`, ip: false })) },
  roteador: { rotulo: 'Roteador', prefixo: 'R', idPrefixo: 'r', portas: [{ id: 'gi0', rotulo: 'Gi0/0', ip: true }, { id: 'gi1', rotulo: 'Gi0/1', ip: true }] },
  ap: { rotulo: 'Ponto de acesso', prefixo: 'AP', idPrefixo: 'ap', portas: [{ id: 'eth0', rotulo: 'Ethernet0', ip: false }] }
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
  if (tipo === 'roteador') { d.rotas = []; d.pools = []; d.filtros = []; d.nat = null; } // nat: { dentro, fora } (portas) // filtros: [{ acao, origem, origemM, destino, destinoM }]; rotas estáticas: [{ rede, mascara, via }]; pools DHCP: [{ porta, inicio, fim }]
  if (tipo === 'switch') d.portas = {}; // configuração das portas, só o que foge do padrão (access, VLAN 1)
  if (tipo === 'ap') d.wifi = { ssid: `Rede-${d.nome}`, seguranca: 'wpa2', senha: 'senha-de-laboratorio', banda: '2.4', oculto: false };
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
  if (!ipTxt && !mTxt) return { topologia: trocar(t, id, x => ({ ...x, interfaces: x.interfaces.map(i => (i.id === portaId ? { ...i, ip: '', mascara: '' } : i)) })) };
  const ipN = lerIPv4(ipTxt), mN = lerMascara(mTxt);
  if (!ipTxt) return { erro: 'Informe o endereço IP (ou limpe também a máscara).' };
  if (!mTxt) return { erro: 'Informe a máscara de sub-rede (ou limpe também o IP).' };
  const erro = validarEnderecoDeHost(ipN, mN);
  if (erro) return { erro };
  return { topologia: trocar(t, id, x => ({ ...x, interfaces: x.interfaces.map(i => (i.id === portaId ? { ...i, ip: formatarIPv4(ipN), mascara: formatarIPv4(mN) } : i)) })) };
}

// ---------- IPv6 ----------
/** Lê endereço e prefixo IPv6 de uma interface. Os dois vazios = sem IPv6. Devolve { ip, prefixo } ou { erro }. */
function lerEndereco6(ip6, prefixo6) {
  const a = String(ip6 ?? '').trim(), p = String(prefixo6 ?? '').trim();
  if (!a && !p) return { ip: null };
  // aceita "2001:db8::1/64" num campo só
  const [ipTxt, preTxt] = a.includes('/') ? a.split('/') : [a, p];
  if (!ipTxt) return { erro: 'Informe o endereço IPv6 (ou limpe também o prefixo).' };
  const ip = lerIPv6(ipTxt);
  if (ip === null) return { erro: 'Endereço IPv6 inválido. Use 8 grupos hexadecimais separados por ":" (pode abreviar com ::), ex.: 2001:db8:1::10.' };
  const prefixo = lerPrefixo6(preTxt || '');
  if (prefixo === null || prefixo < 1 || prefixo > 128) return { erro: 'Prefixo IPv6 inválido. Use um número de 1 a 128 (nas LANs, quase sempre /64).' };
  if (ehLinkLocal(ip)) return { erro: 'Endereços link-local (fe80::) são criados sozinhos nesta simulação. Configure um endereço global, ex.: 2001:db8:1::10.' };
  if (ehMulticast(ip)) return { erro: 'Endereço multicast (ff00::/8) não pode ser de uma interface.' };
  if (ip <= 1n) return { erro: ':: e ::1 são reservados (não especificado e loopback).' };
  if (prefixo < 128 && rede6(ip, prefixo) === ip) return { erro: `Esse é o próprio prefixo da rede (identificador de interface zerado). Use um endereço dentro dele, ex.: ${formatarIPv6(ip + 1n)}.` };
  return { ip, prefixo };
}

/** Configura (ou limpa) o endereço IPv6 global de uma interface. Aceita "2001:db8::1" + "64" ou "2001:db8::1/64". */
export function configurarInterface6(t, id, portaId, { ip6, prefixo6 }) {
  const d = dispositivo(t, id);
  const interf = d?.interfaces.find(i => i.id === portaId);
  if (!interf) return { erro: 'Interface não encontrada.' };
  const v = lerEndereco6(ip6, prefixo6);
  if (v.erro) return v;
  return { topologia: trocar(t, id, x => ({ ...x, interfaces: x.interfaces.map(i => {
    if (i.id !== portaId) return i;
    const { ip6: _a, prefixo6: _b, ...resto } = i;
    return v.ip === null ? resto : { ...resto, ip6: formatarIPv6(v.ip), prefixo6: v.prefixo };
  }) })) };
}

export function configurarGateway6(t, id, gateway6) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores têm gateway padrão.' };
  const txt = String(gateway6 ?? '').trim();
  if (!txt) return { topologia: trocar(t, id, x => { const { gateway6: _, ...r } = x; return r; }) };
  const n = lerIPv6(txt);
  if (n === null || ehMulticast(n) || n <= 1n) return { erro: 'Gateway IPv6 inválido. Use o endereço do roteador (global ou link-local fe80::).' };
  return { topologia: trocar(t, id, x => ({ ...x, gateway6: formatarIPv6(n) })) };
}

/** DHCPv6 com estado: o computador pede o endereço IPv6 a um servidor (pool numa interface de roteador). */
export function configurarDhcp6Pc(t, id, ativo) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores são clientes DHCPv6.' };
  return { topologia: trocar(t, id, x => { const { dhcp6, slaac, ...r } = x; return ativo ? { ...r, dhcp6: true } : (slaac ? { ...r, slaac } : r); }) };
}

/** Pool DHCPv6 numa interface de roteador com IPv6: primeiro e último endereço, dentro do prefixo da interface. */
export function configurarPoolDhcp6(t, id, portaId, { inicio, fim }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores têm servidor DHCPv6 nesta simulação.' };
  const i = d.interfaces.find(x => x.id === portaId);
  if (!i) return { erro: 'Interface não encontrada.' };
  const a = String(inicio ?? '').trim(), b = String(fim ?? '').trim();
  const sem = x => ({ ...x, pools6: (x.pools6 ?? []).filter(q => q.porta !== portaId) });
  if (!a && !b) return { topologia: trocar(t, id, x => { const y = sem(x); if (!y.pools6.length) delete y.pools6; return y; }) };
  if (!i.ip6) return { erro: 'Configure antes o endereço IPv6 desta interface.' };
  const ini = lerIPv6(a), f = lerIPv6(b), base = lerIPv6(i.ip6);
  if (ini === null || f === null) return { erro: 'Pool DHCPv6: informe o primeiro e o último endereço IPv6 (ex.: 2001:db8:1::100 e 2001:db8:1::1ff).' };
  if (ini > f) return { erro: 'Pool DHCPv6: o primeiro endereço precisa vir antes do último.' };
  if (!mesmaRede6(ini, base, i.prefixo6) || !mesmaRede6(f, base, i.prefixo6)) return { erro: 'Pool DHCPv6: os endereços precisam estar no prefixo da interface.' };
  if (f - ini > 4095n) return { erro: 'Pool DHCPv6: no máximo 4096 endereços nesta simulação.' };
  return { topologia: trocar(t, id, x => ({ ...sem(x), pools6: [...sem(x).pools6, { porta: portaId, inicio: formatarIPv6(ini), fim: formatarIPv6(f) }] })) };
}

/** SLAAC: o computador monta o próprio endereço IPv6 com o prefixo anunciado pelo roteador (Router Advertisement). */
export function configurarSlaac(t, id, ativo) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores usam SLAAC nesta simulação.' };
  return { topologia: trocar(t, id, x => { const { slaac, ...r } = x; if (ativo) delete r.dhcp6; return ativo ? { ...r, slaac: true } : r; }) };
}

/** ipv6 unicast-routing: sem ele o roteador não encaminha IPv6 nem anuncia prefixos (como no Cisco IOS). */
export function configurarRoteamento6(t, id, ativo) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores roteiam IPv6.' };
  return { topologia: trocar(t, id, x => { const { ipv6Roteamento, ...r } = x; return ativo ? { ...r, ipv6Roteamento: true } : r; }) };
}

function lerRota6({ rede, prefixo, via }) {
  const r = lerIPv6(String(rede ?? '').split('/')[0]), p = lerPrefixo6(String(rede ?? '').includes('/') ? String(rede).split('/')[1] : prefixo), v = lerIPv6(via);
  if (r === null) return { erro: 'Rede IPv6 de destino inválida (ex.: 2001:db8:2:: ou ::/0 para a rota padrão).' };
  if (p === null) return { erro: 'Prefixo inválido (0 a 128; /0 = rota padrão).' };
  if (v === null || ehMulticast(v) || v <= 1n) return { erro: 'Próximo salto IPv6 inválido.' };
  if (rede6(r, p) !== r) return { erro: `Com /${p} a rede seria ${formatarIPv6(rede6(r, p))}.` };
  return { rota: { rede: formatarIPv6(r), prefixo: p, via: formatarIPv6(v) } };
}

/** Rota estática IPv6 (ipv6 route rede/prefixo próximo-salto). O próximo salto deve ser um endereço global de uma rede ligada. */
export function adicionarRota6(t, id, campos) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores têm rotas IPv6.' };
  const v = lerRota6(campos); if (v.erro) return v;
  if ((d.rotas6 ?? []).length >= MAX_ROTAS) return { erro: `Limite de ${MAX_ROTAS} rotas IPv6.` };
  if ((d.rotas6 ?? []).some(x => x.rede === v.rota.rede && x.prefixo === v.rota.prefixo)) return { erro: 'Já existe uma rota IPv6 para essa rede.' };
  const via = lerIPv6(v.rota.via);
  if (!d.interfaces.some(i => i.ip6 && mesmaRede6(lerIPv6(i.ip6), via, i.prefixo6))) {
    return { erro: 'O próximo salto IPv6 precisa estar numa rede ligada a este roteador (configure antes o IPv6 da interface).' };
  }
  return { topologia: trocar(t, id, x => ({ ...x, rotas6: [...(x.rotas6 ?? []), v.rota] })) };
}

export function removerRota6(t, id, indice) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador' || !Number.isInteger(indice) || indice < 0 || indice >= (d.rotas6 ?? []).length) return { erro: 'Rota IPv6 não encontrada.' };
  return { topologia: trocar(t, id, x => { const r = x.rotas6.filter((_, i) => i !== indice); const { rotas6: _, ...resto } = x; return r.length ? { ...resto, rotas6: r } : resto; }) };
}

// ---------- OSPF ----------
export const MAX_NETWORKS_OSPF = 8;

function lerNetworkOspf({ rede, wildcard, area }) {
  const r = lerIPv4(rede), w = lerIPv4(wildcard), a = Number(String(area ?? '').trim());
  if (r === null) return { erro: 'OSPF: rede inválida (ex.: 192.168.1.0).' };
  if (w === null) return { erro: 'OSPF: wildcard inválida. Ela é o inverso da máscara: para /24 use 0.0.0.255.' };
  if (!Number.isInteger(a) || a < 0 || a > 4294967295 || String(area ?? '').trim() === '') return { erro: 'OSPF: área inválida (use um número, normalmente 0).' };
  return { network: { rede: formatarIPv4(r), wildcard: formatarIPv4(w), area: a } };
}

/** Acrescenta um comando "network REDE WILDCARD area N" ao OSPF do roteador (liga o OSPF se ainda não estava). */
export function adicionarNetworkOspf(t, id, campos) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores rodam OSPF.' };
  const v = lerNetworkOspf(campos); if (v.erro) return v;
  const redes = d.ospf?.redes ?? [];
  if (redes.length >= MAX_NETWORKS_OSPF) return { erro: `Limite de ${MAX_NETWORKS_OSPF} comandos network.` };
  if (redes.some(n => n.rede === v.network.rede && n.wildcard === v.network.wildcard)) return { erro: 'Esse comando network já existe (para trocar a área, remova e crie de novo).' };
  return { topologia: trocar(t, id, x => ({ ...x, ospf: { redes: [...redes, v.network] } })) };
}

export function removerNetworkOspf(t, id, indice) {
  const d = dispositivo(t, id);
  const redes = d?.ospf?.redes ?? [];
  if (!d || d.tipo !== 'roteador' || !Number.isInteger(indice) || indice < 0 || indice >= redes.length) return { erro: 'Comando network não encontrado.' };
  const resto = redes.filter((_, i) => i !== indice);
  return { topologia: trocar(t, id, x => { const { ospf: _, ...r } = x; return resto.length ? { ...r, ospf: { redes: resto } } : r; }) };
}

/** Desliga o OSPF (no router ospf). */
export function removerOspf(t, id) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores rodam OSPF.' };
  return { topologia: trocar(t, id, x => { const { ospf: _, ...r } = x; return r; }) };
}

// ---------- Wi-Fi ----------
export const SEGURANCAS_WIFI = { aberta: 'Aberta (sem senha)', wpa2: 'WPA2-Personal', wpa3: 'WPA3-Personal' };
export const BANDAS_WIFI = { '2.4': '2,4 GHz', 5: '5 GHz', ambas: '2,4 e 5 GHz' };
const SSID_VALIDO = /^[\x20-\x7E]{1,32}$/;

function lerWifiAp({ ssid, seguranca, senha, banda, oculto }) {
  const s = String(ssid ?? '').trim();
  if (!SSID_VALIDO.test(s)) return { erro: 'SSID inválido: use de 1 a 32 caracteres (letras sem acento, números e símbolos comuns).' };
  if (!SEGURANCAS_WIFI[seguranca]) return { erro: 'Escolha a segurança: aberta, WPA2 ou WPA3.' };
  const b = String(banda ?? '2.4');
  if (!BANDAS_WIFI[b]) return { erro: 'Escolha a banda: 2,4 GHz, 5 GHz ou as duas.' };
  const pw = String(senha ?? '');
  if (seguranca !== 'aberta' && (pw.length < 8 || pw.length > 63 || !/^[\x20-\x7E]+$/.test(pw))) return { erro: 'No WPA2 e no WPA3 a senha precisa ter de 8 a 63 caracteres (sem acentos).' };
  return { wifi: { ssid: s, seguranca, senha: seguranca === 'aberta' ? '' : pw, banda: b, oculto: oculto === true } };
}

function lerWifiPc({ ssid, senha, so24 }) {
  const s = String(ssid ?? '').trim();
  if (!s) return { wifi: null };
  if (!SSID_VALIDO.test(s)) return { erro: 'SSID inválido: use de 1 a 32 caracteres.' };
  const pw = String(senha ?? '');
  if (pw.length > 63) return { erro: 'A senha do Wi-Fi tem no máximo 63 caracteres.' };
  return { wifi: { ssid: s, senha: pw, ...(so24 === true ? { so24: true } : {}) } };
}

/** Configura a rede sem fio de um ponto de acesso. As senhas aqui são de laboratório: não use senhas reais. */
export function configurarWifiAp(t, id, campos) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'ap') return { erro: 'Só pontos de acesso transmitem uma rede Wi-Fi.' };
  const w = lerWifiAp(campos); if (w.erro) return w;
  return { topologia: trocar(t, id, x => ({ ...x, wifi: w.wifi })) };
}

/** Liga o computador a uma rede Wi-Fi (SSID vazio = sem Wi-Fi). Com cabo na Ethernet0, o cabo tem prioridade. */
export function configurarWifiPc(t, id, campos) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores se conectam ao Wi-Fi nesta simulação.' };
  const w = lerWifiPc(campos); if (w.erro) return w;
  return { topologia: trocar(t, id, x => { const { wifi: _, ...r } = x; return w.wifi ? { ...r, wifi: w.wifi } : r; }) };
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

/** Máximo de registros A (nome → IP) no serviço DNS de um computador. */
export const MAX_REGISTROS_DNS = 12;
const NOME_DNS = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?){0,3}$/;

export const MAX_SERVICOS = 8;

/** Portas TCP em que o computador oferece um serviço (ex.: 22 SSH, 80 HTTP). Lista vazia = nenhum serviço. */
export function configurarServicos(t, id, portas) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores oferecem serviços nesta simulação.' };
  const lista = [...new Set((portas ?? []).map(Number))];
  if (lista.some(p => !Number.isInteger(p) || p < 1 || p > 65535)) return { erro: 'Porta inválida. Use números de 1 a 65535.' };
  if (lista.length > MAX_SERVICOS) return { erro: `Limite de ${MAX_SERVICOS} serviços por computador.` };
  lista.sort((a, b) => a - b);
  return { topologia: trocar(t, id, x => { const { servicos: _, ...resto } = x; return lista.length ? { ...resto, servicos: lista } : resto; }) };
}

/** Define (ou limpa, se vazio) o servidor DNS configurado num computador cliente. */
export function configurarDnsPc(t, id, dns) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores têm servidor DNS configurado.' };
  const txt = String(dns ?? '').trim();
  if (!txt) return { topologia: trocar(t, id, x => { const { dns: _, ...resto } = x; return resto; }) };
  const n = lerIPv4(txt);
  if (n === null) return { erro: 'Servidor DNS inválido. Use quatro números de 0 a 255 separados por ponto.' };
  return { topologia: trocar(t, id, x => ({ ...x, dns: formatarIPv4(n) })) };
}

/** Acrescenta um registro A (nome → IP) ao serviço DNS de um computador, que passa a funcionar como servidor DNS. */
/** Registro A (IPv4) ou AAAA (IPv6): um mesmo nome pode ter um de cada. */
const familiaDe = ip => (String(ip).includes(':') ? 'AAAA' : 'A');
export function adicionarRegistroDns(t, id, { nome, ip }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores podem ser servidores DNS nesta simulação.' };
  const nomeL = String(nome ?? '').trim().toLowerCase();
  if (!NOME_DNS.test(nomeL)) return { erro: 'Nome inválido. Use letras, números e hífen, separados por pontos (ex.: www.loja.local).' };
  const txt = String(ip ?? '').trim();
  const v6 = txt.includes(':') ? lerIPv6(txt) : null, ipN = txt.includes(':') ? null : lerIPv4(txt);
  if (ipN === null && (v6 === null || ehMulticast(v6) || v6 <= 1n)) return { erro: 'Endereço do registro inválido. Use um IPv4 (registro A, ex.: 192.168.1.60) ou um IPv6 (registro AAAA, ex.: 2001:db8:1::60).' };
  const end = ipN !== null ? formatarIPv4(ipN) : formatarIPv6(v6);
  const regs = d.registros ?? [];
  if (regs.some(r => r.nome === nomeL && familiaDe(r.ip) === familiaDe(end))) return { erro: `Já existe um registro ${familiaDe(end)} com esse nome. Remova o antigo para trocar o endereço.` };
  if (regs.length >= MAX_REGISTROS_DNS) return { erro: `Limite de ${MAX_REGISTROS_DNS} registros por servidor.` };
  return { topologia: trocar(t, id, x => ({ ...x, registros: [...regs, { nome: nomeL, ip: end }] })) };
}

export function removerRegistroDns(t, id, indice) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc' || !Number.isInteger(indice) || indice < 0 || indice >= (d.registros ?? []).length) return { erro: 'Registro não encontrado.' };
  return { topologia: trocar(t, id, x => {
    const regs = x.registros.filter((_, i) => i !== indice), { registros: _, ...resto } = x;
    return regs.length ? { ...resto, registros: regs } : resto;
  }) };
}

/** Máximo de regras de filtro por roteador. */
export const MAX_FILTROS = 12;

/**
 * NAT (simplificado, tipo PAT/overload): pacotes que entram pela porta "dentro" e saem pela porta "fora" passam a ter como
 * origem o IP da porta "fora"; a resposta volta para esse IP e o roteador a devolve ao computador de dentro. Quem entra pela
 * porta "fora" rumo à rede de "dentro" é bloqueado (não há redirecionamento de portas nesta simulação).
 */
export function configurarNat(t, id, { dentro, fora }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores fazem NAT nesta simulação.' };
  if (!d.interfaces.some(i => i.id === dentro) || !d.interfaces.some(i => i.id === fora)) return { erro: 'Escolha duas interfaces deste roteador.' };
  if (dentro === fora) return { erro: 'As interfaces de dentro e de fora precisam ser diferentes.' };
  return { topologia: trocar(t, id, x => ({ ...x, nat: { dentro, fora } })) };
}

export function removerNat(t, id) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores fazem NAT nesta simulação.' };
  return { topologia: trocar(t, id, x => ({ ...x, nat: null })) };
}

export const PROTOCOLOS_FILTRO = ['ip', 'icmp', 'tcp', 'udp'];

/** Protocolo e porta de destino de uma regra: "ip" vale para tudo; porta só com tcp ou udp. Devolve { campos } ou { erro }. */
function lerProtocoloPorta(protocolo, porta) {
  if (!PROTOCOLOS_FILTRO.includes(protocolo)) return { erro: 'Protocolo inválido. Use ip (qualquer), icmp, tcp ou udp.' };
  const txt = String(porta ?? '').trim();
  if (!txt) return { campos: protocolo === 'ip' ? {} : { protocolo } };
  if (protocolo !== 'tcp' && protocolo !== 'udp') return { erro: 'Porta só existe em regras tcp ou udp.' };
  const n = Number(txt);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return { erro: 'Porta inválida. Use um número de 1 a 65535.' };
  return { campos: { protocolo, porta: n } };
}

function lerAlvoDeFiltro(rede, mascara, rotulo) {
  const rTxt = String(rede ?? '').trim(), mTxt = String(mascara ?? '').trim();
  if (!rTxt && !mTxt) return { ip: 0, m: 0 }; // vazio = qualquer
  if (!rTxt || !mTxt) return { erro: `${rotulo}: preencha a rede e a máscara (ou deixe os dois vazios para "qualquer").` };
  const ip = lerIPv4(rTxt), m = lerMascara(mTxt);
  if (ip === null) return { erro: `${rotulo}: endereço inválido. Use quatro números de 0 a 255 separados por ponto.` };
  if (m === null) return { erro: `${rotulo}: máscara inválida. Use, por exemplo, 255.255.255.0 ou /24.` };
  if (enderecoDeRede(ip, m) !== ip) return { erro: `${rotulo}: com essa máscara o endereço de rede seria ${formatarIPv4(enderecoDeRede(ip, m))}.` };
  return { ip, m };
}

/**
 * Acrescenta uma regra ao filtro de pacotes do roteador (simplificação de uma ACL): as regras são lidas em ordem e vale a
 * primeira que casa com origem e destino do pacote; sem correspondência o pacote é permitido (numa ACL Cisco seria negado).
 */
export function adicionarFiltro(t, id, { acao, origem, origemM, destino, destinoM, protocolo = 'ip', porta = '' }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores têm filtro de pacotes nesta simulação.' };
  if (acao !== 'negar' && acao !== 'permitir') return { erro: 'Escolha a ação da regra: permitir ou negar.' };
  if ((d.filtros ?? []).length >= MAX_FILTROS) return { erro: `Limite de ${MAX_FILTROS} regras por roteador.` };
  const o = lerAlvoDeFiltro(origem, origemM, 'Origem'); if (o.erro) return o;
  const dest = lerAlvoDeFiltro(destino, destinoM, 'Destino'); if (dest.erro) return dest;
  const l4 = lerProtocoloPorta(protocolo || 'ip', porta); if (l4.erro) return l4;
  const regra = { acao, origem: formatarIPv4(o.ip), origemM: formatarIPv4(o.m), destino: formatarIPv4(dest.ip), destinoM: formatarIPv4(dest.m), ...l4.campos };
  if (d.filtros.some(f => Object.keys(regra).every(k => f[k] === regra[k]))) return { erro: 'Essa regra já existe.' };
  return { topologia: trocar(t, id, x => ({ ...x, filtros: [...x.filtros, regra] })) };
}

export function removerFiltro(t, id, indice) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador' || !Number.isInteger(indice) || indice < 0 || indice >= (d.filtros ?? []).length) return { erro: 'Regra não encontrada.' };
  return { topologia: trocar(t, id, x => ({ ...x, filtros: x.filtros.filter((_, i) => i !== indice) })) };
}

/** Sobe (delta -1) ou desce (+1) uma regra: a ordem decide qual regra vale primeiro. */
export function moverFiltro(t, id, indice, delta) {
  const d = dispositivo(t, id);
  const alvo = indice + delta;
  if (!d || d.tipo !== 'roteador' || !Number.isInteger(indice) || (delta !== -1 && delta !== 1) || indice < 0 || alvo < 0 || alvo >= (d.filtros ?? []).length) return { erro: 'Não dá para mover a regra nessa direção.' };
  return { topologia: trocar(t, id, x => { const f = [...x.filtros]; [f[indice], f[alvo]] = [f[alvo], f[indice]]; return { ...x, filtros: f }; }) };
}

/** Máximo de endereços num pool DHCP do laboratório. */
export const MAX_POOL = 254;

/**
 * Define (ou remove, com início e fim vazios) o pool DHCP de uma interface de roteador. A máscara e o gateway entregues aos
 * clientes vêm da própria interface; o pool precisa estar dentro da sub-rede dela, fora do endereço de rede e de broadcast.
 */
export function configurarPoolDhcp(t, id, portaId, { inicio, fim }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores têm servidor DHCP nesta simulação.' };
  const interf = d.interfaces.find(i => i.id === portaId);
  if (!interf) return { erro: 'Interface não encontrada.' };
  const iTxt = String(inicio ?? '').trim(), fTxt = String(fim ?? '').trim();
  const semPool = x => ({ ...x, pools: (x.pools ?? []).filter(q => q.porta !== portaId) });
  if (!iTxt && !fTxt) return { topologia: trocar(t, id, semPool) };
  if (!iTxt || !fTxt) return { erro: 'Informe o primeiro e o último endereço do pool (ou limpe os dois).' };
  const ip = lerIPv4(interf.ip), m = lerMascara(interf.mascara);
  if (ip === null || m === null) return { erro: 'Configure primeiro o IP e a máscara da interface que vai atender o DHCP.' };
  const iN = lerIPv4(iTxt), fN = lerIPv4(fTxt);
  if (iN === null || fN === null) return { erro: 'Endereço do pool inválido. Use quatro números de 0 a 255 separados por ponto.' };
  for (const n of [iN, fN]) {
    if (!mesmaRede(n, ip, m)) return { erro: `${formatarIPv4(n)} não está na sub-rede da interface (${formatarIPv4(enderecoDeRede(ip, m))}).` };
    const erro = validarEnderecoDeHost(n, m);
    if (erro) return { erro };
  }
  if (iN > fN) return { erro: 'O primeiro endereço do pool não pode ser maior que o último.' };
  if (fN - iN + 1 > MAX_POOL) return { erro: `O pool pode ter no máximo ${MAX_POOL} endereços.` };
  const novo = { porta: portaId, inicio: formatarIPv4(iN), fim: formatarIPv4(fN) };
  return { topologia: trocar(t, id, x => ({ ...semPool(x), pools: [...semPool(x).pools, novo] })) };
}

/** Liga ou desliga "obter endereço automaticamente (DHCP)" num computador. Os campos manuais ficam guardados. */
export function configurarDhcpPc(t, id, ativo) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores podem ser clientes DHCP.' };
  return { topologia: trocar(t, id, x => { const { dhcp, ...resto } = x; return ativo ? { ...resto, dhcp: true } : resto; }) };
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
        const v4 = ipN !== null && mN !== null && !validarEnderecoDeHost(ipN, mN)
          ? { id: p.id, ip: formatarIPv4(ipN), mascara: formatarIPv4(mN) } : { id: p.id, ip: '', mascara: '' };
        const v6 = lerEndereco6(orig?.ip6, orig?.prefixo6);
        return v6.erro || !v6.ip ? v4 : { ...v4, ip6: formatarIPv6(v6.ip), prefixo6: v6.prefixo };
      })
    };
    if (b.tipo === 'pc') { const g = lerIPv4(b.gateway); d.gateway = g === null ? '' : formatarIPv4(g); }
    if (b.tipo === 'pc' && b.dhcp === true) d.dhcp = true;
    if (b.tipo === 'pc' && b.slaac === true) d.slaac = true;
    else if (b.tipo === 'pc' && b.dhcp6 === true) d.dhcp6 = true;
    if (b.tipo === 'pc') { const g6 = lerIPv6(b.gateway6); if (g6 !== null && !ehMulticast(g6) && g6 > 1n) d.gateway6 = formatarIPv6(g6); }
    if (b.tipo === 'roteador') {
      if (b.ipv6Roteamento === true) d.ipv6Roteamento = true;
      const rotas6 = [];
      for (const r of Array.isArray(b.rotas6) ? b.rotas6 : []) {
        const v = r && typeof r === 'object' ? lerRota6(r) : { erro: 'x' };
        if (!v.erro && rotas6.length < MAX_ROTAS && !rotas6.some(x => x.rede === v.rota.rede && x.prefixo === v.rota.prefixo)) rotas6.push(v.rota);
      }
      if (rotas6.length) d.rotas6 = rotas6;
      const nets = [];
      for (const n of Array.isArray(b.ospf?.redes) ? b.ospf.redes : []) {
        const v = n && typeof n === 'object' ? lerNetworkOspf(n) : { erro: 'x' };
        if (!v.erro && nets.length < MAX_NETWORKS_OSPF && !nets.some(x => x.rede === v.network.rede && x.wildcard === v.network.wildcard)) nets.push(v.network);
      }
      if (nets.length) d.ospf = { redes: nets };
      const p6 = [];
      for (const q of Array.isArray(b.pools6) ? b.pools6 : []) {
        const i = d.interfaces.find(x => x.id === q?.porta);
        const ini = lerIPv6(q?.inicio), f = lerIPv6(q?.fim), base = i?.ip6 ? lerIPv6(i.ip6) : null;
        if (!i || base === null || ini === null || f === null || ini > f || f - ini > 4095n || !mesmaRede6(ini, base, i.prefixo6) || !mesmaRede6(f, base, i.prefixo6) || p6.some(x => x.porta === q.porta)) continue;
        p6.push({ porta: q.porta, inicio: formatarIPv6(ini), fim: formatarIPv6(f) });
      }
      if (p6.length) d.pools6 = p6;
    }
    if (b.tipo === 'pc') {
      const dnsN = lerIPv4(b.dns);
      if (dnsN !== null) d.dns = formatarIPv4(dnsN);
      const regs = [];
      for (const r of Array.isArray(b.registros) ? b.registros : []) {
        if (regs.length >= MAX_REGISTROS_DNS || !r || typeof r !== 'object' || typeof r.nome !== 'string') continue;
        const nomeR = r.nome.trim().toLowerCase(), txt = String(r.ip ?? '');
        const ipN = txt.includes(':') ? null : lerIPv4(txt), v6 = txt.includes(':') ? lerIPv6(txt) : null;
        const end = ipN !== null ? formatarIPv4(ipN) : v6 !== null && !ehMulticast(v6) && v6 > 1n ? formatarIPv6(v6) : null;
        if (!NOME_DNS.test(nomeR) || end === null || regs.some(x => x.nome === nomeR && familiaDe(x.ip) === familiaDe(end))) continue;
        regs.push({ nome: nomeR, ip: end });
      }
      if (regs.length) d.registros = regs;
      const servs = [...new Set((Array.isArray(b.servicos) ? b.servicos : []).filter(p => Number.isInteger(p) && p >= 1 && p <= 65535))].slice(0, MAX_SERVICOS).sort((a, c) => a - c);
      if (servs.length) d.servicos = servs;
    }
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
      d.filtros = [];
      for (const f of Array.isArray(b.filtros) ? b.filtros : []) {
        if (d.filtros.length >= MAX_FILTROS || !f || typeof f !== 'object' || (f.acao !== 'negar' && f.acao !== 'permitir')) continue;
        const oN = lerIPv4(f.origem), omN = lerMascara(f.origemM), dN = lerIPv4(f.destino), dmN = lerMascara(f.destinoM);
        if (oN === null || omN === null || dN === null || dmN === null || enderecoDeRede(oN, omN) !== oN || enderecoDeRede(dN, dmN) !== dN) continue;
        const l4 = lerProtocoloPorta(f.protocolo ?? 'ip', f.porta ?? '');
        if (l4.erro) continue;
        d.filtros.push({ acao: f.acao, origem: formatarIPv4(oN), origemM: formatarIPv4(omN), destino: formatarIPv4(dN), destinoM: formatarIPv4(dmN), ...l4.campos });
      }
      d.nat = b.nat && typeof b.nat === 'object' && b.nat.dentro !== b.nat.fora && d.interfaces.some(i => i.id === b.nat.dentro) && d.interfaces.some(i => i.id === b.nat.fora) ? { dentro: b.nat.dentro, fora: b.nat.fora } : null;
      d.pools = [];
      for (const q of Array.isArray(b.pools) ? b.pools : []) {
        if (!q || typeof q !== 'object' || !d.interfaces.some(i => i.id === q.porta) || d.pools.some(x => x.porta === q.porta)) continue;
        const iN = lerIPv4(q.inicio), fN = lerIPv4(q.fim);
        if (iN === null || fN === null || iN > fN || fN - iN + 1 > MAX_POOL) continue;
        d.pools.push({ porta: q.porta, inicio: formatarIPv4(iN), fim: formatarIPv4(fN) });
      }
    }
    if (b.tipo === 'ap') { const w = lerWifiAp(b.wifi ?? {}); d.wifi = w.erro ? { ssid: `Rede-${nome}`, seguranca: 'wpa2', senha: 'senha-de-laboratorio', banda: '2.4', oculto: false } : w.wifi; }
    if (b.tipo === 'pc' && b.wifi && typeof b.wifi === 'object') { const w = lerWifiPc(b.wifi); if (!w.erro && w.wifi) d.wifi = w.wifi; }
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
