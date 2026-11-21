// Validação da topologia vinda de fora (arquivo salvo, importação, dados de missão): descarta o inválido.
import { lerIPv6, formatarIPv6, mesmaRede6, ehMulticast } from '../ipv6.js';
import { lerIPv4, lerMascara, validarEnderecoDeHost, formatarIPv4, enderecoDeRede } from '../ipv4.js';
import { TIPOS, LARGURA, ALTURA, MAX_DISPOSITIVOS, topologiaVazia, dispositivo, NOME_VALIDO, limitar } from './base.js';
import { lerEndereco6, lerRota6 } from './ipv6.js';
import { lerNetworkOspf, MAX_NETWORKS_OSPF } from './ospf.js';
import { lerWifiAp, lerWifiPc } from './wifi.js';
import { VLAN_MIN, VLAN_MAX } from './switch.js';
import { MAX_ROTAS } from './rotas.js';
import { NOME_DNS, familiaDe, MAX_REGISTROS_DNS, MAX_SERVICOS } from './servicos.js';
import { lerProtocoloPorta, MAX_FILTROS } from './seguranca.js';
import { MAX_POOL } from './dhcp.js';

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
