// Exercícios gerados (puros, sem DOM): sub-redes IPv4 e notação IPv6, infinitos e com a resolução passo a passo.
// Cada exercício: { tipo, enunciado, dica, resposta (texto canônico), confere(texto) -> boolean, passos: [texto] }.
import { formatarIPv4, mascaraDePrefixo, enderecoDeRede, enderecoDeBroadcast, hostsUteis, lerIPv4, lerMascara } from '../sim/ipv4.js';

export const TIPOS_EXERCICIO = {
  rede: 'Endereço de rede',
  broadcast: 'Endereço de broadcast',
  faixa: 'Primeiro e último host',
  hosts: 'Hosts úteis',
  mascara: 'Máscara do prefixo',
  divisao: 'Dividir em sub-redes',
  'ipv6-abreviar': 'Abreviar IPv6',
  'ipv6-expandir': 'Expandir IPv6'
};

const inteiro = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const escolher = (rng, lista) => lista[Math.floor(rng() * lista.length)];
const binOcteto = n => n.toString(2).padStart(8, '0');

/** Um host aleatório em uma rede privada, com prefixo entre 16 e 30. */
function hostAleatorio(rng) {
  const base = escolher(rng, [[10, inteiro(rng, 0, 255)], [172, inteiro(rng, 16, 31)], [192, 168]]);
  const prefixo = inteiro(rng, 16, 30);
  const mascara = mascaraDePrefixo(prefixo);
  for (;;) {
    const ip = lerIPv4(`${base[0]}.${base[1]}.${inteiro(rng, 0, 255)}.${inteiro(rng, 0, 255)}`);
    if (ip !== enderecoDeRede(ip, mascara) && ip !== enderecoDeBroadcast(ip, mascara)) return { ip, prefixo, mascara };
  }
}

/** Passos comuns: qual octeto é o "interessante" e o tamanho do bloco nele. */
function passosDoBloco(ip, prefixo) {
  const octeto = Math.min(3, Math.floor(prefixo / 8)); // índice do octeto onde a máscara deixa de ser 255
  const bitsRede = prefixo - octeto * 8;
  const bloco = 2 ** (8 - bitsRede);
  const valor = (ip >>> (24 - octeto * 8)) & 255;
  const inicio = Math.floor(valor / bloco) * bloco;
  return {
    octeto, bloco, inicio,
    passos: [
      `/${prefixo} = máscara ${formatarIPv4(mascaraDePrefixo(prefixo))}.`,
      prefixo % 8 === 0 ? `A máscara termina no fim de um octeto: a rede é a parte com 255.`
        : `O ${octeto + 1}º octeto é o "interessante": ${bitsRede} bits de rede nele, então o bloco é 2^${8 - bitsRede} = ${bloco}.`,
      prefixo % 8 === 0 ? '' : `No ${octeto + 1}º octeto o host tem ${valor} (${binOcteto(valor)}). O múltiplo de ${bloco} logo abaixo é ${inicio}.`
    ].filter(Boolean)
  };
}

const normalizarIp = texto => { const n = lerIPv4(String(texto).trim()); return n === null ? null : formatarIPv4(n); };

export function gerarExercicio(tipo, rng = Math.random) {
  switch (tipo) {
    case 'rede': case 'broadcast': case 'faixa': {
      const { ip, prefixo, mascara } = hostAleatorio(rng);
      const rede = enderecoDeRede(ip, mascara), bc = enderecoDeBroadcast(ip, mascara), b = passosDoBloco(ip, prefixo);
      const comum = [...b.passos, `Rede: ${formatarIPv4(rede)}. Broadcast: o próximo bloco menos 1 = ${formatarIPv4(bc)}.`];
      if (tipo === 'rede') return { tipo, enunciado: `Qual é o endereço de rede do host ${formatarIPv4(ip)}/${prefixo}?`, dica: 'Zere os bits de host: ache o bloco no octeto interessante.', resposta: formatarIPv4(rede), confere: t => normalizarIp(t) === formatarIPv4(rede), passos: comum };
      if (tipo === 'broadcast') return { tipo, enunciado: `Qual é o endereço de broadcast da rede do host ${formatarIPv4(ip)}/${prefixo}?`, dica: 'Ligue todos os bits de host: é o endereço logo antes da próxima rede.', resposta: formatarIPv4(bc), confere: t => normalizarIp(t) === formatarIPv4(bc), passos: comum };
      const resposta = `${formatarIPv4(rede + 1)} - ${formatarIPv4(bc - 1)}`;
      return { tipo, enunciado: `Qual é a faixa de hosts úteis da rede de ${formatarIPv4(ip)}/${prefixo}? Responda "primeiro - último".`, dica: 'Primeiro = rede + 1; último = broadcast - 1.', resposta,
        confere: t => { const p = String(t).trim().split(/\s*[-–]\s*|\s+(?:até|a)\s+/).filter(Boolean); return p.length === 2 && normalizarIp(p[0]) === formatarIPv4(rede + 1) && normalizarIp(p[1]) === formatarIPv4(bc - 1); },
        passos: [...comum, `Primeiro host = ${formatarIPv4(rede + 1)}; último = ${formatarIPv4(bc - 1)}.`] };
    }
    case 'hosts': {
      const prefixo = inteiro(rng, 16, 30), h = hostsUteis(mascaraDePrefixo(prefixo));
      return { tipo, enunciado: `Quantos hosts úteis cabem em uma rede /${prefixo}?`, dica: 'Bits de host = 32 - prefixo. Hosts = 2^bits - 2.', resposta: String(h),
        confere: t => Number(String(t).replace(/\./g, '').trim()) === h, passos: [`Bits de host: 32 - ${prefixo} = ${32 - prefixo}.`, `2^${32 - prefixo} = ${2 ** (32 - prefixo)} endereços, menos rede e broadcast = ${h}.`] };
    }
    case 'mascara': {
      const prefixo = inteiro(rng, 8, 30), m = formatarIPv4(mascaraDePrefixo(prefixo));
      return { tipo, enunciado: `Qual é a máscara em decimal de /${prefixo}?`, dica: 'Escreva 1s nos primeiros bits e converta cada octeto.', resposta: m,
        confere: t => { const n = lerMascara(String(t).trim()); return n !== null && formatarIPv4(n) === m && !String(t).includes('/'); },
        passos: [`/${prefixo}: ${prefixo} bits 1 seguidos de ${32 - prefixo} bits 0.`, `Em octetos: ${m.split('.').map(o => binOcteto(Number(o))).join('.')} = ${m}.`] };
    }
    case 'divisao': {
      const pre = escolher(rng, [16, 20, 22, 24]), n = 2 ** inteiro(rng, 1, 6), novo = pre + Math.log2(n);
      const redeBase = escolher(rng, ['10.0.0.0', '172.16.0.0', '192.168.0.0']);
      return { tipo, enunciado: `Você vai dividir ${redeBase}/${pre} em ${n} sub-redes do mesmo tamanho. Qual é o novo prefixo?`, dica: 'Cada bit emprestado do host dobra o número de sub-redes.', resposta: `/${novo}`,
        confere: t => Number(String(t).replace('/', '').trim()) === novo,
        passos: [`${n} sub-redes = 2^${Math.log2(n)}: é preciso pegar ${Math.log2(n)} bits do host.`, `Novo prefixo: ${pre} + ${Math.log2(n)} = /${novo}, com ${hostsUteis(mascaraDePrefixo(novo))} hosts úteis em cada sub-rede.`] };
    }
    case 'ipv6-abreviar': case 'ipv6-expandir': {
      const hextetos = ipv6Aleatorio(rng);
      const completo = hextetos.map(h => h.toString(16).padStart(4, '0')).join(':');
      const curto = abreviarIPv6(hextetos);
      if (tipo === 'ipv6-abreviar') return { tipo, enunciado: `Escreva da forma mais curta possível: ${completo}`, dica: 'Regra 1: tire os zeros à esquerda de cada hexteto. Regra 2: troque UMA sequência de hextetos zerados (a mais longa) por "::".', resposta: curto,
        confere: t => String(t).trim().toLowerCase() === curto, passos: passosIPv6(hextetos, curto) };
      return { tipo, enunciado: `Escreva o endereço completo (8 hextetos de 4 dígitos): ${curto}`, dica: 'Conte quantos hextetos faltam e coloque esse número de 0000 no lugar do "::". Complete cada hexteto com zeros à esquerda.', resposta: completo,
        confere: t => String(t).trim().toLowerCase() === completo, passos: [`O "::" substitui ${8 - curto.split(':').filter(Boolean).length} hextetos de zeros.`, `Completando com zeros à esquerda: ${completo}.`] };
    }
    default: throw new Error('tipo de exercício desconhecido: ' + tipo);
  }
}

/** 8 hextetos com uma ou duas sequências de zeros, para as regras de abreviação aparecerem. */
function ipv6Aleatorio(rng) {
  const h = [0x2001, 0x0db8, ...Array.from({ length: 6 }, () => (rng() < 0.4 ? inteiro(rng, 0, 0xff) : inteiro(rng, 0, 0xffff)))];
  const ini = inteiro(rng, 2, 5), tam = inteiro(rng, 1, Math.min(4, 8 - ini));
  for (let i = ini; i < ini + tam; i++) h[i] = 0;
  if (rng() < 0.4) { const j = ini + tam + 1; if (j < 8) h[j] = 0; }
  return h;
}

/** Forma canônica (RFC 5952): sem zeros à esquerda, a maior sequência de 2+ hextetos zerados vira "::" (a primeira, no empate). */
export function abreviarIPv6(hextetos) {
  let melhor = { ini: -1, tam: 0 };
  for (let i = 0; i < 8;) {
    if (hextetos[i] !== 0) { i++; continue; }
    let j = i; while (j < 8 && hextetos[j] === 0) j++;
    if (j - i > melhor.tam) melhor = { ini: i, tam: j - i };
    i = j;
  }
  const txt = hextetos.map(h => h.toString(16));
  if (melhor.tam < 2) return txt.join(':');
  const antes = txt.slice(0, melhor.ini).join(':'), depois = txt.slice(melhor.ini + melhor.tam).join(':');
  return `${antes}::${depois}`;
}

function passosIPv6(hextetos, curto) {
  const semZeros = hextetos.map(h => h.toString(16)).join(':');
  return [`Regra 1 (zeros à esquerda): ${semZeros}.`, curto === semZeros ? 'Regra 2: não há dois ou mais hextetos zerados seguidos, então não se usa "::".'
    : `Regra 2: a maior sequência de hextetos 0 vira "::" (só uma vez no endereço): ${curto}.`];
}

/** Gerador com semente (para testes). */
export function geradorComSemente(semente) {
  let s = semente >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
