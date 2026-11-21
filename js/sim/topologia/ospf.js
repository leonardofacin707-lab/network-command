// OSPF no modelo: comandos "network REDE WILDCARD area N" de cada roteador.
import { lerIPv4, formatarIPv4 } from '../ipv4.js';
import { dispositivo, trocar } from './base.js';

// ---------- OSPF ----------
export const MAX_NETWORKS_OSPF = 8;

export function lerNetworkOspf({ rede, wildcard, area }) {
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
