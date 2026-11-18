import test from 'node:test';
import assert from 'node:assert/strict';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, configurarPortaSwitch, configDaPortaSwitch, vlansDoSwitch, normalizarTopologia } from '../../js/sim/topologia.js';
import { criarSimulacao, dominioL2 } from '../../js/sim/motor.js';
import { lerIPv4 } from '../../js/sim/ipv4.js';

const ok = r => { assert.ok(r.topologia, r.erro); return r.topologia; };
const add = (t, tipo) => ok(adicionarDispositivo(t, tipo));
const liga = (t, a, b, pa, pb) => ok(conectar(t, a, b, pa, pb));
const ip = (t, id, i, m = '/24', p = 'eth0') => ok(configurarInterface(t, id, p, { ip: i, mascara: m }));
const porta = (t, sw, p, modo, vlan) => ok(configurarPortaSwitch(t, sw, p, { modo, vlan }));
const ping = (t, de, destino) => criarSimulacao(t).ping(de, lerIPv4(destino)).status;

/** PC1 e PC2 no mesmo switch, mesma sub-rede. */
function doisPcs() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch']) t = add(t, tipo);
  t = liga(t, 'pc1', 'sw1', 'eth0', 'fa1'); t = liga(t, 'pc2', 'sw1', 'eth0', 'fa2');
  t = ip(t, 'pc1', '192.168.10.10'); t = ip(t, 'pc2', '192.168.10.20');
  return t;
}

test('padrão: todas as portas são access na VLAN 1 e a rede funciona como antes', () => {
  const t = doisPcs();
  assert.deepEqual(configDaPortaSwitch(t.dispositivos.find(d => d.id === 'sw1'), 'fa1'), { modo: 'access', vlan: 1 });
  assert.equal(ping(t, 'pc1', '192.168.10.20'), 'entregue');
});

test('VLANs diferentes isolam o broadcast: o ARP não atravessa e o ping falha', () => {
  let t = porta(doisPcs(), 'sw1', 'fa1', 'access', 10);
  t = porta(t, 'sw1', 'fa2', 'access', 20);
  assert.equal(ping(t, 'pc1', '192.168.10.20'), 'arp-falhou');
  assert.deepEqual(dominioL2(t, 'pc1', 'eth0'), []);
  // mesma VLAN em ambos: volta a funcionar
  t = porta(t, 'sw1', 'fa2', 'access', 10);
  assert.equal(ping(t, 'pc1', '192.168.10.20'), 'entregue');
});

test('configurarPortaSwitch valida e guarda só o que foge do padrão', () => {
  const t = doisPcs();
  assert.match(configurarPortaSwitch(t, 'sw1', 'fa1', { modo: 'access', vlan: 0 }).erro, /VLAN inválida/);
  assert.match(configurarPortaSwitch(t, 'sw1', 'fa1', { modo: 'access', vlan: 4095 }).erro, /VLAN inválida/);
  assert.match(configurarPortaSwitch(t, 'sw1', 'fa1', { modo: 'access', vlan: '1e3' }).erro, /VLAN inválida/);
  assert.match(configurarPortaSwitch(t, 'sw1', 'fa1', { modo: 'qinq', vlan: 5 }).erro, /Modo inválido/);
  assert.match(configurarPortaSwitch(t, 'sw1', 'fa9', { modo: 'trunk' }).erro, /inexistente/);
  assert.match(configurarPortaSwitch(t, 'pc1', 'eth0', { modo: 'trunk' }).erro, /Só switches/);
  const t2 = porta(t, 'sw1', 'fa1', 'access', 10);
  assert.deepEqual(t2.dispositivos.find(d => d.id === 'sw1').portas, { fa1: { modo: 'access', vlan: 10 } });
  const t3 = porta(t2, 'sw1', 'fa1', 'access', 1);
  assert.deepEqual(t3.dispositivos.find(d => d.id === 'sw1').portas, {}, 'voltar ao padrão apaga a entrada');
  assert.equal(t.dispositivos.find(d => d.id === 'sw1').portas.fa1, undefined, 'não muta o original');
  assert.deepEqual(vlansDoSwitch(t2, 'sw1'), [1, 10]);
});

/** PC1(VLAN10)-SW1 ==SW2-(VLAN10)PC3 e PC2(VLAN20)-SW1 ==SW2-(VLAN20)PC4, com o link SW1-SW2 na porta fa8. */
function doisPredios(trunk) {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'pc', 'pc', 'switch', 'switch']) t = add(t, tipo);
  t = liga(t, 'pc1', 'sw1', 'eth0', 'fa1'); t = liga(t, 'pc2', 'sw1', 'eth0', 'fa2');
  t = liga(t, 'pc3', 'sw2', 'eth0', 'fa1'); t = liga(t, 'pc4', 'sw2', 'eth0', 'fa2');
  t = liga(t, 'sw1', 'sw2', 'fa8', 'fa8');
  t = porta(t, 'sw1', 'fa1', 'access', 10); t = porta(t, 'sw1', 'fa2', 'access', 20);
  t = porta(t, 'sw2', 'fa1', 'access', 10); t = porta(t, 'sw2', 'fa2', 'access', 20);
  t = ip(t, 'pc1', '192.168.10.1'); t = ip(t, 'pc3', '192.168.10.3');
  t = ip(t, 'pc2', '192.168.20.2'); t = ip(t, 'pc4', '192.168.20.4');
  if (trunk) { t = porta(t, 'sw1', 'fa8', 'trunk'); t = porta(t, 'sw2', 'fa8', 'trunk'); }
  return t;
}

test('sem trunk entre os switches, a VLAN não cruza o link (portas access na VLAN 1)', () => {
  assert.equal(ping(doisPredios(false), 'pc1', '192.168.10.3'), 'arp-falhou');
});

test('com trunk nos dois lados, cada VLAN cruza o link e continua isolada das outras', () => {
  const t = doisPredios(true);
  assert.equal(ping(t, 'pc1', '192.168.10.3'), 'entregue');
  assert.equal(ping(t, 'pc2', '192.168.20.4'), 'entregue');
  // VLANs diferentes não se enxergam mesmo com trunk (e sem roteador)
  const t2 = ip(t, 'pc4', '192.168.10.4');
  assert.equal(ping(t2, 'pc1', '192.168.10.4'), 'arp-falhou', 'PC4 está na VLAN 20, PC1 na 10');
  assert.deepEqual(dominioL2(t, 'pc1', 'eth0').map(e => e.d), ['pc3']);
});

test('trunk em um lado só não resolve: o quadro chega marcado a uma porta access', () => {
  let t = doisPredios(false);
  t = porta(t, 'sw1', 'fa8', 'trunk');
  // sw2.fa8 continua access na VLAN 1: o quadro da VLAN 10 entra na VLAN 1 e não chega ao PC3
  assert.equal(ping(t, 'pc1', '192.168.10.3'), 'arp-falhou');
});

test('access nos dois lados na mesma VLAN também carrega essa VLAN (e só ela)', () => {
  let t = doisPredios(false);
  t = porta(t, 'sw1', 'fa8', 'access', 10); t = porta(t, 'sw2', 'fa8', 'access', 10);
  assert.equal(ping(t, 'pc1', '192.168.10.3'), 'entregue');
  assert.equal(ping(t, 'pc2', '192.168.20.4'), 'arp-falhou');
});

test('trunk entregando a um host: só a VLAN nativa (1) chega sem marca', () => {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch']) t = add(t, tipo);
  t = liga(t, 'pc1', 'sw1', 'eth0', 'fa1'); t = liga(t, 'pc2', 'sw1', 'eth0', 'fa2');
  t = ip(t, 'pc1', '10.1.1.1'); t = ip(t, 'pc2', '10.1.1.2');
  t = porta(t, 'sw1', 'fa2', 'trunk');
  assert.equal(ping(t, 'pc1', '10.1.1.2'), 'entregue', 'VLAN 1 é a nativa');
  t = porta(t, 'sw1', 'fa1', 'access', 10);
  assert.equal(ping(t, 'pc1', '10.1.1.2'), 'arp-falhou', 'VLAN 10 não chega a um host em trunk');
});

/** Roteador com uma interface por VLAN, cada uma em uma porta access do switch. */
function interVlan(fa8Vlan) {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch', 'roteador']) t = add(t, tipo);
  t = liga(t, 'pc1', 'sw1', 'eth0', 'fa1'); t = liga(t, 'pc2', 'sw1', 'eth0', 'fa2');
  t = liga(t, 'r1', 'sw1', 'gi0', 'fa7'); t = liga(t, 'r1', 'sw1', 'gi1', 'fa8');
  t = porta(t, 'sw1', 'fa1', 'access', 10); t = porta(t, 'sw1', 'fa2', 'access', 20);
  t = porta(t, 'sw1', 'fa7', 'access', 10); t = porta(t, 'sw1', 'fa8', 'access', fa8Vlan);
  t = ip(t, 'r1', '192.168.10.254', '/24', 'gi0'); t = ip(t, 'r1', '192.168.20.254', '/24', 'gi1');
  t = ip(t, 'pc1', '192.168.10.1'); t = ip(t, 'pc2', '192.168.20.1');
  t = ok(configurarGateway(t, 'pc1', '192.168.10.254')); t = ok(configurarGateway(t, 'pc2', '192.168.20.254'));
  return t;
}

test('roteamento entre VLANs: o roteador liga as duas só se cada interface estiver na VLAN certa', () => {
  assert.equal(ping(interVlan(20), 'pc1', '192.168.20.1'), 'entregue');
  const r = criarSimulacao(interVlan(20)).ping('pc1', lerIPv4('192.168.20.1'));
  assert.equal(r.ttl, 127, 'um salto de roteador');
  // interface gi1 na VLAN 1 em vez da 20: o roteador não enxerga o PC2
  assert.notEqual(ping(interVlan(1), 'pc1', '192.168.20.1'), 'entregue');
});

test('normalizarTopologia sanea a configuração de portas', () => {
  const t = doisPcs();
  const bruto = JSON.parse(JSON.stringify(t));
  bruto.dispositivos.find(d => d.id === 'sw1').portas = { fa1: { modo: 'access', vlan: 10 }, fa2: { modo: 'trunk', vlan: 99 }, fa3: { modo: 'access', vlan: 5000 }, fa4: { modo: 'x' }, fa5: 'lixo', fa9: { modo: 'trunk' }, fa6: { modo: 'access', vlan: 1 }, fa7: { modo: 'access', vlan: 7.5 } };
  const n = normalizarTopologia(bruto);
  assert.deepEqual(n.dispositivos.find(d => d.id === 'sw1').portas, { fa1: { modo: 'access', vlan: 10 }, fa2: { modo: 'trunk', vlan: 1 } });
  bruto.dispositivos.find(d => d.id === 'sw1').portas = [1, 2];
  assert.deepEqual(normalizarTopologia(bruto).dispositivos.find(d => d.id === 'sw1').portas, {});
  delete bruto.dispositivos.find(d => d.id === 'sw1').portas;
  assert.deepEqual(normalizarTopologia(bruto).dispositivos.find(d => d.id === 'sw1').portas, {}, 'topologias salvas antes das VLANs continuam válidas');
  assert.deepEqual(normalizarTopologia(normalizarTopologia(t)), normalizarTopologia(t), 'idempotente');
});
