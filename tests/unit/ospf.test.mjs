// OSPF simplificado: wildcard, vizinhança (área e máscara), SPF, rotas O, preferência de rotas e normalização.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../js/sim/motor.js';
import { lerIPv4, formatarIPv4 } from '../../js/sim/ipv4.js';
import { casaNetwork, calcularOspf } from '../../js/sim/ospf.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, adicionarNetworkOspf, removerNetworkOspf,
  removerOspf, adicionarRotaEstatica, normalizarTopologia, dispositivo, removerCabo } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
const ip = lerIPv4;
// PC1 - R1 - R2 - R3 - PC2
function base({ ospf = true } = {}) {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'roteador', 'roteador', 'roteador', 'pc']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'r1', 'eth0', 'gi0')); t = ok(conectar(t, 'r1', 'r2', 'gi1', 'gi0')); t = ok(conectar(t, 'r2', 'r3', 'gi1', 'gi0')); t = ok(conectar(t, 'r3', 'pc2', 'gi1', 'eth0'));
  const i = (d, p, x, m) => { t = ok(configurarInterface(t, d, p, { ip: x, mascara: m })); };
  i('pc1', 'eth0', '192.168.1.10', '/24'); i('r1', 'gi0', '192.168.1.1', '/24'); i('r1', 'gi1', '10.0.12.1', '/30'); i('r2', 'gi0', '10.0.12.2', '/30');
  i('r2', 'gi1', '10.0.23.1', '/30'); i('r3', 'gi0', '10.0.23.2', '/30'); i('r3', 'gi1', '192.168.3.1', '/24'); i('pc2', 'eth0', '192.168.3.10', '/24');
  t = ok(configurarGateway(t, 'pc1', '192.168.1.1')); t = ok(configurarGateway(t, 'pc2', '192.168.3.1'));
  if (ospf) for (const r of ['r1', 'r2', 'r3']) t = ok(adicionarNetworkOspf(t, r, { rede: '0.0.0.0', wildcard: '255.255.255.255', area: '0' }));
  return t;
}
const net = (t, r, rede, wildcard, area = '0') => ok(adicionarNetworkOspf(t, r, { rede, wildcard, area }));

test('wildcard: bits 0 precisam casar; usar a máscara no lugar da wildcard é o erro clássico', () => {
  assert.ok(casaNetwork(ip('192.168.1.1'), ip('192.168.1.0'), ip('0.0.0.255')));
  assert.ok(!casaNetwork(ip('192.168.2.1'), ip('192.168.1.0'), ip('0.0.0.255')));
  assert.ok(casaNetwork(ip('10.0.12.1'), ip('10.0.12.1'), ip('0.0.0.0')), 'wildcard 0.0.0.0 = só aquele IP');
  assert.ok(!casaNetwork(ip('192.168.1.1'), ip('192.168.1.0'), ip('255.255.255.0')), 'máscara no lugar da wildcard não casa a interface .1');
});

test('sem OSPF não há rota; com network em todos, PC1 alcança PC2 (TTL 125) e as rotas O aparecem', () => {
  assert.equal(criarSimulacao(base({ ospf: false })).ping('pc1', ip('192.168.3.10')).status, 'rede-inalcancavel');
  const sim = criarSimulacao(base());
  const r = sim.ping('pc1', ip('192.168.3.10'));
  assert.equal(r.status, 'entregue'); assert.equal(r.ttl, 125);
  const r1 = sim.ospf.rotas.get('r1').map(x => `${formatarIPv4(x.rede)} via ${formatarIPv4(x.via)} custo ${x.custo}`);
  assert.deepEqual(r1, ['10.0.23.0 via 10.0.12.2 custo 2', '192.168.3.0 via 10.0.12.2 custo 3']);
  assert.deepEqual(sim.ospf.vizinhos.get('r2').map(v => `${v.vizinho}:${v.estado}`).sort(), ['r1:FULL', 'r3:FULL']);
});

test('vizinhança: áreas diferentes e máscaras diferentes não formam; cabo solto derruba as rotas', () => {
  let t = ok(removerOspf(base(), 'r2'));
  t = net(net(t, 'r2', '10.0.12.0', '0.0.0.3', '1'), 'r2', '10.0.23.0', '0.0.0.3');
  const sim = criarSimulacao(t);
  assert.equal(sim.ospf.vizinhos.get('r1')[0].estado, 'area-diferente');
  assert.equal(sim.ping('pc1', ip('192.168.3.10')).status, 'rede-inalcancavel');
  const mascara = ok(configurarInterface(base(), 'r2', 'gi0', { ip: '10.0.12.2', mascara: '/29' }));
  assert.equal(criarSimulacao(mascara).ospf.vizinhos.get('r1')[0].estado, 'mascara-diferente');
  const solto = ok(removerCabo(base(), base().cabos.find(c => c.a.d === 'r2' && c.b.d === 'r3').id));
  assert.equal(criarSimulacao(solto).ospf.rotas.get('r1').length, 0);
});

test('rede não anunciada: wildcard errada no R3 deixa a LAN 192.168.3.0 de fora', () => {
  let t = ok(removerOspf(base(), 'r3'));
  t = net(net(t, 'r3', '10.0.23.0', '0.0.0.3'), 'r3', '192.168.3.0', '255.255.255.0');
  const sim = criarSimulacao(t);
  assert.equal(sim.ospf.vizinhos.get('r3')[0].estado, 'FULL');
  assert.ok(!sim.ospf.rotas.get('r1').some(x => formatarIPv4(x.rede) === '192.168.3.0'));
  assert.equal(criarSimulacao(net(t, 'r3', '192.168.3.0', '0.0.0.255')).ping('pc1', ip('192.168.3.10')).status, 'entregue');
});

test('preferência: rota estática (distância 1) vence a OSPF (110) no mesmo prefixo', () => {
  let t = base();
  t = ok(adicionarRotaEstatica(t, 'r1', { rede: '192.168.3.0', mascara: '/24', via: '192.168.1.50' }));
  // a estática aponta para um próximo salto inexistente: vence a OSPF e o pacote se perde, como no roteador real
  assert.equal(criarSimulacao(t).ping('pc1', ip('192.168.3.10')).status, 'host-inalcancavel');
});

test('comandos, validações e normalização', () => {
  const t = base();
  assert.match(adicionarNetworkOspf(t, 'pc1', { rede: '1.0.0.0', wildcard: '0.255.255.255', area: '0' }).erro, /Só roteadores/);
  assert.match(adicionarNetworkOspf(t, 'r1', { rede: 'x', wildcard: '0.0.0.255', area: '0' }).erro, /rede inválida/);
  assert.match(adicionarNetworkOspf(t, 'r1', { rede: '1.0.0.0', wildcard: '', area: '0' }).erro, /wildcard inválida/);
  assert.match(adicionarNetworkOspf(t, 'r1', { rede: '1.0.0.0', wildcard: '0.0.0.255', area: 'a' }).erro, /área inválida/);
  assert.match(adicionarNetworkOspf(t, 'r1', { rede: '0.0.0.0', wildcard: '255.255.255.255', area: '0' }).erro, /já existe/);
  assert.equal(dispositivo(ok(removerNetworkOspf(t, 'r1', 0)), 'r1').ospf, undefined);
  assert.deepEqual(normalizarTopologia(JSON.parse(JSON.stringify(t))), t);
  const c = JSON.parse(JSON.stringify(t)); c.dispositivos.find(d => d.id === 'r1').ospf.redes.push({ rede: 'zz', wildcard: '0.0.0.0', area: 0 });
  assert.equal(normalizarTopologia(c).dispositivos.find(d => d.id === 'r1').ospf.redes.length, 1);
  assert.deepEqual(calcularOspf(topologiaVazia()).rotas.size, 0);
});

import { executarIos, sessaoInicial } from '../../js/sim/cli-ios.js';
test('console IOS: router ospf, network com wildcard, aviso de máscara, show ip ospf neighbor e show ip route', () => {
  let t = base({ ospf: false }), sessao = sessaoInicial(), saida = [];
  const rodar = (id, cmds) => { sessao = sessaoInicial(); for (const c of cmds) { const r = executarIos(t, criarSimulacao(t), id, c, sessao); if (r.topologia) t = r.topologia; sessao = r.sessao; saida.push(...r.linhas); } };
  rodar('r1', ['en', 'conf t', 'router ospf 1', 'network 192.168.1.0 0.0.0.255 area 0', 'network 10.0.12.0 0.0.0.3 area 0']);
  assert.equal(sessao.modo, 'ospf');
  rodar('r2', ['en', 'conf t', 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0']);
  rodar('r3', ['en', 'conf t', 'router ospf 1', 'network 10.0.23.0 0.0.0.3 area 0', 'network 192.168.3.0 255.255.255.0 area 0']);
  assert.match(saida.join('\n'), /parece uma máscara/);
  rodar('r3', ['en', 'conf t', 'router ospf 1', 'no network 192.168.3.0 255.255.255.0 area 0', 'network 192.168.3.0 0.0.0.255 area 0', 'end', 'show ip ospf neighbor']);
  rodar('r1', ['en', 'show ip route', 'show running-config']);
  const txt = saida.join('\n');
  assert.match(txt, /R2\s+FULL\s+10\.0\.23\.1\s+GigabitEthernet0\/0/);
  assert.match(txt, /O\s+192\.168\.3\.0\/24 \[110\/3\] via 10\.0\.12\.2, GigabitEthernet0\/1/);
  assert.match(txt, /router ospf 1\n network 192\.168\.1\.0 0\.0\.0\.255 area 0/);
  assert.equal(criarSimulacao(t).ping('pc1', ip('192.168.3.10')).status, 'entregue');
  rodar('r1', ['en', 'conf t', 'no router ospf 1']);
  assert.equal(dispositivo(t, 'r1').ospf, undefined);
});
