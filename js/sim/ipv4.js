// Aritmética IPv4 pura. Endereços e máscaras viram inteiros sem sinal de 32 bits (números JavaScript).
const U32 = n => n >>> 0;

/** "192.168.1.10" -> número, ou null se inválido (4 octetos decimais de 0 a 255, sem zeros à esquerda). */
export function lerIPv4(texto) {
  if (typeof texto !== 'string') return null;
  const partes = texto.trim().split('.');
  if (partes.length !== 4) return null;
  let n = 0;
  for (const p of partes) {
    if (!/^(0|[1-9]\d{0,2})$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return U32(n);
}

export const formatarIPv4 = n => [24, 16, 8, 0].map(s => (U32(n) >>> s) & 255).join('.');

/** Prefixo (0 a 32) -> máscara numérica. */
export const mascaraDePrefixo = p => (p <= 0 ? 0 : U32(0xFFFFFFFF << (32 - p)));

/** Máscara numérica -> prefixo, ou null se os bits 1 não forem contínuos (ex.: 255.0.255.0). */
export function prefixoDeMascara(m) {
  m = U32(m);
  for (let p = 0; p <= 32; p++) if (mascaraDePrefixo(p) === m) return p;
  return null;
}

/** Lê uma máscara em decimal pontuado ("255.255.255.0") ou prefixo ("/24" ou "24"). null se inválida. */
export function lerMascara(texto) {
  if (typeof texto !== 'string') return null;
  const t = texto.trim();
  if (/^\/?\d{1,2}$/.test(t)) {
    const p = Number(t.replace('/', ''));
    return p >= 0 && p <= 32 ? mascaraDePrefixo(p) : null;
  }
  const n = lerIPv4(t);
  return n !== null && prefixoDeMascara(n) !== null ? n : null;
}

export const enderecoDeRede = (ip, m) => U32(ip & m);
export const enderecoDeBroadcast = (ip, m) => U32(ip | ~m);

/** Os dois endereços estão na mesma rede, segundo a máscara dada? */
export const mesmaRede = (a, b, m) => enderecoDeRede(a, m) === enderecoDeRede(b, m);

/** Quantidade de endereços utilizáveis por host numa máscara (2^(32-p) - 2; 0 para /31 e /32 nesta simulação). */
export function hostsUteis(m) {
  const p = prefixoDeMascara(m);
  return p === null || p > 30 ? 0 : 2 ** (32 - p) - 2;
}

export function classeDe(ip) {
  const o = U32(ip) >>> 24;
  return o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D' : 'E';
}

/**
 * Pode este IP ser configurado em uma interface de host, com esta máscara? Devolve a mensagem de erro ou null.
 * Regras desta simulação: unicast de classes A, B ou C; fora de 0.0.0.0/8 e 127.0.0.0/8; máscara de /8 a /30;
 * não pode ser o endereço de rede nem o de broadcast da própria sub-rede.
 */
export function validarEnderecoDeHost(ip, m) {
  if (ip === null || ip === undefined) return 'Endereço IPv4 inválido. Use quatro números de 0 a 255 separados por ponto.';
  if (m === null || m === undefined) return 'Máscara inválida. Use algo como 255.255.255.0 (os bits 1 devem ser contínuos).';
  const p = prefixoDeMascara(m);
  if (p === null || p < 8 || p > 30) return 'Máscara fora do que a simulação aceita (de /8 a /30).';
  const primeiro = U32(ip) >>> 24;
  if (primeiro === 0) return 'Endereços 0.x.x.x não podem ser usados em um host.';
  if (primeiro === 127) return 'Endereços 127.x.x.x são de loopback e não podem ser usados em uma interface.';
  if (primeiro >= 224) return 'Endereços de multicast e reservados (224 ou mais) não podem ser usados em um host.';
  if (ip === enderecoDeRede(ip, m)) return 'Esse é o endereço de rede da sub-rede, não de um host.';
  if (ip === enderecoDeBroadcast(ip, m)) return 'Esse é o endereço de broadcast da sub-rede, não de um host.';
  return null;
}
