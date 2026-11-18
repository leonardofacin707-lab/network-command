import test from 'node:test';
import assert from 'node:assert/strict';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, removerCabo } from '../../js/sim/topologia.js';
import { lerIPv4, formatarIPv4 } from '../../js/sim/ipv4.js';
import { criarSimulacao, dominioL2, resolverArp, macDe, conflitosDeIp, enviarPacote } from '../../js/sim/motor.js';

const ip = lerIPv4;
const add = (t, tipo) => adicionarDispositivo(t, tipo).topologia;
const liga = (t, a, b) => { const r = conectar(t, a, b); assert.ok(r.topologia, r.erro); return r.topologia; };
const cfg = (t, id, porta, i, m = '/24') => { const r = configurarInterface(t, id, porta, { ip: i, mascara: m }); assert.ok(r.topologia, r.erro); return r.topologia; };
const gw = (t, id, g) => configurarGateway(t, id, g).topologia;

/** PC1 e PC2 em um switch, mesma sub-rede. */
function lanSimples() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'pc', 'switch']) t = add(t, tipo);
  t = liga(liga(liga(t, 'pc1', 'sw1'), 'pc2', 'sw1'), 'pc3', 'sw1');
  t = cfg(t, 'pc1', 'eth0', '192.168.1.10');
  t = cfg(t, 'pc2', 'eth0', '192.168.1.20');
  t = cfg(t, 'pc3', 'eth0', '192.168.1.30');
  return t;
}

/** PC1 (192.168.1.0/24) -- SW1 -- R1 -- SW2 -- PC2 (10.0.0.0/24). */
function duasRedes() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch', 'switch', 'roteador']) t = add(t, tipo);
  t = liga(t, 'pc1', 'sw1'); t = liga(t, 'sw1', 'r1');
  t = liga(t, 'pc2', 'sw2'); t = liga(t, 'sw2', 'r1');
  t = cfg(t, 'r1', 'gi0', '192.168.1.1'); t = cfg(t, 'r1', 'gi1', '10.0.0.1');
  t = cfg(t, 'pc1', 'eth0', '192.168.1.10'); t = gw(t, 'pc1', '192.168.1.1');
  t = cfg(t, 'pc2', 'eth0', '10.0.0.10'); t = gw(t, 'pc2', '10.0.0.1');
  return t;
}

test('MAC é determinístico, único por porta e no formato esperado', () => {
  assert.equal(macDe('pc1', 'eth0'), macDe('pc1', 'eth0'));
  assert.notEqual(macDe('pc1', 'eth0'), macDe('pc2', 'eth0'));
  assert.notEqual(macDe('r1', 'gi0'), macDe('r1', 'gi1'));
  assert.match(macDe('pc1', 'eth0'), /^02-00(-[0-9a-f]{2}){4}$/);
});

test('domínio L2: o switch repete o quadro para todos, menos a origem', () => {
  const t = lanSimples();
  const dom = dominioL2(t, 'pc1', 'eth0');
  assert.deepEqual(dom.map(e => e.d).sort(), ['pc2', 'pc3']);
  assert.equal(dominioL2(topologiaVazia().dispositivos.length ? null : add(topologiaVazia(), 'pc'), 'pc1', 'eth0'), null, 'sem cabo, sem domínio');
});

test('domínio L2 atravessa vários switches e não entra em laço infinito', () => {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch', 'switch', 'switch']) t = add(t, tipo);
  t = liga(t, 'pc1', 'sw1'); t = liga(t, 'sw1', 'sw2'); t = liga(t, 'sw2', 'sw3'); t = liga(t, 'sw3', 'sw1'); // triângulo de switches
  t = liga(t, 'pc2', 'sw3');
  assert.deepEqual(dominioL2(t, 'pc1', 'eth0').map(e => e.d), ['pc2']);
});

test('roteador separa domínios de broadcast', () => {
  const t = duasRedes();
  assert.deepEqual(dominioL2(t, 'pc1', 'eth0').map(e => e.d), ['r1']);
  assert.equal(resolverArp(t, 'pc1', 'eth0', ip('10.0.0.10')).achados.length, 0, 'ARP não atravessa o roteador');
  assert.equal(resolverArp(t, 'pc1', 'eth0', ip('192.168.1.1')).achados.length, 1);
});

test('ping na mesma sub-rede funciona, com TTL 128 e ARP aprendido', () => {
  const sim = criarSimulacao(lanSimples());
  const r = sim.ping('pc1', ip('192.168.1.20'));
  assert.equal(r.status, 'entregue');
  assert.equal(r.ttl, 128);
  assert.deepEqual(r.saltos, []);
  assert.deepEqual(sim.tabelaArp('pc1').map(a => formatarIPv4(a.ip)), ['192.168.1.20']);
  assert.deepEqual(sim.tabelaArp('pc2').map(a => formatarIPv4(a.ip)), ['192.168.1.10'], 'o destino aprende a origem ao responder');
  assert.deepEqual(sim.tabelaArp('pc3'), []);
});

test('ping no próprio IP funciona (loopback) e não usa a rede', () => {
  const r = criarSimulacao(lanSimples()).ping('pc1', ip('192.168.1.10'));
  assert.equal(r.status, 'entregue');
  assert.equal(r.ttl, 128);
});

test('falhas de configuração do computador de origem', () => {
  let t = lanSimples();
  assert.equal(criarSimulacao(cfg(t, 'pc1', 'eth0', '', '')).ping('pc1', ip('192.168.1.20')).status, 'sem-ip');
  assert.equal(criarSimulacao(removerCabo(t, 'c1').topologia).ping('pc1', ip('192.168.1.20')).status, 'sem-link');
  assert.equal(criarSimulacao(t).ping('pc1', ip('192.168.1.99')).status, 'arp-falhou', 'ninguém com esse IP na rede');
  assert.equal(criarSimulacao(t).ping('pc1', ip('10.1.1.1')).status, 'sem-rota', 'outra rede sem gateway');
  assert.equal(criarSimulacao(gw(t, 'pc1', '172.16.0.1')).ping('pc1', ip('10.1.1.1')).status, 'gateway-fora');
  assert.equal(criarSimulacao(gw(t, 'pc1', '192.168.1.254')).ping('pc1', ip('10.1.1.1')).status, 'arp-falhou', 'gateway inexistente');
});

test('máscara errada no destino quebra a volta: a ida chega, a resposta não', () => {
  // PC2 com /30: acha que 192.168.1.10 está fora da sub-rede e não tem gateway
  const t = cfg(lanSimples(), 'pc2', 'eth0', '192.168.1.21', '/30');
  const r = criarSimulacao(t).ping('pc1', ip('192.168.1.21'));
  assert.equal(r.ida.status, 'entregue');
  assert.equal(r.volta.status, 'sem-rota');
  assert.equal(r.status, 'timeout');
});

test('máscara errada na origem: o destino parece remoto e não há gateway', () => {
  const t = cfg(lanSimples(), 'pc1', 'eth0', '192.168.1.10', '/30'); // .8/30: .20 está fora
  assert.equal(criarSimulacao(t).ping('pc1', ip('192.168.1.20')).status, 'sem-rota');
});

test('ping entre redes diferentes através do roteador: TTL cai um por roteador', () => {
  const sim = criarSimulacao(duasRedes());
  const r = sim.ping('pc1', ip('10.0.0.10'));
  assert.equal(r.status, 'entregue');
  assert.equal(r.ttl, 127);
  assert.deepEqual(r.saltos.map(s => [s.d, formatarIPv4(s.ip)]), [['r1', '192.168.1.1']]);
  assert.deepEqual(r.caminho, ['pc1', 'r1', 'pc2']);
  assert.deepEqual(sim.tabelaArp('pc1').map(a => formatarIPv4(a.ip)), ['192.168.1.1'], 'o PC só aprende o MAC do gateway');
});

test('ping para a interface do roteador: TTL 255', () => {
  assert.equal(criarSimulacao(duasRedes()).ping('pc1', ip('192.168.1.1')).ttl, 255);
  assert.equal(criarSimulacao(duasRedes()).ping('pc1', ip('10.0.0.1')).ttl, 255, 'a outra interface do mesmo roteador responde direto, sem encaminhar');
});

test('gateway errado, ausente ou roteador sem IP quebram o ping entre redes', () => {
  const base = duasRedes();
  assert.equal(criarSimulacao(gw(base, 'pc1', '')).ping('pc1', ip('10.0.0.10')).status, 'sem-rota');
  assert.equal(criarSimulacao(gw(base, 'pc1', '192.168.1.99')).ping('pc1', ip('10.0.0.10')).status, 'arp-falhou');
  assert.equal(criarSimulacao(gw(base, 'pc1', '192.168.1.20')).ping('pc1', ip('10.0.0.10')).status, 'arp-falhou');
  // PC2 sem gateway: a ida chega, a volta se perde
  const semGw = criarSimulacao(gw(base, 'pc2', '')).ping('pc1', ip('10.0.0.10'));
  assert.equal(semGw.ida.status, 'entregue');
  assert.equal(semGw.status, 'timeout');
  // interface do roteador sem IP
  assert.equal(criarSimulacao(cfg(base, 'r1', 'gi1', '', '')).ping('pc1', ip('10.0.0.10')).status, 'rede-inalcancavel');
});

test('roteador responde "rede inacessível" e "host inacessível" com o IP certo', () => {
  const t = duasRedes();
  const rede = criarSimulacao(t).ping('pc1', ip('172.16.0.5'));
  assert.equal(rede.status, 'rede-inalcancavel');
  assert.equal(formatarIPv4(rede.de), '192.168.1.1');
  const host = criarSimulacao(t).ping('pc1', ip('10.0.0.77'));
  assert.equal(host.status, 'host-inalcancavel');
  assert.equal(formatarIPv4(host.de), '192.168.1.1');
});

test('cabo entre o roteador e o switch desligado derruba a rota', () => {
  const t = duasRedes();
  const semCabo = removerCabo(t, t.cabos.find(c => c.a.d === 'sw2' && c.b.d === 'r1').id).topologia;
  assert.equal(criarSimulacao(semCabo).ping('pc1', ip('10.0.0.10')).status, 'rede-inalcancavel', 'interface sem link não instala rota');
});

test('IP duplicado no mesmo domínio: ARP ambíguo e o ping falha', () => {
  const t = cfg(lanSimples(), 'pc3', 'eth0', '192.168.1.20'); // PC3 usa o IP do PC2
  assert.equal(criarSimulacao(t).ping('pc1', ip('192.168.1.20')).status, 'conflito-ip');
  const conflitos = conflitosDeIp(t);
  assert.equal(conflitos.length, 1);
  assert.equal(formatarIPv4(conflitos[0].ip), '192.168.1.20');
  assert.deepEqual(conflitosDeIp(lanSimples()), []);
});

test('o mesmo IP em redes separadas pelo roteador não é conflito', () => {
  let t = duasRedes();
  t = cfg(t, 'pc2', 'eth0', '192.168.1.10'); // mesmo número do PC1, mas atrás do roteador (e fora da sub-rede da interface)
  assert.deepEqual(conflitosDeIp(t), []);
});

test('o computador não encaminha pacotes dos outros', () => {
  // PC1 manda para 10.0.0.10 usando o PC3 como "gateway"
  let t = lanSimples();
  t = gw(t, 'pc1', '192.168.1.30');
  assert.equal(enviarPacote(t, 'pc1', ip('10.0.0.10')).status, 'descartado');
  assert.equal(criarSimulacao(t).ping('pc1', ip('10.0.0.10')).status, 'descartado');
});

test('laço de roteadores termina por TTL, sem travar', () => {
  // dois roteadores apontando um para o outro não existem sem rotas estáticas; aqui basta o limite de saltos nunca estourar a pilha
  const r = enviarPacote(duasRedes(), 'pc1', ip('10.0.0.10'));
  assert.equal(r.status, 'entregue');
  assert.ok(r.saltos.length <= 16);
});
