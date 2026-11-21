// Terminal simulado (estilo Prompt de Comando do Windows, em português). Puro: recebe texto, devolve linhas.
// Comandos: ipconfig [/all|/renew], ping [-n N] [-6] destino (IPv4 ou IPv6), tracert destino, nslookup nome, tnc destino porta, arp -a, hostname, help, cls.
// Simplificações assumidas: sem latência (sempre "tempo<1ms") e nomes de host resolvidos só entre os dispositivos do laboratório.
import { lerIPv4, formatarIPv4 } from './ipv4.js';
import { configDaInterface, conflitosDeIp, macDe, temLink, interfacesConfiguradas, NOMES_PORTAS } from './motor.js';
import { dispositivo, rotuloDaPorta } from './topologia.js';
import { lerIPv6, formatarIPv6 } from './ipv6.js';
import { enderecosDaInterface, primeiroGlobal6, conflitos6 } from './motor6.js';
import { MOTIVO_WIFI } from './wifi.js';
import { SEGURANCAS_WIFI, BANDAS_WIFI } from './topologia.js';

const AJUDA = [
  'Comandos disponíveis:',
  '  ipconfig [/all]     mostra a configuração de IP desta máquina',
  '  ipconfig /renew     pede um endereço ao servidor DHCP (se o DHCP estiver ligado)',
  '  ping [-n N] [-6] destino  testa a conexão com um IP (IPv4 ou IPv6) ou nome de dispositivo',
  '  tracert destino     mostra os roteadores no caminho até o destino',
  '  nslookup nome       consulta o servidor DNS configurado neste computador',
  '  tnc destino porta   testa uma conexão TCP com um serviço (ex.: tnc 192.168.1.60 80)',
  '  arp -a              mostra os endereços MAC já descobertos (IPv4)',
  '  netsh interface ipv6 show neighbors   vizinhos IPv6 descobertos (NDP)',
  '  netsh wlan show networks     redes Wi-Fi visíveis',
  '  netsh wlan show interfaces   estado da conexão Wi-Fi deste computador',
  '  hostname            mostra o nome desta máquina',
  '  cls                 limpa a tela',
  '  help                mostra esta lista'
];

const campo = (rotulo, valor) => `   ${rotulo} ${'. '.repeat(Math.max(0, Math.floor((38 - rotulo.length) / 2)))}: ${valor}`;

/** Endereço literal; nome de dispositivo do laboratório (atalho); ou nome DNS consultado no servidor configurado no PC. */
function resolverDestino(t, sim, d, texto, so6 = false) {
  const n6 = lerIPv6(texto);
  if (n6 !== null) return { ip: n6, nome: null, v6: true };
  const n = lerIPv4(texto);
  if (n !== null) return so6 ? null : { ip: n, nome: null };
  const disp = t.dispositivos.find(x => x.nome.toLowerCase() === texto.toLowerCase());
  const g6 = disp ? primeiroGlobal6(disp) : null;
  if (g6 !== null && (so6 || !interfacesConfiguradas(disp).length)) return { ip: g6, nome: disp.nome, v6: true };
  if (so6) return null;
  const primeiro = disp && interfacesConfiguradas(disp)[0];
  if (primeiro) return { ip: primeiro.ip, nome: disp.nome };
  const r = sim.resolver(d.id, texto);
  return r.ok ? { ip: r.ip, nome: texto.toLowerCase() } : null;
}

const MOTIVO_DNS = {
  'sem-dns': '*** Nenhum servidor DNS está configurado neste computador.',
  'dns-inalcancavel': '*** O servidor DNS configurado não respondeu (sem comunicação com ele).',
  'dns-sem-servico': '*** O computador que tem esse endereço não é um servidor DNS (não responde consultas).'
};

function nslookup(t, sim, d, args) {
  if (args.length !== 1) return ['Uso: nslookup nome'];
  const nome = args[0].toLowerCase();
  const r = sim.resolver(d.id, nome);
  if (r.motivo === 'sem-dns' || r.motivo === 'dns-inalcancavel' || r.motivo === 'dns-sem-servico') {
    return [r.servidor ? `Servidor:  ${formatarIPv4(r.servidor.ip)}` : 'Servidor:  (nenhum)', MOTIVO_DNS[r.motivo], ''];
  }
  const cab = [`Servidor:  ${dispositivo(t, r.servidor.d).nome}`, `Address:  ${formatarIPv4(r.servidor.ip)}`, ''];
  if (!r.ok) return [...cab, `*** O servidor ${dispositivo(t, r.servidor.d).nome} não encontrou ${nome}: Non-existent domain`, ''];
  return [...cab, `Nome:    ${nome}`, `Address:  ${formatarIPv4(r.ip)}`, ''];
}

export const MOTIVO_SLAAC = {
  'sem-link': 'SLAAC: mídia desconectada.',
  'sem-ra': 'SLAAC: nenhum roteador anunciou um prefixo IPv6 (Router Advertisement). O roteador tem IPv6 na interface e "ipv6 unicast-routing"?',
  'prefixo-nao-64': 'SLAAC: o prefixo anunciado não é /64. A autoconfiguração só funciona com /64.'
};

export const MOTIVO_DHCP = {
  'sem-servidor': 'Nenhum servidor DHCP respondeu. O endereço não foi configurado.',
  'pool-esgotado': 'O servidor DHCP não tem mais endereços livres no pool. O endereço não foi configurado.',
  'pool-invalido': 'O pool do servidor DHCP não combina com a rede da interface. O endereço não foi configurado.',
  'sem-link': 'Mídia desconectada.'
};

function renovar(t, sim, d) {
  if (!d.dhcp) return ['Operação falhou: este adaptador não está habilitado para DHCP (está com endereço fixo).'];
  if (!temLink(t, d.id, 'eth0')) return ['Operação falhou: mídia desconectada.'];
  const c = sim.concessoes?.get(d.id);
  if (!c?.ok) return ['Operação falhou: ' + (MOTIVO_DHCP[c?.motivo] ?? 'sem resposta do servidor DHCP.')];
  return ['Concessão DHCP obtida.', '', ...ipconfig(t, sim, d, false).slice(2)];
}

const vizinhosSemFio = (t, d) => t.cabos.some(c => !c.semFio && (c.a.d === d.id || c.b.d === d.id));

function ipconfig(t, sim, d, tudo) {
  const linhas = ['Configuração de IP do Windows', ''];
  if (tudo) linhas.push(campo('Nome do Host', d.nome), '');
  for (const i of d.interfaces) {
    const rotulo = rotuloDaPorta(d, i.id);
    linhas.push(d.wifi && !vizinhosSemFio(t, d) ? `Adaptador de Rede sem Fio Wi-Fi:` : `Adaptador Ethernet ${rotulo}:`, '');
    if (!temLink(t, d.id, i.id)) { linhas.push(campo('Estado da mídia', 'mídia desconectada'), ''); continue; }
    const conc = d.dhcp ? sim.concessoes?.get(d.id) : null;
    if (tudo) linhas.push(campo('Endereço Físico', macDe(d.id, i.id).toUpperCase()), campo('DHCP Habilitado', d.dhcp ? 'Sim' : 'Não'));
    if (tudo && conc?.ok) linhas.push(campo('Servidor DHCP', formatarIPv4(conc.servidor.ip)));
    if (d.dhcp && conc && !conc.ok) linhas.push(`   ${MOTIVO_DHCP[conc.motivo]}`, '');
    const cfg = configDaInterface(d, i.id);
    const ends6 = enderecosDaInterface(d, i.id);
    for (const e of ends6.filter(x => x.tipo === 'global')) linhas.push(campo(d.slaac ? 'Endereço IPv6 (SLAAC)' : 'Endereço IPv6', `${formatarIPv6(e.ip)}/${e.prefixo}`));
    for (const e of ends6.filter(x => x.tipo === 'link-local')) linhas.push(campo('Endereço IPv6 de link local', `${formatarIPv6(e.ip)}%1`));
    if (d.slaac && !ends6.some(x => x.tipo === 'global')) linhas.push(`   ${MOTIVO_SLAAC[sim.slaac?.get(d.id)?.motivo] ?? 'SLAAC: sem endereço.'}`);
    if (ends6.some(x => x.tipo === 'global') && conflitos6(t).some(c => (c.a.d === d.id && c.a.p === i.id) || (c.b.d === d.id && c.b.p === i.id))) linhas.push('   Aviso: endereço IPv6 duplicado na rede (a detecção de duplicados o marcaria como inválido).');
    linhas.push(campo('Endereço IPv4', cfg ? i.ip : '(não configurado)'));
    linhas.push(campo('Máscara de Sub-rede', cfg ? i.mascara : '(não configurado)'));
    linhas.push(campo('Gateway Padrão', [d.gateway6 ? `${d.gateway6}${d.gateway6.startsWith('fe80') ? '%1' : ''}` : '', d.gateway || ''].filter(Boolean).join('\n' + ' '.repeat(42)) || ''));
    if (tudo) linhas.push(campo('Servidores DNS', d.dns || ''));
    if (cfg && conflitosDeIp(t).some(c => (c.a.d === d.id && c.a.p === i.id) || (c.b.d === d.id && c.b.p === i.id))) {
      linhas.push('', '   Aviso: este endereço IPv4 está em conflito com outro dispositivo da rede.');
    }
    linhas.push('');
  }
  return linhas;
}

const MSG_TENTATIVA = {
  'sem-ip': () => 'PING: falha de transmissão. Falha geral.',
  'sem-link': () => 'PING: falha de transmissão. Falha geral.',
  'gateway-fora': () => 'PING: falha de transmissão. Falha geral.',
  'sem-rota': r => `Resposta de ${formatarIPv4(r.de)}: Rede de destino inacessível.`,
  'rede-inalcancavel': r => `Resposta de ${formatarIPv4(r.de)}: Rede de destino inacessível.`,
  'arp-falhou': r => `Resposta de ${formatarIPv4(r.de)}: Host de destino inacessível.`,
  'host-inalcancavel': r => `Resposta de ${formatarIPv4(r.de)}: Host de destino inacessível.`,
  'ttl-expirado': r => `Resposta de ${formatarIPv4(r.de)}: Tempo de vida (TTL) expirado em trânsito.`,
  bloqueado: r => `Resposta de ${formatarIPv4(r.de)}: Comunicação proibida administrativamente (${r.por === 'nat' ? 'o NAT do roteador não deixa entrar tráfego pelo lado de fora' : 'bloqueada por um filtro do roteador'}).`
};

function ping(t, sim, d, args) {
  let quantidade = 4;
  const resto = [...args];
  const iN = resto.indexOf('-n');
  if (iN !== -1) {
    const v = Number(resto[iN + 1]);
    if (!Number.isInteger(v) || v < 1 || v > 10) return ['Valor incorreto para a opção -n (use de 1 a 10).'];
    quantidade = v; resto.splice(iN, 2);
  }
  const i6 = resto.indexOf('-6');
  if (i6 !== -1) resto.splice(i6, 1);
  if (resto.length !== 1) return ['Uso: ping [-n N] [-6] destino'];
  const alvo = resolverDestino(t, sim, d, resto[0], i6 !== -1);
  if (!alvo) return [`A solicitação de ping não pôde encontrar o host ${resto[0]}. Verifique o nome e tente novamente.`];
  const ipTxt = alvo.v6 ? formatarIPv6(alvo.ip) : formatarIPv4(alvo.ip);
  const linhas = [`Disparando contra ${alvo.nome ? `${alvo.nome} [${ipTxt}]` : ipTxt} com 32 bytes de dados:`];
  let recebidos = 0;
  for (let i = 0; i < quantidade; i++) {
    const r = alvo.v6 ? sim.ping6(d.id, alvo.ip) : sim.ping(d.id, alvo.ip);
    if (r.status === 'entregue') { recebidos++; linhas.push(alvo.v6 ? `Resposta de ${ipTxt}: tempo<1ms` : `Resposta de ${ipTxt}: bytes=32 tempo<1ms TTL=${r.ttl}`); }
    else linhas.push(alvo.v6 ? msg6(r) : (MSG_TENTATIVA[r.status] ?? (() => 'Esgotado o tempo limite do pedido.'))(r));
  }
  const perdidos = quantidade - recebidos;
  linhas.push('', `Estatísticas do Ping para ${ipTxt}:`,
    `    Pacotes: Enviados = ${quantidade}, Recebidos = ${recebidos}, Perdidos = ${perdidos} (${Math.round(perdidos / quantidade * 100)}% de perda)${recebidos ? ',' : ''}`);
  if (recebidos) linhas.push('Tempo aproximado de ida e volta em milissegundos:', '    Mínimo = 0ms, Máximo = 0ms, Média = 0ms');
  return linhas;
}

/** Mensagens do ping IPv6 (no Windows a resposta IPv6 não mostra TTL). */
function msg6(r) {
  const de = r.de !== undefined ? formatarIPv6(r.de) : '';
  switch (r.status) {
    case 'sem-ip': case 'sem-link': case 'gateway-fora': return 'PING: falha de transmissão. Falha geral.';
    case 'sem-rota': case 'rede-inalcancavel': return `Resposta de ${de}: Rede de destino inacessível.`;
    case 'arp-falhou': case 'host-inalcancavel': return `Resposta de ${de}: Host de destino inacessível (ninguém respondeu à Neighbor Solicitation).`;
    case 'ttl-expirado': return `Resposta de ${de}: Hop limit expirado em trânsito.`;
    case 'conflito-ip': return 'Esgotado o tempo limite do pedido. (endereço IPv6 duplicado na rede)';
    default: return 'Esgotado o tempo limite do pedido.';
  }
}

const salto = (n, ip, extra = '') => `${String(n).padStart(3)}    <1 ms    <1 ms    <1 ms  ${ip}${extra}`;

function tracert(t, sim, d, args) {
  const so6 = args.includes('-6'), resto = args.filter(a => a !== '-6');
  if (resto.length !== 1) return ['Uso: tracert [-6] destino'];
  const alvo = resolverDestino(t, sim, d, resto[0], so6);
  if (!alvo) return [`Não foi possível resolver o nome do sistema de destino ${resto[0]}.`];
  if (alvo.v6) return tracert6(sim, d, alvo);
  const ipTxt = formatarIPv4(alvo.ip);
  const r = sim.rastrear(d.id, alvo.ip);
  const linhas = [`Rastreando a rota para ${alvo.nome ? `${alvo.nome} [${ipTxt}]` : ipTxt}`, 'com no máximo 30 saltos:', ''];
  let n = 0;
  for (const s of r.saltos) linhas.push(salto(++n, formatarIPv4(s.ip)));
  switch (r.status) {
    case 'entregue': if (r.destino.d !== d.id) linhas.push(salto(++n, ipTxt)); linhas.push('', 'Rastreamento concluído.'); break;
    case 'sem-ip': case 'sem-link': case 'gateway-fora': linhas.push('Falha geral.'); break;
    case 'sem-rota': linhas.push(`${String(++n).padStart(3)}  ${formatarIPv4(r.de)}  relata: Rede de destino inacessível.`, '', 'Rastreamento concluído.'); break;
    case 'rede-inalcancavel': linhas.push(`${String(++n).padStart(3)}  ${formatarIPv4(r.de)}  relata: Rede de destino inacessível.`, '', 'Rastreamento concluído.'); break;
    case 'bloqueado': linhas.push(`${String(++n).padStart(3)}  ${formatarIPv4(r.de)}  relata: Comunicação proibida administrativamente.`, '', 'Rastreamento concluído.'); break;
    case 'arp-falhou': case 'host-inalcancavel': linhas.push(`${String(++n).padStart(3)}  ${formatarIPv4(r.de)}  relata: Host de destino inacessível.`, '', 'Rastreamento concluído.'); break;
    default: linhas.push(`${String(++n).padStart(3)}     *        *        *     Esgotado o tempo limite do pedido.`, '', 'Rastreamento concluído.');
  }
  return linhas;
}

function tracert6(sim, d, alvo) {
  const ipTxt = formatarIPv6(alvo.ip);
  const r = sim.rastrear6(d.id, alvo.ip);
  const linhas = [`Rastreando a rota para ${alvo.nome ? `${alvo.nome} [${ipTxt}]` : ipTxt}`, 'com no máximo 30 saltos:', ''];
  let n = 0;
  for (const s of r.saltos) linhas.push(salto(++n, formatarIPv6(s.ip)));
  if (r.status === 'entregue') { if (r.destino.d !== d.id) linhas.push(salto(++n, ipTxt)); }
  else if (['sem-ip', 'sem-link', 'gateway-fora'].includes(r.status)) return [...linhas, 'Falha geral.'];
  else if (r.de !== undefined && r.status !== 'sem-roteamento6' && r.status !== 'conflito-ip') linhas.push(`${String(++n).padStart(3)}  ${formatarIPv6(r.de)}  relata: ${r.status === 'arp-falhou' || r.status === 'host-inalcancavel' ? 'Host' : 'Rede'} de destino inacessível.`);
  else linhas.push(`${String(++n).padStart(3)}     *        *        *     Esgotado o tempo limite do pedido.`);
  return [...linhas, '', 'Rastreamento concluído.'];
}

/** Redes visíveis: SSIDs ocultos não aparecem; um adaptador só de 2,4 GHz não vê redes só de 5 GHz. */
function redesWifi(t, d) {
  const aps = t.dispositivos.filter(a => a.tipo === 'ap' && a.wifi && !a.wifi.oculto && !(d.wifi?.so24 && a.wifi.banda === '5'));
  if (!aps.length) return ['Nenhuma rede sem fio visível.', ...(t.dispositivos.some(a => a.tipo === 'ap' && a.wifi?.oculto) ? ['(Redes com SSID oculto não aparecem na lista, mas aceitam quem digita o nome exato.)'] : [])];
  const l = [`Há ${aps.length} ${aps.length === 1 ? 'rede visível' : 'redes visíveis'}.`, ''];
  aps.forEach((a, i) => l.push(`SSID ${i + 1} : ${a.wifi.ssid}`, `    Autenticação           : ${a.wifi.seguranca === 'aberta' ? 'Aberta (sem criptografia!)' : SEGURANCAS_WIFI[a.wifi.seguranca]}`,
    `    Banda                  : ${BANDAS_WIFI[a.wifi.banda]}`, ''));
  return l;
}

function interfaceWifi(t, sim, d) {
  if (!d.wifi) return ['Wi-Fi não configurado neste computador (ele usa cabo).'];
  const a = sim.wifi?.get(d.id);
  const l = ['Nome                   : Wi-Fi', `Tipo de adaptador      : ${d.wifi.so24 ? 'antigo (só 2,4 GHz)' : '2,4 e 5 GHz'}`];
  if (!a?.ok) return [...l, 'Estado                 : desconectado', `SSID configurado       : ${d.wifi.ssid}`, `Motivo                 : ${MOTIVO_WIFI[a?.motivo] ?? 'sem rede'}`];
  const ap = t.dispositivos.find(x => x.id === a.ap);
  return [...l, 'Estado                 : conectado', `SSID                   : ${ap.wifi.ssid}`, `Ponto de acesso        : ${ap.nome}`,
    `Autenticação           : ${ap.wifi.seguranca === 'aberta' ? 'Aberta (sem criptografia!)' : SEGURANCAS_WIFI[ap.wifi.seguranca]}`, `Banda                  : ${a.banda}`];
}

function vizinhos6(sim, d) {
  const lista = sim.vizinhos6(d.id);
  if (!lista.length) return ['Nenhum vizinho IPv6 descoberto ainda. Faça um ping IPv6 primeiro.'];
  return ['Interface: Ethernet0', '', 'Endereço de Internet                       Endereço Físico     Tipo',
    ...lista.map(v => `${formatarIPv6(v.ip).padEnd(43)}${v.mac.padEnd(20)}Alcançável`)];
}

const FALHA_TCP = {
  recusada: 'a porta está fechada: o computador respondeu com RST (nenhum serviço escutando nela)',
  timeout: 'o pedido chegou, mas a resposta não voltou',
  bloqueado: 'um roteador bloqueou a conexão (filtro de pacotes ou NAT)',
  'sem-ip': 'este computador não tem IP', 'sem-link': 'este computador está sem cabo', 'gateway-fora': 'o gateway está fora da sub-rede',
  'sem-rota': 'não há gateway para chegar a outra rede', 'arp-falhou': 'ninguém respondeu na rede local',
  'rede-inalcancavel': 'um roteador não conhece a rede de destino', 'host-inalcancavel': 'o roteador não encontrou o destino',
  'conflito-ip': 'há IP duplicado no caminho', 'ttl-expirado': 'o pacote expirou no caminho'
};

/** Teste de conexão TCP, no formato do Test-NetConnection (tnc) do Windows PowerShell. */
function tnc(t, sim, d, args) {
  if (args.length !== 2) return ['Uso: tnc destino porta   (ex.: tnc 192.168.1.60 80)'];
  const porta = Number(args[1]);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) return ['Porta inválida. Use um número de 1 a 65535.'];
  const dest = resolverDestino(t, sim, d, args[0]);
  if (!dest) return [`AVISO: não foi possível resolver o nome ${args[0]}.`];
  const r = sim.conectar(d.id, dest.ip, porta);
  const ok = r.status === 'entregue';
  const linhas = [];
  if (!ok) linhas.push(`AVISO: a conexão TCP com ${formatarIPv4(dest.ip)}:${porta} falhou: ${FALHA_TCP[r.status] ?? 'sem resposta (' + r.status + ')'}.`, '');
  return [...linhas, `ComputerName     : ${dest.nome ?? formatarIPv4(dest.ip)}`, `RemoteAddress    : ${formatarIPv4(dest.ip)}`,
    `RemotePort       : ${porta}${NOMES_PORTAS[porta] ? ' (' + NOMES_PORTAS[porta] + ')' : ''}`, `SourceAddress    : ${interfacesConfiguradas(d)[0] ? formatarIPv4(interfacesConfiguradas(d)[0].ip) : '(sem IP)'}`,
    `TcpTestSucceeded : ${ok ? 'True' : 'False'}`, ''];
}

function arp(t, sim, d, args) {
  if (args.length !== 1 || args[0] !== '-a') return ['Uso: arp -a'];
  const tabela = sim.tabelaArp(d.id);
  if (!tabela.length) return ['Nenhuma entrada ARP encontrada.'];
  const minhaCfg = interfacesConfiguradas(d)[0];
  return [`Interface: ${minhaCfg ? formatarIPv4(minhaCfg.ip) : '(sem IP)'} --- 0x1`, '  Endereço IP           Endereço Físico       Tipo',
    ...tabela.map(e => `  ${formatarIPv4(e.ip).padEnd(21)} ${e.mac.padEnd(21)} dinâmico`)];
}

/**
 * Executa uma linha de comando no dispositivo. Devolve { linhas, limpar }.
 * Só computadores têm terminal.
 */
export function executar(sim, dispositivoId, linhaDigitada) {
  const t = sim.topologia;
  const d = dispositivo(t, dispositivoId);
  if (!d || d.tipo !== 'pc') return { linhas: ['Este dispositivo não tem terminal.'], limpar: false };
  const partes = String(linhaDigitada ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return { linhas: [], limpar: false };
  const cmd = partes[0].toLowerCase(), args = partes.slice(1).map(a => a.toLowerCase() === '/all' ? '/all' : a);
  switch (cmd) {
    case 'ipconfig': return { linhas: args[0]?.toLowerCase() === '/renew' && args.length === 1 ? renovar(t, sim, d) : args.length && args[0] !== '/all' ? ['Opção inválida. Use: ipconfig [/all | /renew]'] : ipconfig(t, sim, d, args[0] === '/all'), limpar: false };
    case 'ping': return { linhas: ping(t, sim, d, args), limpar: false };
    case 'tracert': return { linhas: tracert(t, sim, d, args), limpar: false };
    case 'nslookup': return { linhas: nslookup(t, sim, d, args), limpar: false };
    case 'tnc': case 'test-netconnection': return { linhas: tnc(t, sim, d, args.filter(a => a.toLowerCase() !== '-port')), limpar: false };
    case 'arp': return { linhas: arp(t, sim, d, args), limpar: false };
    case 'netsh': {
      const sub = args.map(a => a.toLowerCase()).join(' ');
      if (sub === 'interface ipv6 show neighbors') return { linhas: vizinhos6(sim, d), limpar: false };
      if (sub === 'wlan show networks') return { linhas: redesWifi(t, d), limpar: false };
      if (sub === 'wlan show interfaces') return { linhas: interfaceWifi(t, sim, d), limpar: false };
      return { linhas: ['Uso: netsh interface ipv6 show neighbors | netsh wlan show networks | netsh wlan show interfaces'], limpar: false };
    }
    case 'hostname': return { linhas: [d.nome], limpar: false };
    case 'cls': return { linhas: [], limpar: true };
    case 'help': case 'ajuda': return { linhas: AJUDA, limpar: false };
    default: return { linhas: [`'${partes[0]}' não é reconhecido como um comando interno ou externo, um programa operável ou um arquivo em lote. Digite help para ver os comandos.`], limpar: false };
  }
}

