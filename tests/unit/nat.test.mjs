// NAT simplificado (PAT): tradução da origem, resposta de volta, lado trocado, pings de fora e normalização.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../js/sim/motor.js';
import { executar } from '../../js/sim/terminal.js';
import { lerIPv4, formatarIPv4 } from '../../js/sim/ipv4.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, adicionarRotaEstatica, configurarNat, removerNat, normalizarTopologia } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
// pc1 (192.168.1.10) - sw1 - r1 [gi0 192.168.1.1 | gi1 200.0.0.2/30] - r2 (provedor) [gi0 200.0.0.1/30 | gi1 200.0.1.1/24] - pc2 (200.0.1.10)
// O provedor (r2) só conhece as redes ligadas a ele: não tem rota para 192.168.1.0/24.
function base() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch', 'roteador', 'roteador']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'sw1', 'eth0', 'fa1')); t = ok(conectar(t, 'sw1', 'r1', 'fa2', 'gi0'));
  t = ok(conectar(t, 'r1', 'r2', 'gi1', 'gi0')); t = ok(conectar(t, 'r2', 'pc2', 'gi1', 'eth0'));
  const i = (id, p, ip, m = '/24') => { t = ok(configurarInterface(t, id, p, { ip, mascara: m })); };
  i('pc1', 'eth0', '192.168.1.10'); i('r1', 'gi0', '192.168.1.1'); i('r1', 'gi1', '200.0.0.2', '/30');
  i('r2', 'gi0', '200.0.0.1', '/30'); i('r2', 'gi1', '200.0.1.1'); i('pc2', 'eth0', '200.0.1.10');
  t = ok(configurarGateway(t, 'pc1', '192.168.1.1')); t = ok(configurarGateway(t, 'pc2', '200.0.1.1'));
  t = ok(adicionarRotaEstatica(t, 'r1', { rede: '0.0.0.0', mascara: '/0', via: '200.0.0.1' }));
  return t;
}
const nat = (t, dentro = 'gi0', fora = 'gi1') => ok(configurarNat(t, 'r1', { dentro, fora }));
const ping = (t, de, ip) => criarSimulacao(t).ping(de, lerIPv4(ip));

test('sem NAT o pacote chega, mas a resposta não volta (o provedor não conhece a rede privada)', () => {
  const r = ping(base(), 'pc1', '200.0.1.10');
  assert.equal(r.status, 'timeout');
  assert.equal(r.ida.status, 'entregue');
  assert.equal(r.volta.status, 'rede-inalcancavel');
});

test('com NAT o ping funciona e o servidor enxerga o IP de fora do roteador', () => {
  const r = ping(nat(base()), 'pc1', '200.0.1.10');
  assert.equal(r.status, 'entregue');
  assert.deepEqual(r.traducoes, [{ d: 'r1', de: lerIPv4('192.168.1.10'), para: lerIPv4('200.0.0.2') }]);
  assert.equal(formatarIPv4(r.ida.origemVista), '200.0.0.2');
});

test('TTL da resposta: servidor (128) menos 2 roteadores de volta (r2 e r1)', () => {
  assert.equal(ping(nat(base()), 'pc1', '200.0.1.10').ttl, 126);
});

test('NAT com os lados trocados bloqueia o tráfego que sai', () => {
  const r = ping(nat(base(), 'gi1', 'gi0'), 'pc1', '200.0.1.10');
  assert.equal(r.status, 'bloqueado');
  assert.equal(r.por, 'nat');
});

test('de fora não se alcança um computador da rede de dentro (sem redirecionamento de portas)', () => {
  let t = nat(base());
  t = ok(adicionarRotaEstatica(t, 'r2', { rede: '192.168.1.0', mascara: '/24', via: '200.0.0.2' })); // mesmo com rota no provedor
  const r = ping(t, 'pc2', '192.168.1.10');
  assert.equal(r.status, 'bloqueado');
  assert.equal(r.por, 'nat');
});

test('de fora dá para alcançar o próprio IP externo do roteador', () => {
  assert.equal(ping(nat(base()), 'pc2', '200.0.0.2').status, 'entregue');
});

test('remover o NAT volta ao comportamento anterior', () => {
  const t = ok(removerNat(nat(base()), 'r1'));
  assert.equal(ping(t, 'pc1', '200.0.1.10').status, 'timeout');
});

test('o terminal explica o bloqueio do NAT e mostra o ping normal com NAT', () => {
  const sim = criarSimulacao(nat(base(), 'gi1', 'gi0'));
  const saida = executar(sim, 'pc1', 'ping -n 1 200.0.1.10').linhas.join('\n');
  assert.match(saida, /NAT do roteador/);
  const bom = criarSimulacao(nat(base()));
  assert.match(executar(bom, 'pc1', 'ping -n 1 200.0.1.10').linhas.join('\n'), /Resposta de 200\.0\.1\.10: bytes=32/);
});

test('validações da configuração do NAT', () => {
  const t = base();
  assert.match(configurarNat(t, 'pc1', { dentro: 'gi0', fora: 'gi1' }).erro, /Só roteadores/);
  assert.match(configurarNat(t, 'r1', { dentro: 'gi0', fora: 'gi0' }).erro, /diferentes/);
  assert.match(configurarNat(t, 'r1', { dentro: 'gi0', fora: 'gi9' }).erro, /duas interfaces/);
  assert.match(removerNat(t, 'sw1').erro, /Só roteadores/);
});

test('normalização: NAT inválido ou salvo com porta inexistente é descartado', () => {
  const t = nat(base());
  assert.deepEqual(normalizarTopologia(JSON.parse(JSON.stringify(t))).dispositivos.find(d => d.id === 'r1').nat, { dentro: 'gi0', fora: 'gi1' });
  for (const ruim of [{ dentro: 'gi0', fora: 'gi0' }, { dentro: 'gi0', fora: 'zz' }, 'x', 5, [] ]) {
    const c = JSON.parse(JSON.stringify(t)); c.dispositivos.find(d => d.id === 'r1').nat = ruim;
    assert.equal(normalizarTopologia(c).dispositivos.find(d => d.id === 'r1').nat, null);
  }
});
