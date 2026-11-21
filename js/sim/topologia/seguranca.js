// NAT e filtro de pacotes (ACL simplificada) dos roteadores.
import { lerIPv4, lerMascara, formatarIPv4, enderecoDeRede } from '../ipv4.js';
import { dispositivo, trocar } from './base.js';

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
export function lerProtocoloPorta(protocolo, porta) {
  if (!PROTOCOLOS_FILTRO.includes(protocolo)) return { erro: 'Protocolo inválido. Use ip (qualquer), icmp, tcp ou udp.' };
  const txt = String(porta ?? '').trim();
  if (!txt) return { campos: protocolo === 'ip' ? {} : { protocolo } };
  if (protocolo !== 'tcp' && protocolo !== 'udp') return { erro: 'Porta só existe em regras tcp ou udp.' };
  const n = Number(txt);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return { erro: 'Porta inválida. Use um número de 1 a 65535.' };
  return { campos: { protocolo, porta: n } };
}

export function lerAlvoDeFiltro(rede, mascara, rotulo) {
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
