// Console estilo Cisco IOS para roteadores e switches (simplificado). Puro: recebe a topologia, a simulação e uma linha;
// devolve as linhas de saída, a sessão (modo atual) e, se algo mudou, a nova topologia.
// Modos: usuário (R1>), privilegiado (R1#), configuração global (R1(config)#) e de interface (R1(config-if)#).
// Aceita abreviações como no IOS (conf t, sh ip int br, int g0/0). Não simula: senhas (enable secret), shutdown,
// VLANs nomeadas, protocolos de roteamento, salvar na NVRAM (write/copy run start apenas confirmam).
import { lerIPv4, lerMascara, formatarIPv4, prefixoDeMascara, enderecoDeRede } from './ipv4.js';
import { TIPOS, dispositivo, renomear, configurarInterface, adicionarRotaEstatica, removerRotaEstatica, configurarPortaSwitch,
  configDaPortaSwitch } from './topologia.js';
import { configDaInterface, temLink } from './motor.js';

export const sessaoInicial = () => ({ modo: 'usuario', interface: null });

const NOME_LONGO = { gi: 'GigabitEthernet', fa: 'FastEthernet' };
const nomeLongo = (d, p) => { const r = TIPOS[d.tipo].portas.find(x => x.id === p).rotulo; return NOME_LONGO[r.slice(0, 2).toLowerCase()] + r.slice(2); };

/** "g0/0", "gi0/0", "GigabitEthernet0/0", "f0/3", "fa0/3" → id da porta do dispositivo, ou null. */
export function lerInterface(d, texto) {
  const m = String(texto ?? '').toLowerCase().match(/^([a-z]+)\s*(\d+\/\d+)$/);
  if (!m) return null;
  const porta = TIPOS[d.tipo].portas.find(p => {
    const [pre, num] = [p.rotulo.slice(0, 2).toLowerCase(), p.rotulo.slice(2)];
    return num === m[2] && (pre.startsWith(m[1]) || NOME_LONGO[pre].toLowerCase().startsWith(m[1]));
  });
  return porta?.id ?? null;
}

export function prompt(d, sessao) {
  return { usuario: `${d.nome}>`, priv: `${d.nome}#`, config: `${d.nome}(config)#`, if: `${d.nome}(config-if)#` }[sessao.modo];
}

// Palavra digitada casa com a palavra-chave se for um prefixo dela (abreviação), com tamanho mínimo.
const casa = (dig, chave, min = 2) => dig && dig.length >= Math.min(min, chave.length) && chave.startsWith(dig.toLowerCase());
const INVALIDO = ['% Invalid input detected.', "Digite ? para ver os comandos deste modo."];
const INCOMPLETO = ['% Incomplete command.'];

const AJUDA = {
  usuario: ['enable                 entra no modo privilegiado', 'ping ip                testa a conexão', 'show ip interface brief', 'show ip route', 'exit'],
  priv: ['configure terminal     entra no modo de configuração', 'show ip interface brief', 'show ip route', 'show running-config', 'show vlan brief (switch)',
    'ping ip', 'copy running-config startup-config', 'disable                volta ao modo usuário', 'exit'],
  config: ['hostname NOME', 'interface NOME          ex.: interface g0/0 (roteador) ou interface f0/1 (switch)', 'ip route REDE MÁSCARA PRÓXIMO-SALTO',
    'no ip route REDE MÁSCARA PRÓXIMO-SALTO', 'end / exit'],
  if: ['ip address IP MÁSCARA  (roteador)', 'no ip address          (roteador)', 'switchport mode access|trunk (switch)', 'switchport access vlan N (switch)',
    'no shutdown', 'end / exit']
};

export function executarIos(t, sim, id, linhaDigitada, sessao = sessaoInicial()) {
  const d = dispositivo(t, id);
  if (!d || (d.tipo !== 'roteador' && d.tipo !== 'switch')) return { linhas: ['Este dispositivo não tem console IOS.'], sessao };
  const linha = String(linhaDigitada ?? '').trim();
  const w = linha.split(/\s+/).filter(Boolean);
  const res = (linhas, novaSessao = sessao, topologia = null) => ({ linhas, sessao: novaSessao, topologia });
  const mudar = (r, ok = []) => (r.erro ? res([`% ${r.erro}`]) : res(ok, sessao, r.topologia));
  if (!w.length) return res([]);
  if (w[0] === '?' || casa(w[0], 'help', 4)) return res(AJUDA[sessao.modo]);

  // comandos que valem em qualquer modo
  if (casa(w[0], 'end', 3) && (sessao.modo === 'config' || sessao.modo === 'if')) return res([], { modo: 'priv', interface: null });
  if (casa(w[0], 'exit', 3)) {
    const volta = { usuario: null, priv: 'usuario', config: 'priv', if: 'config' }[sessao.modo];
    return volta ? res([], { modo: volta, interface: null }) : res(['Sessão encerrada. Pressione Enter para começar de novo.'], sessaoInicial());
  }
  // "do" executa comandos do modo privilegiado dentro da configuração, como no IOS
  if ((sessao.modo === 'config' || sessao.modo === 'if') && w[0].toLowerCase() === 'do') {
    return { ...executarIos(t, sim, id, w.slice(1).join(' '), { modo: 'priv', interface: null }), sessao };
  }

  if (sessao.modo === 'usuario' || sessao.modo === 'priv') {
    if (sessao.modo === 'usuario' && casa(w[0], 'enable', 2)) return res([], { modo: 'priv', interface: null });
    if (sessao.modo === 'priv' && casa(w[0], 'disable', 4)) return res([], { modo: 'usuario', interface: null });
    if (sessao.modo === 'priv' && casa(w[0], 'configure', 4)) {
      if (!w[1] || !casa(w[1], 'terminal', 1)) return res(INCOMPLETO);
      return res(['Digite os comandos de configuração, um por linha. Termine com end.'], { modo: 'config', interface: null });
    }
    if (casa(w[0], 'ping', 2)) return res(pingIos(t, sim, d, w[1]));
    if (casa(w[0], 'show', 2)) return res(show(t, d, w.slice(1), sessao.modo));
    if (sessao.modo === 'priv' && (casa(w[0], 'copy', 2) || casa(w[0], 'write', 2))) return res(['Building configuration...', '[OK]', '(No simulador a configuração já fica salva sozinha neste navegador.)']);
    return res(INVALIDO);
  }

  if (sessao.modo === 'config') {
    if (casa(w[0], 'hostname', 3)) return w[1] ? mudar(renomear(t, id, w[1])) : res(INCOMPLETO);
    if (casa(w[0], 'interface', 3)) {
      const nome = w.slice(1).join('');
      if (!nome) return res(INCOMPLETO);
      const p = lerInterface(d, nome);
      if (!p) return res([`% Interface inexistente neste ${d.tipo === 'roteador' ? 'roteador' : 'switch'}. Existem: ${TIPOS[d.tipo].portas.map(x => x.rotulo).join(', ')}.`]);
      return res([], { modo: 'if', interface: p });
    }
    const nao = w[0].toLowerCase() === 'no', v = nao ? w.slice(1) : w;
    if (casa(v[0], 'ip', 2) && casa(v[1], 'route', 2)) {
      if (d.tipo !== 'roteador') return res(INVALIDO);
      if (v.length < 5) return res(INCOMPLETO);
      const [rede, mascara, via] = v.slice(2, 5);
      if (!nao) return mudar(adicionarRotaEstatica(t, id, { rede, mascara, via }));
      const rN = lerIPv4(rede), mN = lerMascara(mascara), vN = lerIPv4(via);
      const i = (d.rotas ?? []).findIndex(r => lerIPv4(r.rede) === rN && lerMascara(r.mascara) === mN && lerIPv4(r.via) === vN);
      return i === -1 ? res(['% Rota não encontrada.']) : mudar(removerRotaEstatica(t, id, i));
    }
    return res(INVALIDO);
  }

  // modo de interface
  const p = sessao.interface, nao = w[0].toLowerCase() === 'no', v = nao ? w.slice(1) : w;
  if (casa(v[0], 'shutdown', 2)) return res(nao ? [`%LINK-5-CHANGED: Interface ${nomeLongo(d, p)}, changed state to ${temLink(t, id, p) ? 'up' : 'down (sem cabo)'}`]
    : ['% O simulador não desliga interfaces: tire o cabo no desenho para simular uma interface sem link.']);
  if (casa(v[0], 'ip', 2) && casa(v[1], 'address', 2)) {
    if (d.tipo !== 'roteador') return res(['% Nesta simulação o switch não tem IP (só as portas de camada 2).']);
    if (nao) return mudar(configurarInterface(t, id, p, { ip: '', mascara: '' }));
    if (v.length < 4) return res(INCOMPLETO);
    return mudar(configurarInterface(t, id, p, { ip: v[2], mascara: v[3] }));
  }
  if (casa(v[0], 'switchport', 2)) {
    if (d.tipo !== 'switch') return res(INVALIDO);
    const atual = configDaPortaSwitch(d, p);
    if (casa(v[1], 'mode', 2) && v[2]) {
      const modo = casa(v[2], 'access', 1) ? 'access' : casa(v[2], 'trunk', 1) ? 'trunk' : null;
      return modo ? mudar(configurarPortaSwitch(t, id, p, { modo, vlan: atual.modo === 'access' ? atual.vlan : 1 })) : res(INVALIDO);
    }
    if (casa(v[1], 'access', 2) && casa(v[2], 'vlan', 1) && v[3]) return mudar(configurarPortaSwitch(t, id, p, { modo: 'access', vlan: v[3] }));
    return res(INCOMPLETO);
  }
  if (casa(v[0], 'description', 3)) return res([]);
  // como no IOS, um comando de configuração global digitado dentro da interface é aceito (e sai da interface)
  const global = executarIos(t, sim, id, linha, { modo: 'config', interface: null });
  return global.linhas[0] === INVALIDO[0] ? res(INVALIDO) : global;
}

function pingIos(t, sim, d, alvo) {
  if (!alvo) return INCOMPLETO;
  const ip = lerIPv4(alvo);
  if (ip === null) return ['% Endereço inválido (o console aceita só IP).'];
  const sucessos = Array.from({ length: 5 }, () => sim.ping(d.id, ip).status === 'entregue');
  const n = sucessos.filter(Boolean).length;
  return ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${formatarIPv4(ip)}, timeout is 2 seconds:`, sucessos.map(x => (x ? '!' : '.')).join(''),
    `Success rate is ${n * 20} percent (${n}/5)${n ? ', round-trip min/avg/max = 1/1/1 ms' : ''}`];
}

function show(t, d, args, modo) {
  const a = args.map(x => x.toLowerCase());
  if (casa(a[0], 'ip', 2) && casa(a[1], 'interface', 3) && casa(a[2], 'brief', 2)) return ipIntBrief(t, d);
  if (casa(a[0], 'ip', 2) && casa(a[1], 'route', 2)) return ipRoute(t, d);
  if (casa(a[0], 'running-config', 3)) return modo === 'priv' ? runningConfig(t, d) : ['% Comando disponível só no modo privilegiado (use enable).'];
  if (casa(a[0], 'vlan', 2)) return d.tipo === 'switch' ? vlanBrief(t, d) : INVALIDO;
  return INVALIDO;
}

function ipIntBrief(t, d) {
  const linhas = ['Interface              IP-Address      OK? Method Status                Protocol'];
  for (const p of TIPOS[d.tipo].portas) {
    const cfg = d.tipo === 'roteador' ? configDaInterface(d, p.id) : null, up = temLink(t, d.id, p.id) ? 'up' : 'down';
    linhas.push(`${nomeLongo(d, p.id).padEnd(23)}${(cfg ? formatarIPv4(cfg.ip) : 'unassigned').padEnd(16)}${cfg ? 'YES manual' : 'YES unset '} ${up.padEnd(22)}${up}`);
  }
  return linhas;
}

function ipRoute(t, d) {
  if (d.tipo !== 'roteador') return ['% O switch desta simulação não roteia (só camada 2).'];
  const padrao = (d.rotas ?? []).find(r => r.rede === '0.0.0.0' && r.mascara === '0.0.0.0');
  const linhas = ['Codes: L - local, C - connected, S - static, * - candidate default', '', `Gateway of last resort is ${padrao ? `${padrao.via} to network 0.0.0.0` : 'not set'}`, ''];
  for (const i of d.interfaces) {
    const cfg = configDaInterface(d, i.id);
    if (!cfg || !temLink(t, d.id, i.id)) continue;
    const pre = prefixoDeMascara(cfg.mascara);
    linhas.push(`C        ${formatarIPv4(enderecoDeRede(cfg.ip, cfg.mascara))}/${pre} is directly connected, ${nomeLongo(d, i.id)}`,
      `L        ${formatarIPv4(cfg.ip)}/32 is directly connected, ${nomeLongo(d, i.id)}`);
  }
  for (const r of d.rotas ?? []) linhas.push(`S${r.rede === '0.0.0.0' && r.mascara === '0.0.0.0' ? '*' : ' '}       ${r.rede}/${prefixoDeMascara(lerMascara(r.mascara))} [1/0] via ${r.via}`);
  return linhas;
}

function runningConfig(t, d) {
  const l = ['Building configuration...', '', '!', `hostname ${d.nome}`, '!'];
  for (const p of TIPOS[d.tipo].portas) {
    l.push(`interface ${nomeLongo(d, p.id)}`);
    if (d.tipo === 'roteador') {
      const i = d.interfaces.find(x => x.id === p.id), cfg = configDaInterface(d, p.id);
      l.push(cfg ? ` ip address ${i.ip} ${formatarIPv4(cfg.mascara)}` : ' no ip address');
      if (d.nat?.dentro === p.id) l.push(' ip nat inside');
      if (d.nat?.fora === p.id) l.push(' ip nat outside');
    } else {
      const c = configDaPortaSwitch(d, p.id);
      l.push(c.modo === 'trunk' ? ' switchport mode trunk' : ` switchport access vlan ${c.vlan}`, ...(c.modo === 'trunk' ? [] : [' switchport mode access']));
    }
    l.push('!');
  }
  for (const r of d.rotas ?? []) l.push(`ip route ${r.rede} ${r.mascara} ${r.via}`);
  if ((d.filtros ?? []).length || (d.pools ?? []).length) l.push('! (filtros e pools DHCP: configure pelo painel do roteador)');
  l.push('!', 'end');
  return l;
}

function vlanBrief(t, d) {
  const porVlan = new Map();
  for (const p of TIPOS.switch.portas) { const c = configDaPortaSwitch(d, p.id); if (c.modo === 'access') porVlan.set(c.vlan, [...(porVlan.get(c.vlan) ?? []), p.rotulo]); }
  if (!porVlan.has(1)) porVlan.set(1, []);
  return ['VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------',
    ...[...porVlan].sort((a, b) => a[0] - b[0]).map(([v, ps]) => `${String(v).padEnd(5)}${(v === 1 ? 'default' : `VLAN${String(v).padStart(4, '0')}`).padEnd(33)}active    ${ps.join(', ')}`)];
}
