// IPv6 no modelo: endereço global e prefixo por interface, gateway, SLAAC, DHCPv6 e rotas estáticas IPv6.
import { lerIPv6, formatarIPv6, lerPrefixo6, rede6, mesmaRede6, ehLinkLocal, ehMulticast } from '../ipv6.js';
import { MAX_ROTAS } from './rotas.js';
import { dispositivo, trocar } from './base.js';

// ---------- IPv6 ----------
/** Lê endereço e prefixo IPv6 de uma interface. Os dois vazios = sem IPv6. Devolve { ip, prefixo } ou { erro }. */
export function lerEndereco6(ip6, prefixo6) {
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

export function lerRota6({ rede, prefixo, via }) {
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
