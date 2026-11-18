// Terminal simulado (estilo Prompt de Comando do Windows, em português). Puro: recebe texto, devolve linhas.
// Comandos: ipconfig [/all|/renew], ping [-n N] destino, tracert destino, nslookup nome, arp -a, hostname, help, cls.
// Simplificações assumidas: sem latência (sempre "tempo<1ms") e nomes de host resolvidos só entre os dispositivos do laboratório.
import { lerIPv4, formatarIPv4 } from './ipv4.js';
import { configDaInterface, conflitosDeIp, macDe, temLink, interfacesConfiguradas } from './motor.js';
import { dispositivo, rotuloDaPorta } from './topologia.js';

const AJUDA = [
  'Comandos disponíveis:',
  '  ipconfig [/all]     mostra a configuração de IP desta máquina',
  '  ipconfig /renew     pede um endereço ao servidor DHCP (se o DHCP estiver ligado)',
  '  ping [-n N] destino  testa a conexão com um IP ou nome de dispositivo',
  '  tracert destino     mostra os roteadores no caminho até o destino',
  '  nslookup nome       consulta o servidor DNS configurado neste computador',
  '  arp -a              mostra os endereços MAC já descobertos',
  '  hostname            mostra o nome desta máquina',
  '  cls                 limpa a tela',
  '  help                mostra esta lista'
];

const campo = (rotulo, valor) => `   ${rotulo} ${'. '.repeat(Math.max(0, Math.floor((38 - rotulo.length) / 2)))}: ${valor}`;

/** Endereço literal; nome de dispositivo do laboratório (atalho); ou nome DNS consultado no servidor configurado no PC. */
function resolverDestino(t, sim, d, texto) {
  const n = lerIPv4(texto);
  if (n !== null) return { ip: n, nome: null };
  const disp = t.dispositivos.find(x => x.nome.toLowerCase() === texto.toLowerCase());
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

function ipconfig(t, sim, d, tudo) {
  const linhas = ['Configuração de IP do Windows', ''];
  if (tudo) linhas.push(campo('Nome do Host', d.nome), '');
  for (const i of d.interfaces) {
    const rotulo = rotuloDaPorta(d, i.id);
    linhas.push(`Adaptador Ethernet ${rotulo}:`, '');
    if (!temLink(t, d.id, i.id)) { linhas.push(campo('Estado da mídia', 'mídia desconectada'), ''); continue; }
    const conc = d.dhcp ? sim.concessoes?.get(d.id) : null;
    if (tudo) linhas.push(campo('Endereço Físico', macDe(d.id, i.id).toUpperCase()), campo('DHCP Habilitado', d.dhcp ? 'Sim' : 'Não'));
    if (tudo && conc?.ok) linhas.push(campo('Servidor DHCP', formatarIPv4(conc.servidor.ip)));
    if (d.dhcp && conc && !conc.ok) linhas.push(`   ${MOTIVO_DHCP[conc.motivo]}`, '');
    const cfg = configDaInterface(d, i.id);
    linhas.push(campo('Endereço IPv4', cfg ? i.ip : '(não configurado)'));
    linhas.push(campo('Máscara de Sub-rede', cfg ? i.mascara : '(não configurado)'));
    linhas.push(campo('Gateway Padrão', d.gateway || ''));
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
  bloqueado: r => `Resposta de ${formatarIPv4(r.de)}: Comunicação proibida administrativamente (bloqueada por um filtro do roteador).`
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
  if (resto.length !== 1) return ['Uso: ping [-n N] destino'];
  const alvo = resolverDestino(t, sim, d, resto[0]);
  if (!alvo) return [`A solicitação de ping não pôde encontrar o host ${resto[0]}. Verifique o nome e tente novamente.`];
  const ipTxt = formatarIPv4(alvo.ip);
  const linhas = [`Disparando contra ${alvo.nome ? `${alvo.nome} [${ipTxt}]` : ipTxt} com 32 bytes de dados:`];
  let recebidos = 0;
  for (let i = 0; i < quantidade; i++) {
    const r = sim.ping(d.id, alvo.ip);
    if (r.status === 'entregue') { recebidos++; linhas.push(`Resposta de ${ipTxt}: bytes=32 tempo<1ms TTL=${r.ttl}`); }
    else linhas.push((MSG_TENTATIVA[r.status] ?? (() => 'Esgotado o tempo limite do pedido.'))(r));
  }
  const perdidos = quantidade - recebidos;
  linhas.push('', `Estatísticas do Ping para ${ipTxt}:`,
    `    Pacotes: Enviados = ${quantidade}, Recebidos = ${recebidos}, Perdidos = ${perdidos} (${Math.round(perdidos / quantidade * 100)}% de perda)${recebidos ? ',' : ''}`);
  if (recebidos) linhas.push('Tempo aproximado de ida e volta em milissegundos:', '    Mínimo = 0ms, Máximo = 0ms, Média = 0ms');
  return linhas;
}

const salto = (n, ip, extra = '') => `${String(n).padStart(3)}    <1 ms    <1 ms    <1 ms  ${ip}${extra}`;

function tracert(t, sim, d, args) {
  if (args.length !== 1) return ['Uso: tracert destino'];
  const alvo = resolverDestino(t, sim, d, args[0]);
  if (!alvo) return [`Não foi possível resolver o nome do sistema de destino ${args[0]}.`];
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
    case 'arp': return { linhas: arp(t, sim, d, args), limpar: false };
    case 'hostname': return { linhas: [d.nome], limpar: false };
    case 'cls': return { linhas: [], limpar: true };
    case 'help': case 'ajuda': return { linhas: AJUDA, limpar: false };
    default: return { linhas: [`'${partes[0]}' não é reconhecido como um comando interno ou externo, um programa operável ou um arquivo em lote. Digite help para ver os comandos.`], limpar: false };
  }
}

