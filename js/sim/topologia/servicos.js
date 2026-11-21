// Serviços dos computadores: DNS (cliente e servidor com registros A/AAAA) e portas TCP abertas.
import { lerIPv6, formatarIPv6, ehMulticast } from '../ipv6.js';
import { lerIPv4, formatarIPv4 } from '../ipv4.js';
import { dispositivo, trocar } from './base.js';

export const MAX_REGISTROS_DNS = 12;
export const NOME_DNS = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?){0,3}$/;

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
export const familiaDe = ip => (String(ip).includes(':') ? 'AAAA' : 'A');
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
