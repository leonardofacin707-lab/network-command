// Motor IPv6 (puro, sem DOM). Usa a mesma camada 2 do IPv4 (cabos, switches, VLANs) e acrescenta:
// - endereço link-local automático (fe80:: + EUI-64 do MAC) em todo computador e em toda interface de roteador com IPv6;
// - descoberta de vizinhos (NDP): Neighbor Solicitation para o multicast solicited-node e Neighbor Advertisement (no lugar do ARP);
// - SLAAC: o computador monta o endereço com o prefixo /64 anunciado pelo roteador (Router Advertisement) e usa o
//   link-local do roteador como gateway; só roteadores com "ipv6 unicast-routing" anunciam;
// - encaminhamento por rotas conectadas e estáticas (prefixo mais longo), hop limit e ida e volta.
// NÃO modela: DHCPv6, DNS AAAA, filtros e NAT para IPv6 (IPv6 dispensa NAT), privacidade de endereços (IDs aleatórios),
// mensagens ICMPv6 de erro além das usadas no ping/tracert, MTU e fragmentação.
import { lerIPv6, formatarIPv6, mesmaRede6, ehLinkLocal, linkLocalDe, slaacDe, solicitedNode, ehGlobal, ehUla } from './ipv6.js';
import { dispositivo } from './topologia.js';
import { macDe, dominioL2, temLink } from './motor.js';

export const HOP_LIMIT = { pc: 128, roteador: 64 };
const MAX_SALTOS = 16;

/** Endereços IPv6 de uma interface: [{ ip, prefixo, tipo: 'global'|'link-local' }]. */
export function enderecosDaInterface(d, porta) {
  const i = d.interfaces.find(x => x.id === porta);
  if (!i) return [];
  const g = i.ip6 ? lerIPv6(i.ip6) : null;
  const lista = [];
  if (g !== null) lista.push({ ip: g, prefixo: i.prefixo6, tipo: 'global' });
  if (d.tipo === 'pc' || g !== null) lista.push({ ip: linkLocalDe(macDe(d.id, porta)), prefixo: 64, tipo: 'link-local' });
  return lista;
}

const globais = d => d.interfaces.flatMap(i => enderecosDaInterface(d, i.id).filter(e => e.tipo === 'global').map(e => ({ ...e, p: i.id })));
export const primeiroGlobal6 = d => (d ? globais(d)[0]?.ip ?? null : null);
const dono = (d, ip) => d.interfaces.find(i => enderecosDaInterface(d, i.id).some(e => e.ip === ip)) ?? null;
const ehRoteavel = ip => ehGlobal(ip) || ehUla(ip);

/**
 * SLAAC: para cada computador com slaac ligado, procura no domínio de broadcast um roteador com "ipv6 unicast-routing" e
 * interface com prefixo /64. Devolve Map(pcId -> { ok, ip, prefixo, gateway, roteador } | { ok:false, motivo }).
 * motivos: 'sem-link' | 'sem-ra' (nenhum roteador anunciando) | 'prefixo-nao-64' (SLAAC só funciona com /64).
 */
export function anunciosSlaac(t) {
  const res = new Map();
  for (const pc of t.dispositivos) {
    if (pc.tipo !== 'pc' || !pc.slaac) continue;
    const dom = dominioL2(t, pc.id, 'eth0');
    if (dom === null) { res.set(pc.id, { ok: false, motivo: 'sem-link' }); continue; }
    let motivo = 'sem-ra';
    for (const e of dom) {
      const r = dispositivo(t, e.d);
      if (r.tipo !== 'roteador' || !r.ipv6Roteamento) continue;
      const g = enderecosDaInterface(r, e.p).find(x => x.tipo === 'global');
      if (!g) continue;
      if (g.prefixo !== 64) { motivo = 'prefixo-nao-64'; continue; }
      res.set(pc.id, { ok: true, ip: slaacDe(g.ip, macDe(pc.id, 'eth0')), prefixo: 64, gateway: linkLocalDe(macDe(r.id, e.p)), roteador: r.id });
      motivo = null;
      break;
    }
    if (motivo) res.set(pc.id, { ok: false, motivo });
  }
  return res;
}

/**
 * DHCPv6 com estado: o computador com dhcp6 recebe o primeiro endereço livre do pool de um roteador do seu domínio que
 * anuncia (ipv6 unicast-routing) e tem pool6 na interface; gateway = link-local do roteador (vem do Router Advertisement).
 * motivos: 'sem-link' | 'sem-ra' | 'sem-servidor6' | 'pool6-esgotado'.
 */
export function concessoesDhcp6(t) {
  const res = new Map(), usados = new Map();
  for (const pc of t.dispositivos) {
    if (pc.tipo !== 'pc' || !pc.dhcp6) continue;
    const dom = dominioL2(t, pc.id, 'eth0');
    if (dom === null) { res.set(pc.id, { ok: false, motivo: 'sem-link' }); continue; }
    const fixos = new Set(dom.flatMap(e => enderecosDaInterface(dispositivo(t, e.d), e.p).map(x => x.ip)));
    let motivo = 'sem-ra';
    for (const e of dom) {
      const r = dispositivo(t, e.d);
      if (r.tipo !== 'roteador' || !r.ipv6Roteamento) continue;
      const g = enderecosDaInterface(r, e.p).find(x => x.tipo === 'global');
      if (!g) continue;
      const pool = (r.pools6 ?? []).find(q => q.porta === e.p);
      if (!pool) { motivo = 'sem-servidor6'; continue; }
      const k = `${r.id}/${e.p}`;
      if (!usados.has(k)) usados.set(k, new Set());
      let livre = null;
      for (let n = lerIPv6(pool.inicio), f = lerIPv6(pool.fim); n <= f; n++) if (!fixos.has(n) && !usados.get(k).has(n)) { livre = n; break; }
      if (livre === null) { motivo = 'pool6-esgotado'; continue; }
      usados.get(k).add(livre);
      res.set(pc.id, { ok: true, ip: livre, prefixo: g.prefixo, gateway: linkLocalDe(macDe(r.id, e.p)), roteador: r.id, dhcp6: true });
      motivo = null;
      break;
    }
    if (motivo) res.set(pc.id, { ok: false, motivo });
  }
  return res;
}

/** Topologia vista com os endereços do SLAAC aplicados (o modelo salvo nunca é alterado). */
export function aplicarSlaac(t, anuncios) {
  if (!anuncios.size) return t;
  return { ...t, dispositivos: t.dispositivos.map(d => {
    const a = anuncios.get(d.id);
    if (!a) return d;
    const { gateway6: _, ...resto } = d;
    return { ...resto, ...(a.ok ? { gateway6: formatarIPv6(a.gateway) } : {}), interfaces: d.interfaces.map(i => {
      if (i.id !== 'eth0') return i;
      const { ip6: _a, prefixo6: _b, ...r } = i;
      return a.ok ? { ...r, ip6: formatarIPv6(a.ip), prefixo6: a.prefixo ?? 64 } : r;
    }) };
  }) };
}

/** NDP: quem, no domínio desta porta, tem o endereço? (como resolverArp). */
export function resolverVizinho(t, origemId, porta, ip) {
  const dom = dominioL2(t, origemId, porta);
  if (dom === null) return { link: false, achados: [] };
  const achados = dom.filter(e => enderecosDaInterface(dispositivo(t, e.d), e.p).some(x => x.ip === ip)).map(e => ({ ...e, mac: macDe(e.d, e.p) }));
  return { link: true, achados };
}

/** Rota IPv6 de um roteador: conectadas (com cabo) e estáticas; vence o prefixo mais longo, em empate a conectada. */
export function escolherRota6(t, r, dest) {
  let melhor = null;
  for (const i of r.interfaces) {
    const g = enderecosDaInterface(r, i.id).find(e => e.tipo === 'global');
    if (!g || !temLink(t, r.id, i.id) || !mesmaRede6(g.ip, dest, g.prefixo)) continue;
    if (!melhor || g.prefixo > melhor.prefixo) melhor = { porta: i.id, proximo: dest, ip: g.ip, prefixo: g.prefixo, tipo: 'conectada' };
  }
  for (const rota of r.rotas6 ?? []) {
    const rede = lerIPv6(rota.rede), via = lerIPv6(rota.via);
    if (rede === null || via === null || !mesmaRede6(rede, dest, rota.prefixo) || (melhor && rota.prefixo <= melhor.prefixo)) continue;
    const saida = r.interfaces.map(i => ({ p: i.id, g: enderecosDaInterface(r, i.id).find(e => e.tipo === 'global') }))
      .find(x => x.g && temLink(t, r.id, x.p) && mesmaRede6(x.g.ip, via, x.g.prefixo));
    if (saida) melhor = { porta: saida.p, proximo: via, ip: saida.g.ip, prefixo: rota.prefixo, tipo: 'estatica' };
  }
  return melhor;
}

const nomeDe = (t, d) => dispositivo(t, d)?.nome ?? d;

function capturarNdp(t, ctx, d, p, origem, procurado, viz) {
  if (!ctx?.registrar || !viz.link || ctx.conhece(d, procurado)) return;
  const mac = macDe(d, p);
  ctx.registrar({ protocolo: 'ICMPv6', de: nomeDe(t, d), para: `multicast ${formatarIPv6(solicitedNode(procurado))}`, macOrigem: mac, macDestino: solicitado(procurado),
    info: `Neighbor Solicitation: quem tem ${formatarIPv6(procurado)}? (de ${formatarIPv6(origem)})` });
  for (const a of viz.achados) ctx.registrar({ protocolo: 'ICMPv6', de: nomeDe(t, a.d), para: nomeDe(t, d), macOrigem: a.mac, macDestino: mac,
    info: `Neighbor Advertisement: ${formatarIPv6(procurado)} está em ${a.mac}` });
  if (viz.achados.length === 1) { ctx.aprender(d, procurado, viz.achados[0].mac); ctx.aprender(viz.achados[0].d, origem, mac); }
}

/** MAC multicast do solicited-node: 33-33 + últimos 32 bits do endereço multicast. */
function solicitado(ip) {
  const m = solicitedNode(ip) & 0xffffffffn;
  return ['33', '33', ...[24n, 16n, 8n, 0n].map(s => Number((m >> s) & 0xffn).toString(16).padStart(2, '0'))].join('-');
}

function capturarQuadro(t, ctx, de, para, ipO, ipD, hop, l4) {
  if (!ctx?.registrar) return;
  ctx.registrar({ protocolo: 'ICMPv6', info: l4.tipo === 'echo-reply' ? 'Echo (ping) resposta' : 'Echo (ping) pedido', de: nomeDe(t, de.d), para: nomeDe(t, para.d),
    trecho: { de: de.d, porta: de.p, para: para.d }, macOrigem: macDe(de.d, de.p), macDestino: para.mac, ipOrigem: formatarIPv6(ipO), ipDestino: formatarIPv6(ipD), ttl: hop });
}

/**
 * Leva um pacote IPv6 até dest. status: 'entregue' | 'sem-ip' | 'sem-link' | 'sem-rota' | 'gateway-fora' | 'arp-falhou'
 * (sem resposta à Neighbor Solicitation) | 'conflito-ip' (endereço duplicado) | 'sem-roteamento6' (roteador sem
 * ipv6 unicast-routing descarta) | 'rede-inalcancavel' | 'host-inalcancavel' | 'ttl-expirado' | 'descartado'.
 */
export function enviarPacote6(t, origemId, dest, l4 = { tipo: 'echo-request' }, ctx = null, origemForcada = null) {
  const o = dispositivo(t, origemId);
  const res = (status, extra = {}) => ({ status, saltos: [], caminho: [origemId], ...extra });
  const meu = dono(o, dest);
  if (meu) return res('entregue', { destino: { d: origemId, p: meu.id }, ttl: HOP_LIMIT[o.tipo], de: dest, origem: dest });

  let porta, proximo, origem;
  if (o.tipo === 'pc') {
    porta = 'eth0';
    const ends = enderecosDaInterface(o, porta);
    const g = ends.find(e => e.tipo === 'global'), ll = ends.find(e => e.tipo === 'link-local');
    if (!temLink(t, origemId, porta)) return res('sem-link', { de: (g ?? ll).ip });
    if (ehLinkLocal(dest)) { origem = ll.ip; proximo = dest; }
    else {
      if (!g) return res('sem-ip');
      origem = g.ip;
      if (mesmaRede6(g.ip, dest, g.prefixo)) proximo = dest;
      else {
        const gw = lerIPv6(o.gateway6);
        if (gw === null) return res('sem-rota', { de: g.ip });
        if (!ehLinkLocal(gw) && !mesmaRede6(g.ip, gw, g.prefixo)) return res('gateway-fora', { de: g.ip });
        proximo = gw;
      }
    }
  } else if (o.tipo === 'roteador') {
    if (ehLinkLocal(dest)) {
      // link-local só existe no enlace: sai pela interface em cujo enlace o vizinho está
      const saida = o.interfaces.map(i => ({ p: i.id, ll: enderecosDaInterface(o, i.id).find(e => e.tipo === 'link-local') }))
        .find(x => x.ll && resolverVizinho(t, o.id, x.p, dest).achados.length);
      if (!saida) return res('sem-rota', { de: globais(o)[0]?.ip });
      porta = saida.p; proximo = dest; origem = saida.ll.ip;
    } else {
      const s = escolherRota6(t, o, dest);
      if (!s) return res('sem-rota', { de: globais(o)[0]?.ip });
      porta = s.porta; proximo = s.proximo; origem = s.ip;
    }
  } else return res('sem-ip');
  if (origemForcada !== null) origem = origemForcada;

  let hop = HOP_LIMIT[o.tipo];
  let viz = resolverVizinho(t, origemId, porta, proximo);
  capturarNdp(t, ctx, origemId, porta, origem, proximo, viz);
  const aprendizado = [];
  if (!viz.achados.length) return res('arp-falhou', { de: origem });
  if (viz.achados.length > 1) return res('conflito-ip', { de: origem });
  aprendizado.push({ d: origemId, ip: proximo, mac: viz.achados[0].mac }, { d: viz.achados[0].d, ip: origem, mac: macDe(origemId, porta) });
  let atual = viz.achados[0];
  const saltos = [], caminho = [origemId];
  capturarQuadro(t, ctx, { d: origemId, p: porta }, atual, origem, dest, hop, l4);

  for (let passo = 0; passo < MAX_SALTOS; passo++) {
    const dev = dispositivo(t, atual.d);
    caminho.push(dev.id);
    const d = dono(dev, dest);
    if (d) return { status: 'entregue', destino: { d: dev.id, p: d.id }, ttl: hop, saltos, caminho, de: dest, origem, aprendizado };
    if (dev.tipo !== 'roteador' || ehLinkLocal(dest) || !ehRoteavel(dest)) return { status: 'descartado', saltos, caminho, ttl: hop, aprendizado };
    const entrada = enderecosDaInterface(dev, atual.p).find(e => e.tipo === 'global') ?? enderecosDaInterface(dev, atual.p)[0];
    if (!dev.ipv6Roteamento) return { status: 'sem-roteamento6', de: entrada?.ip, saltos, caminho, ttl: hop, aprendizado };
    hop -= 1;
    saltos.push({ d: dev.id, ip: entrada.ip });
    if (hop <= 0) return { status: 'ttl-expirado', de: entrada.ip, saltos, caminho, ttl: hop, aprendizado };
    const s = escolherRota6(t, dev, dest);
    if (!s) return { status: 'rede-inalcancavel', de: entrada.ip, saltos, caminho, ttl: hop, aprendizado };
    viz = resolverVizinho(t, dev.id, s.porta, s.proximo);
    capturarNdp(t, ctx, dev.id, s.porta, s.ip, s.proximo, viz);
    if (!viz.achados.length) return { status: 'host-inalcancavel', de: entrada.ip, saltos, caminho, ttl: hop, aprendizado };
    if (viz.achados.length > 1) return { status: 'conflito-ip', de: entrada.ip, saltos, caminho, ttl: hop, aprendizado };
    aprendizado.push({ d: dev.id, ip: s.proximo, mac: viz.achados[0].mac }, { d: viz.achados[0].d, ip: s.ip, mac: macDe(dev.id, s.porta) });
    capturarQuadro(t, ctx, { d: dev.id, p: s.porta }, viz.achados[0], origem, dest, hop, l4);
    atual = viz.achados[0];
  }
  return { status: 'ttl-expirado', de: origem, saltos, caminho, ttl: 0, aprendizado };
}

/** Endereços IPv6 duplicados no mesmo domínio de camada 2 (o DAD real marcaria o endereço como duplicado). */
export function conflitos6(t) {
  const lista = [], vistos = new Set();
  for (const d of t.dispositivos) for (const i of d.interfaces) for (const e of enderecosDaInterface(d, i.id)) {
    if (e.tipo !== 'global') continue;
    for (const x of dominioL2(t, d.id, i.id) ?? []) {
      if (!enderecosDaInterface(dispositivo(t, x.d), x.p).some(y => y.ip === e.ip)) continue;
      const k = [`${d.id}:${i.id}`, `${x.d}:${x.p}`].sort().join('|');
      if (!vistos.has(k)) { vistos.add(k); lista.push({ ip: e.ip, a: { d: d.id, p: i.id }, b: x }); }
    }
  }
  return lista;
}
