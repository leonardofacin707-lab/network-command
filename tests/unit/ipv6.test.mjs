// IPv6 no simulador: endereços, link-local EUI-64, descoberta de vizinhos, roteamento, SLAAC, rotas estáticas e captura.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerIPv6, formatarIPv6, completoIPv6, lerPrefixo6, mesmaRede6, linkLocalDe, idEui64, solicitedNode, tipoIPv6 } from '../../js/sim/ipv6.js';
import { criarSimulacao, macDe } from '../../js/sim/motor.js';
import { enderecosDaInterface, conflitos6, primeiroGlobal6 } from '../../js/sim/motor6.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface6, configurarGateway6, configurarSlaac, configurarRoteamento6,
  adicionarRota6, removerRota6, configurarInterface, normalizarTopologia, dispositivo, removerCabo } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
const v6 = lerIPv6;

test('endereços: leitura, forma canônica, prefixo, tipos, EUI-64 e solicited-node', () => {
  assert.equal(formatarIPv6(v6('2001:0DB8:0000:0000:0000:0000:0000:0001')), '2001:db8::1');
  assert.equal(completoIPv6(v6('2001:db8::1')), '2001:0db8:0000:0000:0000:0000:0000:0001');
  for (const ruim of ['', '2001:db8::1::2', '2001:db8:1', 'gggg::1', '12345::1', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7::8:9']) assert.equal(v6(ruim), null, ruim);
  assert.equal(v6('::'), 0n); assert.equal(v6('::1'), 1n);
  assert.equal(lerPrefixo6('/64'), 64); assert.equal(lerPrefixo6('129'), null);
  assert.ok(mesmaRede6(v6('2001:db8:1::10'), v6('2001:db8:1::ffff'), 64));
  assert.ok(!mesmaRede6(v6('2001:db8:1::10'), v6('2001:db8:2::10'), 64));
  assert.deepEqual(['fe80::1', 'ff02::1', '2001:db8::1', 'fd00::1', '::1'].map(x => tipoIPv6(v6(x))), ['link-local', 'multicast', 'global unicast', 'local única (ULA)', 'loopback']);
  assert.equal(formatarIPv6(idEui64('02-00-aa-bb-cc-dd')), '::aaff:febb:ccdd', 'inverte o bit U/L (02 → 00) e insere ff:fe no meio');
  assert.equal(formatarIPv6(linkLocalDe('02-00-aa-bb-cc-dd')), 'fe80::aaff:febb:ccdd');
  assert.equal(formatarIPv6(solicitedNode(v6('2001:db8::12:3456'))), 'ff02::1:ff12:3456');
});

// pc1 - sw1 - r1 - pc2 (+ pc3 em sw1)
function base({ roteia = true } = {}) {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'switch', 'roteador', 'pc']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'sw1', 'eth0', 'fa1')); t = ok(conectar(t, 'sw1', 'r1', 'fa2', 'gi0')); t = ok(conectar(t, 'r1', 'pc2', 'gi1', 'eth0')); t = ok(conectar(t, 'pc3', 'sw1', 'eth0', 'fa3'));
  t = ok(configurarInterface6(t, 'r1', 'gi0', { ip6: '2001:db8:1::1', prefixo6: '64' }));
  t = ok(configurarInterface6(t, 'r1', 'gi1', { ip6: '2001:db8:2::1/64' }));
  t = ok(configurarInterface6(t, 'pc1', 'eth0', { ip6: '2001:db8:1::10', prefixo6: '/64' })); t = ok(configurarGateway6(t, 'pc1', '2001:db8:1::1'));
  t = ok(configurarInterface6(t, 'pc2', 'eth0', { ip6: '2001:db8:2::10', prefixo6: '64' }));
  t = ok(configurarGateway6(t, 'pc2', `${formatarIPv6(linkLocalDe(macDe('r1', 'gi1')))}`)); // gateway pelo link-local, como o RA entrega
  if (roteia) t = ok(configurarRoteamento6(t, 'r1', true));
  return t;
}
const ping6 = (t, de, ip) => criarSimulacao(t).ping6(de, v6(ip));

test('mesma rede: o ping IPv6 funciona sem roteador, inclusive pelo link-local', () => {
  let t = ok(configurarInterface6(base(), 'pc3', 'eth0', { ip6: '2001:db8:1::30/64' }));
  assert.equal(ping6(t, 'pc1', '2001:db8:1::30').status, 'entregue');
  const llR1 = formatarIPv6(linkLocalDe(macDe('r1', 'gi0')));
  assert.equal(ping6(t, 'pc1', llR1).status, 'entregue');
  assert.equal(ping6(t, 'pc1', '2001:db8:1::30').ttl, 128);
});

test('entre redes: sem "ipv6 unicast-routing" o roteador descarta; com ele o ping vai e volta (hop limit 127)', () => {
  const r0 = ping6(base({ roteia: false }), 'pc1', '2001:db8:2::10');
  assert.equal(r0.status, 'sem-roteamento6');
  const r = ping6(base(), 'pc1', '2001:db8:2::10');
  assert.equal(r.status, 'entregue');
  assert.equal(r.ttl, 127);
  assert.deepEqual(r.saltos.map(s => formatarIPv6(s.ip)), ['2001:db8:1::1']);
});

test('erros do host: sem endereço global, sem gateway, gateway fora da rede, sem cabo e vizinho inexistente', () => {
  let t = base();
  t = ok(configurarGateway6(t, 'pc1', ''));
  assert.equal(ping6(t, 'pc1', '2001:db8:2::10').status, 'sem-rota');
  t = ok(configurarGateway6(t, 'pc1', '2001:db8:9::1'));
  assert.equal(ping6(t, 'pc1', '2001:db8:2::10').status, 'gateway-fora');
  assert.equal(ping6(base(), 'pc3', '2001:db8:2::10').status, 'sem-ip', 'pc3 só tem link-local');
  assert.equal(ping6(base(), 'pc1', '2001:db8:1::99').status, 'arp-falhou', 'ninguém responde à Neighbor Solicitation');
  const sem = ok(removerCabo(base(), base().cabos.find(c => c.a.d === 'pc1' || c.b.d === 'pc1').id));
  assert.equal(ping6(sem, 'pc1', '2001:db8:1::1').status, 'sem-link');
});

test('SLAAC: com RA o PC monta o endereço EUI-64 e usa o link-local do roteador como gateway; sem RA ou sem /64 não', () => {
  const t = ok(configurarSlaac(base(), 'pc3', true));
  const sim = criarSimulacao(t);
  const a = sim.slaac.get('pc3');
  assert.equal(a.ok, true);
  assert.equal(formatarIPv6(a.ip), formatarIPv6(v6('2001:db8:1::') | idEui64(macDe('pc3', 'eth0'))));
  assert.equal(dispositivo(sim.topologia, 'pc3').gateway6, formatarIPv6(linkLocalDe(macDe('r1', 'gi0'))));
  assert.equal(sim.ping6('pc3', v6('2001:db8:2::10')).status, 'entregue');
  assert.equal('ip6' in dispositivo(t, 'pc3').interfaces[0], false, 'o modelo salvo não muda');
  assert.equal(criarSimulacao(ok(configurarRoteamento6(t, 'r1', false))).slaac.get('pc3').motivo, 'sem-ra');
  assert.equal(criarSimulacao(ok(configurarInterface6(t, 'r1', 'gi0', { ip6: '2001:db8:1::1/48' }))).slaac.get('pc3').motivo, 'prefixo-nao-64');
});

test('rotas estáticas IPv6 entre dois roteadores, rota padrão ::/0 e validações', () => {
  let t = base();
  t = ok(adicionarDispositivo(t, 'roteador')); t = ok(adicionarDispositivo(t, 'pc'));
  t = ok(removerCabo(t, t.cabos.find(c => c.a.d === 'pc2' || c.b.d === 'pc2').id));
  t = ok(conectar(t, 'r1', 'r2', 'gi1', 'gi0')); t = ok(conectar(t, 'r2', 'pc4', 'gi1', 'eth0'));
  t = ok(configurarInterface6(t, 'r2', 'gi0', { ip6: '2001:db8:2::2/64' })); t = ok(configurarInterface6(t, 'r2', 'gi1', { ip6: '2001:db8:3::1/64' }));
  t = ok(configurarRoteamento6(t, 'r2', true));
  t = ok(configurarInterface6(t, 'pc4', 'eth0', { ip6: '2001:db8:3::40/64' })); t = ok(configurarGateway6(t, 'pc4', '2001:db8:3::1'));
  assert.equal(ping6(t, 'pc1', '2001:db8:3::40').status, 'rede-inalcancavel');
  t = ok(adicionarRota6(t, 'r1', { rede: '2001:db8:3::', prefixo: '64', via: '2001:db8:2::2' }));
  assert.equal(ping6(t, 'pc1', '2001:db8:3::40').status, 'timeout', 'a volta ainda não tem rota');
  t = ok(adicionarRota6(t, 'r2', { rede: '::/0', via: '2001:db8:2::1' }));
  const r = ping6(t, 'pc1', '2001:db8:3::40');
  assert.equal(r.status, 'entregue'); assert.equal(r.ttl, 126);
  assert.match(adicionarRota6(t, 'r1', { rede: '2001:db8:3::1', prefixo: '64', via: '2001:db8:2::2' }).erro, /a rede seria 2001:db8:3::/);
  assert.match(adicionarRota6(t, 'r1', { rede: '2001:db8:4::', prefixo: '64', via: '2001:db8:9::2' }).erro, /rede ligada/);
  assert.match(adicionarRota6(t, 'r1', { rede: '2001:db8:3::', prefixo: '64', via: '2001:db8:2::2' }).erro, /Já existe/);
  assert.equal(dispositivo(ok(removerRota6(t, 'r2', 0)), 'r2').rotas6, undefined);
});

test('validações de endereço, DAD (conflito) e IPv4 continua intacto ao mexer no IPv6', () => {
  const t = base();
  const erro = x => configurarInterface6(t, 'pc3', 'eth0', x).erro;
  assert.match(erro({ ip6: 'fe80::5', prefixo6: '64' }), /link-local/);
  assert.match(erro({ ip6: 'ff02::1', prefixo6: '64' }), /multicast/);
  assert.match(erro({ ip6: '2001:db8:1::', prefixo6: '64' }), /próprio prefixo/);
  assert.match(erro({ ip6: '2001:db8:1::5', prefixo6: '' }), /Prefixo IPv6 inválido/);
  assert.match(erro({ ip6: '2001:zz::5', prefixo6: '64' }), /inválido/);
  const dup = ok(configurarInterface6(t, 'pc3', 'eth0', { ip6: '2001:db8:1::10/64' }));
  assert.equal(conflitos6(dup).length, 1);
  assert.equal(ping6(dup, 'pc1', '2001:db8:2::10').status, 'timeout', 'a resposta volta para o endereço duplicado: o roteador recebe dois Neighbor Advertisements');
  assert.equal(ping6(ok(configurarInterface6(t, 'pc3', 'eth0', { ip6: '2001:db8:1::1/64' })), 'pc1', '2001:db8:2::10').status, 'conflito-ip');
  const com4 = ok(configurarInterface(t, 'pc1', 'eth0', { ip: '192.168.1.10', mascara: '/24' }));
  assert.equal(dispositivo(com4, 'pc1').interfaces[0].ip6, '2001:db8:1::10', 'configurar o IPv4 não apaga o IPv6');
  assert.equal(enderecosDaInterface(dispositivo(t, 'r1'), 'gi0').length, 2);
  assert.equal(formatarIPv6(primeiroGlobal6(dispositivo(t, 'pc2'))), '2001:db8:2::10');
});

test('captura: Neighbor Solicitation para o solicited-node, Advertisement e ICMPv6 com hop limit caindo', () => {
  const sim = criarSimulacao(base());
  const { pacotes } = sim.capturar(() => sim.ping6('pc1', v6('2001:db8:2::10')));
  assert.match(pacotes[0].info, /Neighbor Solicitation: quem tem 2001:db8:1::1\?/);
  assert.match(pacotes[0].para, /ff02::1:ff00:1/);
  assert.match(pacotes[0].macDestino, /^33-33-ff-00-00-01$/);
  assert.match(pacotes[1].info, /Neighbor Advertisement/);
  const ecos = pacotes.filter(p => /Echo/.test(p.info));
  assert.deepEqual(ecos.map(p => p.ttl), [128, 127, 128, 127], 'o roteador diminui o hop limit do pacote');
  assert.equal(ecos[0].ipOrigem, '2001:db8:1::10');
  assert.equal(sim.vizinhos6('pc1').length, 1);
  assert.equal(sim.tabelaArp('pc1').length, 0, 'a tabela ARP (IPv4) não mistura vizinhos IPv6');
});

test('normalização guarda IPv6, gateway, SLAAC, rotas e ipv6 unicast-routing; descarta o inválido', () => {
  const t = ok(adicionarRota6(ok(configurarSlaac(base(), 'pc3', true)), 'r1', { rede: '::/0', via: '2001:db8:2::99' }));
  const n = normalizarTopologia(JSON.parse(JSON.stringify(t)));
  assert.deepEqual(n, t);
  const c = JSON.parse(JSON.stringify(t));
  Object.assign(c.dispositivos.find(d => d.id === 'pc1').interfaces[0], { ip6: 'fe80::1', prefixo6: 64 });
  c.dispositivos.find(d => d.id === 'r1').rotas6.push({ rede: 'xx', prefixo: 64, via: '::1' });
  c.dispositivos.find(d => d.id === 'r1').ipv6Roteamento = 'sim';
  const m = normalizarTopologia(c);
  assert.equal(m.dispositivos.find(d => d.id === 'pc1').interfaces[0].ip6, undefined);
  assert.equal(m.dispositivos.find(d => d.id === 'r1').rotas6.length, 1);
  assert.equal(m.dispositivos.find(d => d.id === 'r1').ipv6Roteamento, undefined);
});

import { executar } from '../../js/sim/terminal.js';
test('terminal: ipconfig mostra IPv6 e link-local; ping e tracert IPv6; vizinhos; SLAAC sem RA explicado', () => {
  const sim = criarSimulacao(base());
  const run = l => executar(sim, 'pc1', l).linhas.join('\n');
  assert.match(run('ipconfig'), /Endereço IPv6[ .]*: 2001:db8:1::10\/64[\s\S]*Endereço IPv6 de link local[ .]*: fe80::[0-9a-f:]+%1[\s\S]*Gateway Padrão[ .]*: 2001:db8:1::1/);
  assert.match(run('ping -n 1 2001:db8:2::10'), /Resposta de 2001:db8:2::10: tempo<1ms[\s\S]*Recebidos = 1/);
  assert.match(run('ping -n 1 -6 PC2'), /Disparando contra PC2 \[2001:db8:2::10\]/);
  assert.match(run('tracert 2001:db8:2::10'), /1    <1 ms    <1 ms    <1 ms  2001:db8:1::1\n  2    <1 ms    <1 ms    <1 ms  2001:db8:2::10/);
  assert.match(run('netsh interface ipv6 show neighbors'), /2001:db8:1::1\s+02-00-/);
  assert.equal(sim.tabelaArp('pc1').length, 0);
  const semRota = criarSimulacao(base({ roteia: false }));
  assert.match(executar(semRota, 'pc1', 'ping -n 1 2001:db8:2::10').linhas.join('\n'), /Esgotado o tempo limite/);
  const slaac = criarSimulacao(ok(configurarSlaac(base({ roteia: false }), 'pc3', true)));
  assert.match(executar(slaac, 'pc3', 'ipconfig').linhas.join('\n'), /nenhum roteador anunciou um prefixo IPv6/);
  assert.match(run('ping -n 1 2001:db8:1::99'), /ninguém respondeu à Neighbor Solicitation/);
});
