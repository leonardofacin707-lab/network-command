// Base do modelo da topologia: tipos de dispositivo, consultas, criação, nomes, IPv4 das interfaces e cabos.
import { lerIPv4, lerMascara, validarEnderecoDeHost, formatarIPv4 } from '../ipv4.js';

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

export const NOME_VALIDO = /^[A-Za-z0-9][A-Za-z0-9_-]{0,14}$/;
export const limitar = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

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

export const trocar = (t, id, fn) => ({ ...t, dispositivos: t.dispositivos.map(d => (d.id === id ? fn(d) : d)) });

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
