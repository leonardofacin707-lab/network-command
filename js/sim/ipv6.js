// Endereços IPv6 (puro). Internamente cada endereço é um BigInt de 128 bits.
// Formatação canônica da RFC 5952: minúsculas, sem zeros à esquerda e a maior sequência de 2+ hextetos zerados vira "::".

const MAX = (1n << 128n) - 1n;

/** Lê "2001:db8::1" (aceita maiúsculas e "::"). Devolve BigInt ou null. Não aceita IPv4 embutido nem "%zona". */
export function lerIPv6(texto) {
  const s = String(texto ?? '').trim().toLowerCase();
  if (!s || !/^[0-9a-f:]+$/.test(s) || s.includes(':::')) return null;
  const partes = s.split('::');
  if (partes.length > 2) return null;
  const grupos = p => (p === '' ? [] : p.split(':'));
  const esq = grupos(partes[0]), dir = partes.length === 2 ? grupos(partes[1]) : [];
  if ([...esq, ...dir].some(h => !/^[0-9a-f]{1,4}$/.test(h))) return null;
  const faltam = 8 - esq.length - dir.length;
  if (partes.length === 2 ? faltam < 1 : faltam !== 0) return null;
  const todos = [...esq, ...Array(partes.length === 2 ? faltam : 0).fill('0'), ...dir];
  return todos.reduce((n, h) => (n << 16n) | BigInt(parseInt(h, 16)), 0n);
}

export const hextetos = n => Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(112 - 16 * i)) & 0xffffn));

/** Forma canônica a partir dos 8 hextetos (números). */
export function abreviarIPv6(h) {
  let melhor = { ini: -1, tam: 0 };
  for (let i = 0; i < 8;) {
    if (h[i] !== 0) { i++; continue; }
    let j = i; while (j < 8 && h[j] === 0) j++;
    if (j - i > melhor.tam) melhor = { ini: i, tam: j - i };
    i = j;
  }
  const txt = h.map(x => x.toString(16));
  if (melhor.tam < 2) return txt.join(':');
  return `${txt.slice(0, melhor.ini).join(':')}::${txt.slice(melhor.ini + melhor.tam).join(':')}`;
}

export const formatarIPv6 = n => abreviarIPv6(hextetos(n));
export const completoIPv6 = n => hextetos(n).map(x => x.toString(16).padStart(4, '0')).join(':');

/** "64" ou "/64" → 64 (0 a 128), ou null. */
export function lerPrefixo6(texto) {
  const s = String(texto ?? '').trim().replace(/^\//, '');
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n <= 128 ? n : null;
}

export const mascara6 = p => (p === 0 ? 0n : (MAX << BigInt(128 - p)) & MAX);
export const rede6 = (ip, p) => ip & mascara6(p);
export const mesmaRede6 = (a, b, p) => rede6(a, p) === rede6(b, p);

const em = (ip, prefixo, p) => rede6(ip, p) === prefixo;
export const ehLinkLocal = ip => em(ip, 0xfe80n << 112n, 10);
export const ehMulticast = ip => em(ip, 0xffn << 120n, 8);
export const ehGlobal = ip => em(ip, 1n << 125n, 3);
export const ehUla = ip => em(ip, 0xfcn << 120n, 7);

/** Tipo do endereço, para mensagens e para as aulas. */
export function tipoIPv6(ip) {
  if (ip === 0n) return 'não especificado';
  if (ip === 1n) return 'loopback';
  if (ehMulticast(ip)) return 'multicast';
  if (ehLinkLocal(ip)) return 'link-local';
  if (ehUla(ip)) return 'local única (ULA)';
  if (ehGlobal(ip)) return 'global unicast';
  return 'reservado';
}

/** Identificador de interface EUI-64 a partir do MAC "02-00-aa-bb-cc-dd": inverte o bit U/L e insere ff:fe no meio. */
export function idEui64(mac) {
  const b = mac.split('-').map(x => parseInt(x, 16));
  b[0] ^= 0x02;
  return [b[0], b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]].reduce((n, x) => (n << 8n) | BigInt(x), 0n);
}

export const linkLocalDe = mac => (0xfe80n << 112n) | idEui64(mac);
export const slaacDe = (prefixo, mac) => rede6(prefixo, 64) | idEui64(mac);

/** Endereço multicast "solicited-node" usado pela descoberta de vizinhos: ff02::1:ff + últimos 24 bits. */
export const solicitedNode = ip => (0xff02n << 112n) | (0x1ffn << 24n) | (ip & 0xffffffn);
