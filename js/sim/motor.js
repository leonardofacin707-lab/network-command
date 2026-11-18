// Motor de simulação de rede (camadas 2 e 3). Puro: não conhece DOM, tela nem localStorage.
// Modela: domínio de broadcast através de switches (com VLANs: portas access e trunk), resolução ARP, encaminhamento por
// roteadores (rotas conectadas; uma interface física por VLAN), TTL e a resposta de volta.
// NÃO modela: latência, perda aleatória, subinterfaces (router-on-a-stick), STP, rotas estáticas, DHCP, NAT, firewall.
import { lerIPv4, lerMascara, mesmaRede, formatarIPv4 } from './ipv4.js';
import { vizinhos, dispositivo, configDaPortaSwitch } from './topologia.js';

export const TTL_INICIAL = { pc: 128, roteador: 255, switch: 255 };
const MAX_SALTOS = 16;

/** Endereço MAC determinístico (administrado localmente, prefixo 02) a partir do dispositivo e da porta. */
export function macDe(dispositivoId, portaId) {
  let h = 2166136261;
  for (const ch of `${dispositivoId}/${portaId}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const b = [h >>> 24, (h >>> 16) & 255, (h >>> 8) & 255, h & 255];
  return ['02', '00', ...b.map(x => x.toString(16).padStart(2, '0'))].join('-');
}

/** { ip, mascara } numéricos da interface, ou null se não configurada. */
export function configDaInterface(d, portaId) {
  const i = d.interfaces.find(x => x.id === portaId);
  const ip = i ? lerIPv4(i.ip) : null, mascara = i ? lerMascara(i.mascara) : null;
  return ip !== null && mascara !== null ? { ip, mascara } : null;
}

export const temLink = (t, d, p) => vizinhos(t, d).some(v => v.minhaPorta === p);

/** Todas as interfaces configuradas de um dispositivo: [{ p, ip, mascara }]. */
export function interfacesConfiguradas(d) {
  return d.interfaces.map(i => ({ p: i.id, ...configDaInterface(d, i.id) })).filter(i => i.ip !== undefined);
}

/**
 * Quem recebe um broadcast enviado por esta porta: segue os cabos através dos switches e devolve as pontas que não são
 * switch. O quadro pertence a uma VLAN: portas access só repetem o quadro na própria VLAN, portas trunk levam qualquer
 * VLAN (marcada) e entregam sem marca só a VLAN nativa (1). null se a porta está sem cabo.
 */
export function dominioL2(t, origemId, origemPorta) {
  const inicio = vizinhos(t, origemId).find(v => v.minhaPorta === origemPorta);
  if (!inicio) return null;
  const pontas = [], visitados = new Set();
  // item: { d, p, vlan } = o quadro chega em d pela porta p; vlan null = ainda sem marca (veio de um host)
  const fila = [{ ...inicio.outro, vlan: null }];
  while (fila.length) {
    const { d, p, vlan } = fila.shift();
    const dev = dispositivo(t, d);
    if (dev.tipo === 'switch') {
      const entrada = configDaPortaSwitch(dev, p);
      const v = entrada.modo === 'access' ? entrada.vlan : (vlan ?? 1); // trunk: usa a marca; sem marca é a VLAN nativa
      const chave = `${d}:${v}`;
      if (visitados.has(chave)) continue;
      visitados.add(chave);
      for (const viz of vizinhos(t, d)) {
        if (viz.minhaPorta === p) continue;
        const saida = configDaPortaSwitch(dev, viz.minhaPorta);
        if (saida.modo === 'access' && saida.vlan !== v) continue;
        if (saida.modo === 'trunk') fila.push({ ...viz.outro, vlan: v });   // sai marcado com a VLAN v
        else fila.push({ ...viz.outro, vlan: null });                         // access: sai sem marca
      }
    } else if (!(d === origemId && p === origemPorta)) {
      // Um host/roteador ligado a um trunk só recebe a VLAN nativa (sem subinterfaces no motor).
      if (vlan === null || vlan === 1 || vlan === undefined) pontas.push({ d, p });
    }
  }
  return pontas;
}

/** ARP: quem, no domínio desta porta, tem o IP? Devolve { link, achados: [{ d, p, mac }] }. */
export function resolverArp(t, origemId, origemPorta, ip) {
  const dominio = dominioL2(t, origemId, origemPorta);
  if (dominio === null) return { link: false, achados: [] };
  const achados = dominio.filter(e => configDaInterface(dispositivo(t, e.d), e.p)?.ip === ip).map(e => ({ ...e, mac: macDe(e.d, e.p) }));
  return { link: true, achados };
}

const donoDoIp = (dev, ip) => dev.interfaces.find(i => configDaInterface(dev, i.id)?.ip === ip) ?? null;

/** Pares de interfaces, no mesmo domínio L2, configuradas com o mesmo IP. */
export function conflitosDeIp(t) {
  const vistos = new Set(), lista = [];
  for (const d of t.dispositivos) for (const i of d.interfaces) {
    const cfg = configDaInterface(d, i.id);
    if (!cfg) continue;
    const dom = dominioL2(t, d.id, i.id) ?? [];
    for (const e of dom) {
      const outra = configDaInterface(dispositivo(t, e.d), e.p);
      if (outra && outra.ip === cfg.ip) {
        const chave = [`${d.id}:${i.id}`, `${e.d}:${e.p}`].sort().join('|');
        if (!vistos.has(chave)) { vistos.add(chave); lista.push({ ip: cfg.ip, a: { d: d.id, p: i.id }, b: { d: e.d, p: e.p } }); }
      }
    }
  }
  return lista;
}

/**
 * Leva um pacote de origemId até ipDest. Resultado:
 *  status: 'entregue' | 'sem-ip' | 'sem-link' | 'sem-rota' | 'gateway-fora' | 'arp-falhou' | 'conflito-ip'
 *        | 'descartado' | 'ttl-expirado' | 'rede-inalcancavel' | 'host-inalcancavel'
 *  de: IP de quem reportou o erro; saltos: roteadores atravessados [{ d, ip }]; ttl: TTL ao chegar;
 *  destino: { d, p } quando entregue; caminho: ids dos dispositivos lógicos percorridos.
 */
export function enviarPacote(t, origemId, ipDest) {
  const o = dispositivo(t, origemId);
  const resultado = (status, extra = {}) => ({ status, saltos: [], caminho: [origemId], ...extra });
  const meusIps = interfacesConfiguradas(o);
  if (meusIps.some(i => i.ip === ipDest)) return resultado('entregue', { destino: { d: origemId, p: meusIps.find(i => i.ip === ipDest).p }, ttl: TTL_INICIAL[o.tipo], de: ipDest });

  let porta, proximoIp, ipDeOrigem;
  if (o.tipo === 'pc') {
    porta = 'eth0';
    const cfg = configDaInterface(o, porta);
    if (!cfg) return resultado('sem-ip');
    if (!temLink(t, origemId, porta)) return resultado('sem-link', { de: cfg.ip });
    ipDeOrigem = cfg.ip;
    if (mesmaRede(cfg.ip, ipDest, cfg.mascara)) proximoIp = ipDest;
    else {
      const gw = lerIPv4(o.gateway);
      if (gw === null) return resultado('sem-rota', { de: cfg.ip });
      if (!mesmaRede(cfg.ip, gw, cfg.mascara)) return resultado('gateway-fora', { de: cfg.ip });
      proximoIp = gw;
    }
  } else if (o.tipo === 'roteador') {
    const saida = rotaConectada(t, o, ipDest);
    if (!saida) return resultado('sem-rota', { de: meusIps[0]?.ip });
    porta = saida.p; proximoIp = ipDest; ipDeOrigem = saida.ip;
  } else {
    return resultado('sem-ip'); // switch não origina tráfego IP
  }

  let ttl = TTL_INICIAL[o.tipo];
  let arp = resolverArp(t, origemId, porta, proximoIp);
  const aprendizado = [{ d: origemId, ip: proximoIp, mac: arp.achados[0]?.mac }];
  if (arp.achados.length === 0) return resultado('arp-falhou', { de: ipDeOrigem });
  if (arp.achados.length > 1) return resultado('conflito-ip', { de: ipDeOrigem });
  let atual = arp.achados[0];
  const saltos = [], caminho = [origemId];

  for (let passo = 0; passo < MAX_SALTOS; passo++) {
    const dev = dispositivo(t, atual.d);
    caminho.push(dev.id);
    const dono = donoDoIp(dev, ipDest);
    if (dono) return { status: 'entregue', destino: { d: dev.id, p: dono.id }, ttl, saltos, caminho, de: ipDest, aprendizado };
    if (dev.tipo !== 'roteador') return { status: 'descartado', saltos, caminho, ttl, aprendizado };
    const ingresso = configDaInterface(dev, atual.p);
    ttl -= 1;
    saltos.push({ d: dev.id, ip: ingresso.ip });
    if (ttl <= 0) return { status: 'ttl-expirado', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    const saida = rotaConectada(t, dev, ipDest);
    if (!saida) return { status: 'rede-inalcancavel', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    arp = resolverArp(t, dev.id, saida.p, ipDest);
    if (arp.achados.length === 0) return { status: 'host-inalcancavel', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    if (arp.achados.length > 1) return { status: 'conflito-ip', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    aprendizado.push({ d: dev.id, ip: ipDest, mac: arp.achados[0].mac });
    atual = arp.achados[0];
  }
  return { status: 'ttl-expirado', de: ipDeOrigem, saltos, caminho, ttl: 0, aprendizado };
}

/** Rota conectada de um roteador: a interface (com link e IP) cuja sub-rede contém o destino. */
function rotaConectada(t, roteador, ipDest) {
  for (const i of interfacesConfiguradas(roteador)) {
    if (temLink(t, roteador.id, i.p) && mesmaRede(i.ip, ipDest, i.mascara)) return i;
  }
  return null;
}

/**
 * Simulação com estado de sessão (cache ARP). Recriar a simulação limpa os caches, como reiniciar a rede.
 * ping: ida e volta; rastrear: caminho de ida com os roteadores.
 */
export function criarSimulacao(t) {
  const arp = new Map(); // dispositivoId -> Map(ipNum -> mac)
  const aprender = lista => {
    for (const a of lista ?? []) if (a.mac) { if (!arp.has(a.d)) arp.set(a.d, new Map()); arp.get(a.d).set(a.ip, a.mac); }
  };

  return {
    topologia: t,
    ping(origemId, ipDest) {
      const ida = enviarPacote(t, origemId, ipDest);
      aprender(ida.aprendizado);
      if (ida.status !== 'entregue') return { ...ida, volta: null };
      const volta = enviarPacote(t, ida.destino.d, ipDeOrigem(t, origemId));
      aprender(volta.aprendizado);
      if (volta.status !== 'entregue') return { status: 'timeout', saltos: ida.saltos, caminho: ida.caminho, ida, volta };
      return { status: 'entregue', ttl: volta.ttl, de: ipDest, saltos: ida.saltos, caminho: ida.caminho, destino: ida.destino, ida, volta };
    },
    rastrear: (origemId, ipDest) => { const r = enviarPacote(t, origemId, ipDest); aprender(r.aprendizado); return r; },
    tabelaArp: id => [...(arp.get(id) ?? [])].map(([ip, mac]) => ({ ip, mac })).sort((a, b) => a.ip - b.ip)
  };
}

/** IP de origem dos pacotes de um dispositivo: o do computador, ou o da primeira interface configurada do roteador. */
function ipDeOrigem(t, origemId) {
  const o = dispositivo(t, origemId);
  return o.tipo === 'pc' ? configDaInterface(o, 'eth0').ip : interfacesConfiguradas(o)[0].ip;
}

export { formatarIPv4 };
