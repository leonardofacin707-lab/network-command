// Motor de simulação de rede (camadas 2 e 3). Puro: não conhece DOM, tela nem localStorage.
// Modela: domínio de broadcast através de switches (com VLANs: portas access e trunk), resolução ARP, encaminhamento por
// roteadores (rotas conectadas e estáticas, com prefixo mais longo; uma interface física por VLAN), TTL e a resposta de volta.
// DHCP simplificado: o roteador dá concessões fixas (sem tempo de lease nem DORA mensagem a mensagem).
// DNS simplificado (consulta UDP 53 a um PC com registros A). Filtro de pacotes simplificado nos roteadores (regras em ordem,
// por protocolo e porta de destino, sem estado). NAT simplificado (PAT). Conexão TCP simplificada (SYN → SYN-ACK ou RST).
// Captura de pacotes (ARP, ICMP, TCP, UDP/DNS) por salto. NÃO modela: latência, perda aleatória, subinterfaces
// (router-on-a-stick), STP, roteamento dinâmico, firewall com estado, retransmissão e janelas do TCP.
import { lerIPv4, lerMascara, mesmaRede, formatarIPv4, prefixoDeMascara } from './ipv4.js';
import { vizinhos, dispositivo, configDaPortaSwitch } from './topologia.js';
import { anunciosSlaac, aplicarSlaac, enviarPacote6 } from './motor6.js';
import { associacoesWifi, aplicarWifi } from './wifi.js';

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
    if (dev.tipo === 'switch' || dev.tipo === 'ap') { // o ponto de acesso é uma ponte de camada 2 (todas as portas na VLAN 1)
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
 *        | 'descartado' | 'bloqueado' | 'ttl-expirado' | 'rede-inalcancavel' | 'host-inalcancavel'
 *  de: IP de quem reportou o erro; saltos: roteadores atravessados [{ d, ip }]; ttl: TTL ao chegar;
 *  destino: { d, p } quando entregue; caminho: ids dos dispositivos lógicos percorridos.
 */
export function enviarPacote(t, origemId, ipDest, l4 = ICMP_PEDIDO, ctx = null) {
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
    const saida = escolherRota(t, o, ipDest);
    if (!saida) return resultado('sem-rota', { de: meusIps[0]?.ip });
    porta = saida.porta; proximoIp = saida.proximo; ipDeOrigem = saida.ip;
  } else {
    return resultado('sem-ip'); // switch não origina tráfego IP
  }

  let ttl = TTL_INICIAL[o.tipo];
  let arp = resolverArp(t, origemId, porta, proximoIp);
  capturarArp(t, ctx, origemId, porta, ipDeOrigem, proximoIp, arp);
  const aprendizado = [{ d: origemId, ip: proximoIp, mac: arp.achados[0]?.mac }];
  if (arp.achados.length === 1) aprendizado.push({ d: arp.achados[0].d, ip: ipDeOrigem, mac: macDe(origemId, porta) }); // o pedido ARP ensina o MAC de quem perguntou
  if (arp.achados.length === 0) return resultado('arp-falhou', { de: ipDeOrigem });
  if (arp.achados.length > 1) return resultado('conflito-ip', { de: ipDeOrigem });
  let atual = arp.achados[0];
  const saltos = [], caminho = [origemId], traducoes = []; // traducoes: NAT aplicado no caminho [{ d, de, para }]
  capturarQuadro(t, ctx, { d: origemId, p: porta }, atual, ipDeOrigem, ipDest, ttl, l4);

  for (let passo = 0; passo < MAX_SALTOS; passo++) {
    const dev = dispositivo(t, atual.d);
    caminho.push(dev.id);
    const dono = donoDoIp(dev, ipDest);
    if (dono) return { status: 'entregue', destino: { d: dev.id, p: dono.id }, ttl, saltos, caminho, de: ipDest, aprendizado, traducoes, origemVista: ipDeOrigem };
    if (dev.tipo !== 'roteador') return { status: 'descartado', saltos, caminho, ttl, aprendizado };
    const ingresso = configDaInterface(dev, atual.p);
    ttl -= 1;
    saltos.push({ d: dev.id, ip: ingresso.ip });
    if (ttl <= 0) return { status: 'ttl-expirado', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    if (filtroNega(dev, ipDeOrigem, ipDest, l4)) return { status: 'bloqueado', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    const saida = escolherRota(t, dev, ipDest);
    if (!saida) return { status: 'rede-inalcancavel', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    if (dev.nat) {
      if (atual.p === dev.nat.fora && saida.porta === dev.nat.dentro) return { status: 'bloqueado', por: 'nat', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
      if (atual.p === dev.nat.dentro && saida.porta === dev.nat.fora) { traducoes.push({ d: dev.id, de: ipDeOrigem, para: saida.ip }); ipDeOrigem = saida.ip; }
    }
    arp = resolverArp(t, dev.id, saida.porta, saida.proximo);
    capturarArp(t, ctx, dev.id, saida.porta, saida.ip, saida.proximo, arp);
    if (arp.achados.length === 0) return { status: 'host-inalcancavel', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    if (arp.achados.length > 1) return { status: 'conflito-ip', de: ingresso.ip, saltos, caminho, ttl, aprendizado };
    aprendizado.push({ d: dev.id, ip: saida.proximo, mac: arp.achados[0].mac }, { d: arp.achados[0].d, ip: saida.ip, mac: macDe(dev.id, saida.porta) });
    capturarQuadro(t, ctx, { d: dev.id, p: saida.porta }, arp.achados[0], ipDeOrigem, ipDest, ttl, l4);
    atual = arp.achados[0];
  }
  return { status: 'ttl-expirado', de: ipDeOrigem, saltos, caminho, ttl: 0, aprendizado };
}

/**
 * Filtro de pacotes do roteador: primeira regra que casa (origem e destino) decide; sem regra que case, permite.
 * Sem estado: a resposta de um ping também é filtrada, com origem e destino trocados.
 */
export function filtroNega(roteador, ipOrigem, ipDest, l4 = ICMP_PEDIDO) {
  for (const f of roteador.filtros ?? []) {
    const casa = (rede, m, ip) => mesmaRede(lerIPv4(rede), ip, lerMascara(m));
    const proto = f.protocolo ?? 'ip';
    if (proto !== 'ip' && proto !== l4.proto) continue;
    if (f.porta !== undefined && f.porta !== null && f.porta !== l4.portaDestino) continue;
    if (casa(f.origem, f.origemM, ipOrigem) && casa(f.destino, f.destinoM, ipDest)) return f.acao === 'negar';
  }
  return false;
}

// ---------- pacotes de camada 4 e captura ----------
export const ICMP_PEDIDO = Object.freeze({ proto: 'icmp', tipo: 'echo-request' });
export const PORTA_CLIENTE = 50000; // porta de origem (efêmera) usada pelos clientes nesta simulação
export const NOMES_PORTAS = { 20: 'FTP-dados', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 67: 'DHCP', 68: 'DHCP', 80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS' };

/** O pacote de resposta: origem e destino trocados (e as portas também). */
export function respostaDe(l4, aceito = true) {
  if (l4.proto === 'icmp') return { proto: 'icmp', tipo: 'echo-reply' };
  if (l4.proto === 'tcp') return { proto: 'tcp', portaOrigem: l4.portaDestino, portaDestino: l4.portaOrigem, flags: aceito ? 'SYN, ACK' : 'RST, ACK' };
  return { ...l4, portaOrigem: l4.portaDestino, portaDestino: l4.portaOrigem, resposta: true };
}

function descreverL4(l4) {
  const nome = p => (NOMES_PORTAS[p] ? `${p} (${NOMES_PORTAS[p]})` : String(p));
  if (l4.proto === 'icmp') return { protocolo: 'ICMP', info: l4.tipo === 'echo-reply' ? 'Echo (ping) resposta' : 'Echo (ping) pedido' };
  if (l4.proto === 'tcp') return { protocolo: 'TCP', info: `${nome(l4.portaOrigem)} → ${nome(l4.portaDestino)} [${l4.flags ?? 'SYN'}]` };
  if (l4.dns) return { protocolo: 'DNS', info: l4.resposta ? `Resposta: ${l4.dns.nome} ${l4.dns.ip ? 'A ' + l4.dns.ip : '(nome não existe)'}` : `Consulta: ${l4.dns.nome} (A)` };
  return { protocolo: 'UDP', info: `${nome(l4.portaOrigem)} → ${nome(l4.portaDestino)}` };
}

const nomeDe = (t, d) => dispositivo(t, d)?.nome ?? d;

/** Registra o pedido e a(s) resposta(s) ARP quando quem envia ainda não conhece o MAC (cache vazio). */
function capturarArp(t, ctx, d, p, ipQuemPergunta, ipProcurado, arp) {
  if (!ctx?.registrar || !arp.link || ctx.conhece(d, ipProcurado)) return;
  const macPergunta = macDe(d, p);
  ctx.registrar({ protocolo: 'ARP', de: nomeDe(t, d), para: 'todos (broadcast)', macOrigem: macPergunta, macDestino: 'ff-ff-ff-ff-ff-ff',
    info: `Quem tem ${formatarIPv4(ipProcurado)}? Responda para ${ipQuemPergunta === undefined ? '?' : formatarIPv4(ipQuemPergunta)}` });
  for (const a of arp.achados) ctx.registrar({ protocolo: 'ARP', de: nomeDe(t, a.d), para: nomeDe(t, d), macOrigem: a.mac, macDestino: macPergunta,
    info: `${formatarIPv4(ipProcurado)} está em ${a.mac}` });
  if (arp.achados.length === 1) {
    ctx.aprender(d, ipProcurado, arp.achados[0].mac);
    if (ipQuemPergunta !== undefined) ctx.aprender(arp.achados[0].d, ipQuemPergunta, macPergunta); // quem responde aprende quem perguntou
  }
}

/**
 * Caminho físico de um quadro: da porta de saída até o dispositivo de destino, atravessando só switches (busca em largura
 * pelos cabos). Devolve a lista de ids [origem, ...switches, destino], ou null. Usado para animar o pacote no desenho.
 */
export function caminhoFisico(t, { de, porta, para }) {
  const inicio = vizinhos(t, de).find(v => v.minhaPorta === porta);
  if (!inicio) return null;
  const fila = [[de, inicio.outro.d]], vistos = new Set([inicio.outro.d]);
  while (fila.length) {
    const rota = fila.shift(), atual = rota.at(-1);
    if (atual === para) return rota;
    if (!['switch', 'ap'].includes(dispositivo(t, atual)?.tipo)) continue;
    for (const v of vizinhos(t, atual)) if (!vistos.has(v.outro.d)) { vistos.add(v.outro.d); fila.push([...rota, v.outro.d]); }
  }
  return null;
}

/** Registra um quadro com o pacote IP entre dois vizinhos de camada 2 (os MACs mudam a cada salto, os IPs não). */
function capturarQuadro(t, ctx, de, para, ipO, ipD, ttl, l4) {
  if (!ctx?.registrar) return;
  ctx.registrar({ ...descreverL4(l4), de: nomeDe(t, de.d), para: nomeDe(t, para.d), trecho: { de: de.d, porta: de.p, para: para.d }, macOrigem: macDe(de.d, de.p), macDestino: para.mac,
    ipOrigem: formatarIPv4(ipO), ipDestino: formatarIPv4(ipD), ttl });
}

/**
 * Escolhe a rota de um roteador para ipDest: entre as rotas conectadas (interfaces com cabo e IP) e as estáticas
 * (via um próximo salto alcançável por uma interface com cabo), vence o prefixo mais longo; em empate, a conectada.
 * Devolve { porta, proximo, ip, prefixo, tipo } ou null. Em rota conectada o próximo é o próprio destino.
 */
export function escolherRota(t, roteador, ipDest) {
  let melhor = null;
  for (const i of interfacesConfiguradas(roteador)) {
    if (!temLink(t, roteador.id, i.p) || !mesmaRede(i.ip, ipDest, i.mascara)) continue;
    const prefixo = prefixoDeMascara(i.mascara);
    if (!melhor || prefixo > melhor.prefixo) melhor = { porta: i.p, proximo: ipDest, ip: i.ip, prefixo, tipo: 'conectada' };
  }
  for (const r of roteador.rotas ?? []) {
    const rede = lerIPv4(r.rede), mascara = lerMascara(r.mascara), via = lerIPv4(r.via);
    if (rede === null || mascara === null || via === null || !mesmaRede(rede, ipDest, mascara)) continue;
    const prefixo = prefixoDeMascara(mascara);
    if (melhor && prefixo <= melhor.prefixo) continue;
    const saida = interfacesConfiguradas(roteador).find(i => temLink(t, roteador.id, i.p) && mesmaRede(i.ip, via, i.mascara));
    if (saida) melhor = { porta: saida.p, proximo: via, ip: saida.ip, prefixo, tipo: 'estatica' };
  }
  return melhor;
}

/**
 * Simulação com estado de sessão (cache ARP). Recriar a simulação limpa os caches, como reiniciar a rede.
 * ping: ida e volta; rastrear: caminho de ida com os roteadores.
 */
/**
 * DHCP (simplificado): para cada computador em modo automático, procura no seu domínio de broadcast um roteador com pool
 * numa interface configurada e entrega o primeiro endereço livre (fora de IPs fixos do domínio e de concessões já dadas).
 * Devolve Map(pcId -> { ok:true, ip, mascara, gateway, servidor:{ d, p, ip } } | { ok:false, motivo }).
 * motivos: 'sem-link', 'sem-servidor', 'pool-invalido', 'pool-esgotado'.
 */
export function concessoesDhcp(t) {
  const res = new Map(), dadas = new Map(); // chave do pool -> Set(ip)
  for (const pc of t.dispositivos) {
    if (pc.tipo !== 'pc' || !pc.dhcp) continue;
    const dominio = dominioL2(t, pc.id, 'eth0');
    if (dominio === null) { res.set(pc.id, { ok: false, motivo: 'sem-link' }); continue; }
    const servidores = [];
    for (const e of dominio) {
      const dev = dispositivo(t, e.d);
      const pool = dev.tipo === 'roteador' ? (dev.pools ?? []).find(q => q.porta === e.p) : null, cfg = pool && configDaInterface(dev, e.p);
      if (cfg) servidores.push({ dev, e, pool, cfg });
    }
    if (!servidores.length) { res.set(pc.id, { ok: false, motivo: 'sem-servidor' }); continue; }
    const fixos = new Set();
    for (const e of dominio) {
      const dev = dispositivo(t, e.d);
      if (dev.tipo === 'pc' && dev.dhcp) continue;
      const c = configDaInterface(dev, e.p);
      if (c) fixos.add(c.ip);
    }
    let motivo = 'pool-invalido';
    for (const { dev, e, pool, cfg } of servidores) {
      const ini = lerIPv4(pool.inicio), fim = lerIPv4(pool.fim);
      if (ini === null || fim === null || ini > fim || !mesmaRede(ini, cfg.ip, cfg.mascara) || !mesmaRede(fim, cfg.ip, cfg.mascara)) continue;
      const chave = `${dev.id}/${e.p}`;
      if (!dadas.has(chave)) dadas.set(chave, new Set());
      const usados = dadas.get(chave);
      let livre = null;
      for (let n = ini; n <= fim; n++) if (n !== cfg.ip && !fixos.has(n) && !usados.has(n)) { livre = n; break; }
      if (livre === null) { motivo = 'pool-esgotado'; continue; }
      usados.add(livre);
      res.set(pc.id, { ok: true, ip: livre, mascara: cfg.mascara, gateway: cfg.ip, servidor: { d: dev.id, p: e.p, ip: cfg.ip } });
      motivo = null;
      break;
    }
    if (motivo) res.set(pc.id, { ok: false, motivo });
  }
  return res;
}

/** A topologia como o PC a enxerga depois do DHCP: concessão no lugar da configuração manual (ou sem IP, se não houve). */
function aplicarConcessoes(t, concessoes) {
  if (!concessoes.size) return t;
  return { ...t, dispositivos: t.dispositivos.map(d => {
    const c = concessoes.get(d.id);
    if (!c) return d;
    const v4 = c.ok ? { ip: formatarIPv4(c.ip), mascara: formatarIPv4(c.mascara) } : { ip: '', mascara: '' };
    return { ...d, interfaces: d.interfaces.map(i => (i.id === 'eth0' ? { ...i, ...v4 } : i)), gateway: c.ok ? formatarIPv4(c.gateway) : '' };
  }) };
}

export function criarSimulacao(original) {
  const wifi = associacoesWifi(original), comWifi = aplicarWifi(original, wifi);
  const concessoes = concessoesDhcp(comWifi), comDhcp = aplicarConcessoes(comWifi, concessoes);
  const slaac = anunciosSlaac(comDhcp), t = aplicarSlaac(comDhcp, slaac);
  const arp = new Map(); // dispositivoId -> Map(ipNum -> mac)
  const aprenderUm = (d, ip, mac) => { if (!arp.has(d)) arp.set(d, new Map()); arp.get(d).set(ip, mac); };
  const aprender = lista => { for (const a of lista ?? []) if (a.mac) aprenderUm(a.d, a.ip, a.mac); };
  let gravando = null; // lista de pacotes capturados, enquanto sim.capturar() estiver ativo
  const ctx = { registrar: ev => gravando?.push({ no: gravando.length + 1, ...ev }), conhece: (d, ip) => arp.get(d)?.has(ip) ?? false, aprender: aprenderUm };
  const enviar = (de, ip, l4) => enviarPacote(t, de, ip, l4, gravando ? ctx : null);

  /**
   * Ida e volta de um pacote (ping, consulta DNS, conexão TCP). A resposta vai para o IP que o destino enxergou (traduzido
   * pelo NAT); em cada roteador com NAT ela é "destraduzida" e segue como nova perna até o IP anterior. aceitar(destino)
   * decide se o destino aceita (porta aberta); se não aceitar, a resposta ainda volta, mas como recusa.
   */
  function transacao(origemId, ipDest, l4, aceitar = () => true) {
    const ida = enviar(origemId, ipDest, l4);
    aprender(ida.aprendizado);
    if (ida.status !== 'entregue') return { ...ida, volta: null };
    const aceito = aceitar(ida.destino);
    const l4volta = typeof aceito === 'object' ? aceito : respostaDe(l4, aceito !== false);
    let de = ida.destino.d, alvo = ida.origemVista ?? ipDeOrigem(t, origemId), ttl = null, volta;
    const etapas = [...(ida.traducoes ?? [])].reverse();
    for (let i = 0; i <= etapas.length; i++) {
      volta = enviar(de, alvo, l4volta);
      aprender(volta.aprendizado);
      const esperado = etapas[i];
      if (volta.status !== 'entregue' || (esperado && volta.destino.d !== esperado.d)) return { status: 'timeout', saltos: ida.saltos, caminho: ida.caminho, ida, volta };
      // TTL contínuo: o que sobrou da perna anterior, menos 1 do roteador que traduziu e menos os saltos desta perna
      ttl = ttl === null ? volta.ttl : ttl - 1 - (TTL_INICIAL.roteador - volta.ttl);
      if (esperado) { de = esperado.d; alvo = esperado.de; }
    }
    return { status: aceito === false ? 'recusada' : 'entregue', ttl, de: ipDest, saltos: ida.saltos, caminho: ida.caminho, destino: ida.destino, traducoes: ida.traducoes, ida, volta };
  }

  // IPv6: o mesmo esquema de ida e volta, com descoberta de vizinhos no lugar do ARP (sem NAT nem filtros em IPv6)
  const chave6 = ip => `v6:${ip}`;
  const ctx6 = { registrar: ctx.registrar, conhece: (d, ip) => arp.get(d)?.has(chave6(ip)) ?? false, aprender: (d, ip, mac) => aprenderUm(d, chave6(ip), mac) };
  const aprender6 = lista => { for (const a of lista ?? []) if (a.mac) aprenderUm(a.d, chave6(a.ip), a.mac); };
  const enviar6 = (de, ip, l4, origem = null) => enviarPacote6(t, de, ip, l4, gravando ? ctx6 : null, origem);
  function ping6(origemId, dest) {
    const ida = enviar6(origemId, dest, { tipo: 'echo-request' });
    aprender6(ida.aprendizado);
    if (ida.status !== 'entregue') return { ...ida, volta: null };
    const volta = enviar6(ida.destino.d, ida.origem, { tipo: 'echo-reply' }, dest);
    aprender6(volta.aprendizado);
    if (volta.status !== 'entregue') return { status: 'timeout', saltos: ida.saltos, caminho: ida.caminho, ida, volta };
    return { status: 'entregue', ttl: volta.ttl, de: dest, saltos: ida.saltos, caminho: ida.caminho, destino: ida.destino, ida, volta };
  }

  const sim = {
    topologia: t, concessoes, slaac, wifi,
    ping6,
    rastrear6: (origemId, dest) => { const r = enviar6(origemId, dest, { tipo: 'echo-request' }); aprender6(r.aprendizado); return r; },
    vizinhos6: id => [...(arp.get(id) ?? [])].filter(([k]) => typeof k === 'string' && k.startsWith('v6:')).map(([k, mac]) => ({ ip: BigInt(k.slice(3)), mac })),
    ping: (origemId, ipDest) => transacao(origemId, ipDest, ICMP_PEDIDO),
    /**
     * Conexão TCP (simplificada: o SYN vai, volta SYN-ACK se a porta está aberta ou RST se está fechada). Serviços abertos
     * ficam em servicos (lista de portas) do computador; roteadores não oferecem serviços.
     * status: 'entregue' (conectou), 'recusada' (porta fechada) ou os mesmos erros do ping.
     */
    conectar(origemId, ipDest, porta) {
      return transacao(origemId, ipDest, { proto: 'tcp', portaOrigem: PORTA_CLIENTE, portaDestino: porta, flags: 'SYN' },
        dest => servicosDe(dispositivo(t, dest.d)).includes(porta));
    },
    /**
     * DNS (simplificado): consulta UDP 53 ao servidor configurado (um computador com registros). Devolve
     * { ok:true, ip, servidor:{ d, ip } } ou { ok:false, motivo }: 'sem-dns' | 'dns-inalcancavel' | 'dns-sem-servico' | 'nome-inexistente'.
     */
    resolver(origemId, nome) {
      const o = dispositivo(t, origemId);
      const dnsN = lerIPv4(o?.dns);
      if (!o || o.tipo !== 'pc' || dnsN === null) return { ok: false, motivo: 'sem-dns' };
      const consulta = String(nome).trim().toLowerCase();
      let achado = null, servico = false;
      const l4 = { proto: 'udp', portaOrigem: PORTA_CLIENTE, portaDestino: 53, dns: { nome: consulta } };
      const r = transacao(origemId, dnsN, l4, dest => {
        const srv = dispositivo(t, dest.d);
        servico = srv.tipo === 'pc' && (srv.registros?.length ?? 0) > 0;
        if (!servico) return false;
        achado = srv.registros.find(x => x.nome === consulta) ?? null;
        return { ...respostaDe(l4), dns: { nome: consulta, ip: achado?.ip ?? null } };
      });
      if (r.status === 'recusada' || (r.status === 'entregue' && !servico)) return { ok: false, motivo: 'dns-sem-servico', servidor: { d: r.destino?.d, ip: dnsN } };
      if (r.status !== 'entregue') return { ok: false, motivo: 'dns-inalcancavel', servidor: { ip: dnsN } };
      const servidor = { d: r.destino.d, ip: dnsN };
      return achado ? { ok: true, ip: lerIPv4(achado.ip), servidor } : { ok: false, motivo: 'nome-inexistente', servidor };
    },
    rastrear: (origemId, ipDest) => { const r = enviar(origemId, ipDest, ICMP_PEDIDO); aprender(r.aprendizado); return r; },
    tabelaArp: id => [...(arp.get(id) ?? [])].filter(([ip]) => typeof ip === 'number').map(([ip, mac]) => ({ ip, mac })).sort((a, b) => a.ip - b.ip),
    /** Executa fn gravando os pacotes (estilo Wireshark): devolve { resultado, pacotes }. Limite de 200 pacotes. */
    capturar(fn) {
      const anterior = gravando;
      gravando = [];
      try { const resultado = fn(); return { resultado, pacotes: gravando.slice(0, 200) }; } finally { gravando = anterior; }
    }
  };
  return sim;
}

/** Portas TCP abertas em um computador (os serviços que ele oferece). */
export const servicosDe = d => (d?.tipo === 'pc' && Array.isArray(d.servicos) ? d.servicos : []);

/** IP de origem dos pacotes de um dispositivo: o do computador, ou o da primeira interface configurada do roteador. */
function ipDeOrigem(t, origemId) {
  const o = dispositivo(t, origemId);
  return o.tipo === 'pc' ? configDaInterface(o, 'eth0').ip : interfacesConfiguradas(o)[0].ip;
}

export { formatarIPv4 };
