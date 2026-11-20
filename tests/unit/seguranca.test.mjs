// Trilha de segurança no motor: captura de pacotes, conexões TCP com serviços, filtro por protocolo e porta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao, filtroNega, macDe } from '../../js/sim/motor.js';
import { executar } from '../../js/sim/terminal.js';
import { lerIPv4 } from '../../js/sim/ipv4.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, adicionarFiltro, configurarServicos, configurarDnsPc, adicionarRegistroDns, normalizarTopologia, MAX_SERVICOS } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
const ip = lerIPv4;
// pc1 (192.168.1.10) - sw1 - r1 [gi0 .1 | gi1 192.168.2.1] - pc2 servidor (192.168.2.10) com SSH, Telnet, HTTP e DNS
function base() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch', 'roteador']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'sw1', 'eth0', 'fa1')); t = ok(conectar(t, 'sw1', 'r1', 'fa2', 'gi0')); t = ok(conectar(t, 'r1', 'pc2', 'gi1', 'eth0'));
  const i = (id, p, x) => { t = ok(configurarInterface(t, id, p, { ip: x, mascara: '/24' })); };
  i('pc1', 'eth0', '192.168.1.10'); i('r1', 'gi0', '192.168.1.1'); i('r1', 'gi1', '192.168.2.1'); i('pc2', 'eth0', '192.168.2.10');
  t = ok(configurarGateway(t, 'pc1', '192.168.1.1')); t = ok(configurarGateway(t, 'pc2', '192.168.2.1'));
  t = ok(configurarServicos(t, 'pc2', [80, 22, 23]));
  t = ok(adicionarRegistroDns(t, 'pc2', { nome: 'srv.local', ip: '192.168.2.10' }));
  t = ok(configurarDnsPc(t, 'pc1', '192.168.2.10'));
  return t;
}
const filtro = (t, regra) => ok(adicionarFiltro(t, 'r1', { origem: '', origemM: '', destino: '', destinoM: '', ...regra }));

test('captura do ping: ARP em broadcast só na primeira vez, ICMP salto a salto com MACs trocando e IPs iguais', () => {
  const sim = criarSimulacao(base());
  const { resultado, pacotes } = sim.capturar(() => sim.ping('pc1', ip('192.168.2.10')));
  assert.equal(resultado.status, 'entregue');
  const resumo = pacotes.map(p => `${p.protocolo}:${p.de}>${p.para}`);
  // na volta não há ARP: quem respondeu aos pedidos já aprendeu o MAC de quem perguntou
  assert.deepEqual(resumo, [
    'ARP:PC1>todos (broadcast)', 'ARP:R1>PC1', 'ICMP:PC1>R1',
    'ARP:R1>todos (broadcast)', 'ARP:PC2>R1', 'ICMP:R1>PC2',
    'ICMP:PC2>R1', 'ICMP:R1>PC1'
  ]);
  assert.equal(pacotes[0].macDestino, 'ff-ff-ff-ff-ff-ff');
  assert.match(pacotes[0].info, /Quem tem 192\.168\.1\.1\? Responda para 192\.168\.1\.10/);
  const [ida1, ida2] = pacotes.filter(p => p.protocolo === 'ICMP').slice(0, 2);
  assert.equal(ida1.ipOrigem, ida2.ipOrigem); assert.equal(ida1.ipDestino, '192.168.2.10');
  assert.notEqual(ida1.macDestino, ida2.macDestino, 'o MAC de destino muda a cada salto');
  assert.equal(ida1.ttl - 1, ida2.ttl, 'o roteador diminui o TTL');
  // segunda vez: os caches ARP já estão cheios
  const segunda = sim.capturar(() => sim.ping('pc1', ip('192.168.2.10'))).pacotes;
  assert.deepEqual(segunda.map(p => p.protocolo), ['ICMP', 'ICMP', 'ICMP', 'ICMP']);
  assert.match(segunda.at(-1).info, /resposta/);
  // fora do capturar nada é gravado
  assert.deepEqual(sim.capturar(() => 1).pacotes, []);
});

test('IP duplicado aparece na captura como duas respostas ARP para o mesmo IP', () => {
  let t = base();
  t = ok(adicionarDispositivo(t, 'pc')); t = ok(conectar(t, 'pc3', 'sw1', 'eth0', 'fa3'));
  t = ok(configurarInterface(t, 'pc3', 'eth0', { ip: '192.168.1.1', mascara: '/24' }));
  const sim = criarSimulacao(t);
  const { pacotes } = sim.capturar(() => sim.ping('pc1', ip('192.168.2.10')));
  const respostas = pacotes.filter(p => p.protocolo === 'ARP' && /está em/.test(p.info));
  assert.equal(respostas.length, 2);
  assert.deepEqual(new Set(respostas.map(r => r.macOrigem)), new Set([macDe('r1', 'gi0'), macDe('pc3', 'eth0')]));
});

test('TCP: porta aberta conecta, porta fechada é recusada (RST), roteador não oferece serviço', () => {
  const sim = criarSimulacao(base());
  assert.equal(sim.conectar('pc1', ip('192.168.2.10'), 80).status, 'entregue');
  assert.equal(sim.conectar('pc1', ip('192.168.2.10'), 443).status, 'recusada');
  assert.equal(sim.conectar('pc1', ip('192.168.1.1'), 22).status, 'recusada');
  const { pacotes } = sim.capturar(() => sim.conectar('pc1', ip('192.168.2.10'), 443));
  assert.match(pacotes.find(p => p.protocolo === 'TCP').info, /50000 → 443 \(HTTPS\) \[SYN\]/);
  assert.match(pacotes.at(-1).info, /443 \(HTTPS\) → 50000 \[RST, ACK\]/);
});

test('filtro por porta: negar Telnet bloqueia só o 23; a resposta (porta de destino 50000) não é afetada', () => {
  const t = filtro(base(), { acao: 'negar', protocolo: 'tcp', porta: '23' });
  const sim = criarSimulacao(t);
  const r = sim.conectar('pc1', ip('192.168.2.10'), 23);
  assert.equal(r.status, 'bloqueado');
  assert.equal(sim.conectar('pc1', ip('192.168.2.10'), 22).status, 'entregue');
  assert.equal(sim.ping('pc1', ip('192.168.2.10')).status, 'entregue', 'ICMP não é TCP');
});

test('filtro por protocolo: negar icmp derruba o ping mas não o HTTP; negar udp 53 derruba o DNS', () => {
  const semPing = criarSimulacao(filtro(base(), { acao: 'negar', protocolo: 'icmp' }));
  assert.equal(semPing.ping('pc1', ip('192.168.2.10')).status, 'bloqueado');
  assert.equal(semPing.conectar('pc1', ip('192.168.2.10'), 80).status, 'entregue');
  const semDns = criarSimulacao(filtro(base(), { acao: 'negar', protocolo: 'udp', porta: '53' }));
  assert.deepEqual(semDns.resolver('pc1', 'srv.local').motivo, 'dns-inalcancavel');
  assert.equal(criarSimulacao(base()).resolver('pc1', 'srv.local').ok, true);
});

test('captura do DNS mostra consulta e resposta UDP 53', () => {
  const sim = criarSimulacao(base());
  const { pacotes } = sim.capturar(() => sim.resolver('pc1', 'srv.local'));
  const dns = pacotes.filter(p => p.protocolo === 'DNS');
  assert.match(dns[0].info, /Consulta: srv\.local \(A\)/);
  assert.match(dns.at(-1).info, /Resposta: srv\.local A 192\.168\.2\.10/);
});

test('validações: regra com protocolo/porta, serviços e filtroNega compatível', () => {
  const t = base();
  const erro = regra => adicionarFiltro(t, 'r1', { acao: 'negar', origem: '', origemM: '', destino: '', destinoM: '', ...regra }).erro;
  assert.match(erro({ protocolo: 'gre' }), /Protocolo inválido/);
  assert.match(erro({ protocolo: 'icmp', porta: '1' }), /só existe em regras tcp ou udp/);
  assert.match(erro({ protocolo: 'tcp', porta: '70000' }), /Porta inválida/);
  assert.deepEqual(filtro(t, { acao: 'negar', protocolo: 'tcp', porta: '23' }).dispositivos.find(d => d.id === 'r1').filtros[0], { acao: 'negar', origem: '0.0.0.0', origemM: '0.0.0.0', destino: '0.0.0.0', destinoM: '0.0.0.0', protocolo: 'tcp', porta: 23 });
  assert.deepEqual(filtro(t, { acao: 'negar' }).dispositivos.find(d => d.id === 'r1').filtros[0].protocolo, undefined, 'ip = sem campo (compatível com o formato antigo)');
  assert.match(configurarServicos(t, 'r1', [80]).erro, /Só computadores/);
  assert.match(configurarServicos(t, 'pc2', [0]).erro, /Porta inválida/);
  assert.match(configurarServicos(t, 'pc2', Array.from({ length: MAX_SERVICOS + 1 }, (_, i) => i + 1)).erro, /Limite/);
  assert.equal('servicos' in ok(configurarServicos(t, 'pc2', [])).dispositivos.find(d => d.id === 'pc2'), false);
  assert.equal(filtroNega({ filtros: [{ acao: 'negar', origem: '0.0.0.0', origemM: '0.0.0.0', destino: '0.0.0.0', destinoM: '0.0.0.0', protocolo: 'tcp', porta: 23 }] }, 1, 2), false, 'sem L4 = ping');
});

test('normalização: serviços e regras por porta salvos; valores inválidos descartados', () => {
  const t = filtro(base(), { acao: 'negar', protocolo: 'tcp', porta: '23' });
  const c = JSON.parse(JSON.stringify(t));
  c.dispositivos.find(d => d.id === 'pc2').servicos = [80, 80, 'x', 70000, 22];
  c.dispositivos.find(d => d.id === 'r1').filtros.push({ acao: 'negar', origem: '0.0.0.0', origemM: '0.0.0.0', destino: '0.0.0.0', destinoM: '0.0.0.0', protocolo: 'icmp', porta: 5 });
  const n = normalizarTopologia(c);
  assert.deepEqual(n.dispositivos.find(d => d.id === 'pc2').servicos, [22, 80]);
  assert.equal(n.dispositivos.find(d => d.id === 'r1').filtros.length, 1);
  assert.equal(n.dispositivos.find(d => d.id === 'r1').filtros[0].porta, 23);
});

test('terminal: tnc mostra sucesso, porta fechada e bloqueio', () => {
  const sim = criarSimulacao(filtro(base(), { acao: 'negar', protocolo: 'tcp', porta: '23' }));
  const run = l => executar(sim, 'pc1', l).linhas.join('\n');
  assert.match(run('tnc 192.168.2.10 80'), /RemotePort\s+: 80 \(HTTP\)[\s\S]*TcpTestSucceeded : True/);
  assert.match(run('tnc srv.local 443'), /porta está fechada[\s\S]*TcpTestSucceeded : False/);
  assert.match(run('tnc 192.168.2.10 23'), /bloqueou a conexão[\s\S]*False/);
  assert.match(run('Test-NetConnection 192.168.2.10 -Port 22'), /TcpTestSucceeded : True/);
  assert.match(run('tnc 192.168.2.10'), /Uso: tnc/);
  assert.match(run('help'), /tnc destino porta/);
});
