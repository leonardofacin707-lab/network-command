// Rotas estáticas no motor: prefixo mais longo, próximo salto, retorno, laços e validações.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../js/sim/motor.js';
import { lerIPv4, formatarIPv4 } from '../../js/sim/ipv4.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, adicionarRotaEstatica, removerRotaEstatica, normalizarTopologia, MAX_ROTAS } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
// pc1 - r1 - r2 - pc2, sem switches: LAN A 192.168.1.0/24, enlace 10.0.0.0/30, LAN B 172.16.0.0/24
function base() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'roteador', 'roteador']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'r1', 'eth0', 'gi0')); t = ok(conectar(t, 'r1', 'r2', 'gi1', 'gi0')); t = ok(conectar(t, 'r2', 'pc2', 'gi1', 'eth0'));
  const i = (id, p, ip, m) => { t = ok(configurarInterface(t, id, p, { ip, mascara: m })); };
  i('pc1', 'eth0', '192.168.1.10', '/24'); i('r1', 'gi0', '192.168.1.1', '/24'); i('r1', 'gi1', '10.0.0.1', '/30');
  i('r2', 'gi0', '10.0.0.2', '/30'); i('r2', 'gi1', '172.16.0.1', '/24'); i('pc2', 'eth0', '172.16.0.10', '/24');
  t = ok(configurarGateway(t, 'pc1', '192.168.1.1')); t = ok(configurarGateway(t, 'pc2', '172.16.0.1'));
  return t;
}
const rota = (t, id, rede, mascara, via) => ok(adicionarRotaEstatica(t, id, { rede, mascara, via }));
const ping = (t, de, ip) => criarSimulacao(t).ping(de, lerIPv4(ip));

test('sem rotas estáticas, o roteador não conhece a rede do outro lado', () => {
  const r = ping(base(), 'pc1', '172.16.0.10');
  assert.equal(r.status, 'rede-inalcancavel');
  assert.equal(formatarIPv4(r.de), '192.168.1.1');
});

test('uma rota só de ida entrega o pacote mas a resposta não volta (timeout)', () => {
  const t = rota(base(), 'r1', '172.16.0.0', '/24', '10.0.0.2');
  const r = ping(t, 'pc1', '172.16.0.10');
  assert.equal(r.status, 'timeout');
  assert.equal(r.ida.status, 'entregue');
  assert.equal(r.volta.status, 'rede-inalcancavel');
});

test('rotas nos dois sentidos fazem o ping passar por dois roteadores (TTL 128 − 2 na volta)', () => {
  const t = rota(rota(base(), 'r1', '172.16.0.0', '/24', '10.0.0.2'), 'r2', '192.168.1.0', '/24', '10.0.0.1');
  const r = ping(t, 'pc1', '172.16.0.10');
  assert.equal(r.status, 'entregue');
  assert.equal(r.saltos.length, 2);
  assert.equal(r.ttl, 126, 'a resposta de pc2 (TTL 128) atravessa 2 roteadores');
  assert.equal(ping(t, 'pc2', '192.168.1.10').status, 'entregue');
  assert.equal(criarSimulacao(t).rastrear('pc1', lerIPv4('172.16.0.10')).saltos.map(s => formatarIPv4(s.ip)).join(','), '192.168.1.1,10.0.0.2');
});

test('rota padrão (0.0.0.0/0) serve para qualquer destino, e a rota mais específica vence', () => {
  let t = rota(base(), 'r2', '192.168.1.0', '/24', '10.0.0.1');
  t = rota(t, 'r1', '0.0.0.0', '/0', '10.0.0.2');
  assert.equal(ping(t, 'pc1', '172.16.0.10').status, 'entregue');
  // mais específica apontando para o próximo salto errado (um endereço que ninguém tem) vence a padrão e quebra o ping
  const errada = rota(t, 'r1', '172.16.0.0', '/24', '10.0.0.3');
  assert.equal(ping(errada, 'pc1', '172.16.0.10').status, 'host-inalcancavel');
});

test('rota conectada vence uma estática de mesmo prefixo, e a de prefixo maior vence a de menor', () => {
  let t = rota(base(), 'r1', '192.168.1.0', '/24', '10.0.0.2'); // tenta desviar a própria LAN
  assert.equal(ping(t, 'pc1', '192.168.1.1').status, 'entregue');
  t = rota(rota(rota(base(), 'r2', '192.168.1.0', '/24', '10.0.0.1'), 'r1', '172.16.0.0', '/16', '10.0.0.3'), 'r1', '172.16.0.0', '/24', '10.0.0.2');
  assert.equal(ping(t, 'pc1', '172.16.0.10').status, 'entregue', '/24 certa vence a /16 errada');
});

test('laço de roteamento termina por TTL expirado, sem travar', () => {
  let t = rota(base(), 'r1', '172.16.9.0', '/24', '10.0.0.2');
  t = rota(t, 'r2', '172.16.9.0', '/24', '10.0.0.1');
  const r = ping(t, 'pc1', '172.16.9.5');
  assert.equal(r.status, 'ttl-expirado');
});

test('validações: máscara, endereço de rede, próximo salto alcançável, duplicadas, limite e tipo de dispositivo', () => {
  const t = base();
  const erro = (campos, id = 'r1', topo = t) => adicionarRotaEstatica(topo, id, campos).erro;
  assert.match(erro({ rede: '172.16.0.0', mascara: '255.0.255.0', via: '10.0.0.2' }), /Máscara inválida/);
  assert.match(erro({ rede: 'abc', mascara: '/24', via: '10.0.0.2' }), /rede inválido/);
  assert.match(erro({ rede: '172.16.0.5', mascara: '/24', via: '10.0.0.2' }), /endereço de rede seria 172\.16\.0\.0/);
  assert.match(erro({ rede: '172.16.0.0', mascara: '/24', via: '10.9.9.9' }), /ligada diretamente/);
  assert.match(erro({ rede: '172.16.0.0', mascara: '/24', via: '10.0.0.1' }), /próprio roteador/);
  assert.match(erro({ rede: '172.16.0.0', mascara: '/24', via: '10.0.0.2' }, 'pc1'), /Só roteadores/);
  const com = rota(t, 'r1', '172.16.0.0', '/24', '10.0.0.2');
  assert.match(erro({ rede: '172.16.0.0', mascara: '255.255.255.0', via: '10.0.0.2' }, 'r1', com), /Já existe/);
  let cheio = t;
  for (let i = 0; i < MAX_ROTAS; i++) cheio = rota(cheio, 'r1', `10.${i + 10}.0.0`, '/16', '10.0.0.2');
  assert.match(erro({ rede: '10.200.0.0', mascara: '/16', via: '10.0.0.2' }, 'r1', cheio), /Limite/);
  assert.equal(t.dispositivos.find(d => d.id === 'r1').rotas.length, 0, 'a topologia original não muda (imutável)');
});

test('remover rota e normalização de dados salvos (lixo descartado, duplicadas e inválidas fora)', () => {
  const com = rota(rota(base(), 'r1', '172.16.0.0', '/24', '10.0.0.2'), 'r1', '0.0.0.0', '/0', '10.0.0.2');
  const sem = ok(removerRotaEstatica(com, 'r1', 0));
  assert.deepEqual(sem.dispositivos.find(d => d.id === 'r1').rotas, [{ rede: '0.0.0.0', mascara: '0.0.0.0', via: '10.0.0.2' }]);
  assert.ok(removerRotaEstatica(com, 'r1', 5).erro);
  assert.ok(removerRotaEstatica(com, 'pc1', 0).erro);
  const bruto = JSON.parse(JSON.stringify(com));
  bruto.dispositivos.find(d => d.id === 'r1').rotas.push({ rede: '1.2.3.4', mascara: '/24', via: '10.0.0.2' }, { rede: 'x', mascara: 1, via: null }, 'lixo', null, { rede: '172.16.0.0', mascara: '255.255.255.0', via: '10.0.0.2' });
  const n = normalizarTopologia(bruto);
  assert.equal(n.dispositivos.find(d => d.id === 'r1').rotas.length, 2);
  assert.deepEqual(normalizarTopologia({ dispositivos: [{ id: 'r1', tipo: 'roteador', rotas: 'x' }], cabos: [] }).dispositivos[0].rotas, []);
  assert.equal(normalizarTopologia(bruto).dispositivos.find(d => d.id === 'pc1').rotas, undefined);
});
