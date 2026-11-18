// DHCP simplificado: pool no roteador, concessão para PCs em modo automático, esgotamento, VLANs e ipconfig.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../js/sim/motor.js';
import { executar } from '../../js/sim/terminal.js';
import { lerIPv4, formatarIPv4 } from '../../js/sim/ipv4.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarPoolDhcp, configurarDhcpPc, configurarPortaSwitch, normalizarTopologia } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
// r1 (gi0 192.168.1.1/24) - sw1 - pc1, pc2, pc3 (todos DHCP)
function base(pool = ['192.168.1.100', '192.168.1.101']) {
  let t = topologiaVazia();
  for (const tipo of ['roteador', 'switch', 'pc', 'pc', 'pc']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'r1', 'sw1', 'gi0', 'fa1'));
  ['pc1', 'pc2', 'pc3'].forEach((pc, i) => { t = ok(conectar(t, pc, 'sw1', 'eth0', `fa${i + 2}`)); t = ok(configurarDhcpPc(t, pc, true)); });
  t = ok(configurarInterface(t, 'r1', 'gi0', { ip: '192.168.1.1', mascara: '/24' }));
  if (pool) t = ok(configurarPoolDhcp(t, 'r1', 'gi0', { inicio: pool[0], fim: pool[1] }));
  return t;
}
const ping = (t, de, ip) => criarSimulacao(t).ping(de, lerIPv4(ip));

test('concessões: endereços sequenciais do pool, máscara e gateway vêm da interface do roteador', () => {
  const sim = criarSimulacao(base(['192.168.1.100', '192.168.1.110']));
  const c = ['pc1', 'pc2', 'pc3'].map(id => sim.concessoes.get(id));
  assert.deepEqual(c.map(x => formatarIPv4(x.ip)), ['192.168.1.100', '192.168.1.101', '192.168.1.102']);
  assert.equal(formatarIPv4(c[0].mascara), '255.255.255.0');
  assert.equal(formatarIPv4(c[0].gateway), '192.168.1.1');
  const pc1 = sim.topologia.dispositivos.find(d => d.id === 'pc1');
  assert.equal(pc1.interfaces[0].ip, '192.168.1.100');
  assert.equal(pc1.gateway, '192.168.1.1');
});

test('os PCs com concessão se alcançam; a topologia original não é alterada', () => {
  const t = base(['192.168.1.100', '192.168.1.110']);
  assert.equal(ping(t, 'pc1', '192.168.1.101').status, 'entregue');
  assert.equal(ping(t, 'pc3', '192.168.1.1').status, 'entregue');
  assert.equal(t.dispositivos.find(d => d.id === 'pc1').interfaces[0].ip, '');
});

test('sem pool: sem servidor, sem IP e o ping falha; pool curto demais esgota para o último PC', () => {
  const sem = criarSimulacao(base(null));
  assert.deepEqual(sem.concessoes.get('pc1'), { ok: false, motivo: 'sem-servidor' });
  assert.equal(sem.ping('pc1', lerIPv4('192.168.1.1')).status, 'sem-ip');
  const curto = criarSimulacao(base());
  assert.equal(curto.concessoes.get('pc2').ok, true);
  assert.deepEqual(curto.concessoes.get('pc3'), { ok: false, motivo: 'pool-esgotado' });
});

test('IP fixo no domínio é pulado; o endereço do próprio roteador no pool também', () => {
  let t = base(['192.168.1.100', '192.168.1.103']);
  t = ok(configurarDhcpPc(t, 'pc3', false));
  t = ok(configurarInterface(t, 'pc3', 'eth0', { ip: '192.168.1.100', mascara: '/24' }));
  const sim = criarSimulacao(t);
  assert.equal(formatarIPv4(sim.concessoes.get('pc1').ip), '192.168.1.101', 'pulou o .100 fixo do pc3');
  assert.equal(sim.ping('pc1', lerIPv4('192.168.1.100')).status, 'entregue');
  let u = ok(configurarPoolDhcp(base(null), 'r1', 'gi0', { inicio: '192.168.1.1', fim: '192.168.1.2' }));
  assert.equal(formatarIPv4(criarSimulacao(u).concessoes.get('pc1').ip), '192.168.1.2');
});

test('VLAN: o servidor só atende a própria VLAN (o roteador está na VLAN 1)', () => {
  let t = base(['192.168.1.100', '192.168.1.110']);
  t = ok(configurarPortaSwitch(t, 'sw1', 'fa3', { modo: 'access', vlan: 10 }));
  const sim = criarSimulacao(t);
  assert.equal(sim.concessoes.get('pc1').ok, true);
  assert.deepEqual(sim.concessoes.get('pc2'), { ok: false, motivo: 'sem-servidor' });
});

test('pool que deixou de combinar com a interface é inválido; sem cabo não há concessão', () => {
  const t = ok(configurarInterface(base(['192.168.1.100', '192.168.1.110']), 'r1', 'gi0', { ip: '10.0.0.1', mascara: '/24' }));
  assert.deepEqual(criarSimulacao(t).concessoes.get('pc1'), { ok: false, motivo: 'pool-invalido' });
  let u = ok(adicionarDispositivo(base(), 'pc'));
  u = ok(configurarDhcpPc(u, 'pc4', true));
  assert.deepEqual(criarSimulacao(u).concessoes.get('pc4'), { ok: false, motivo: 'sem-link' });
});

test('validações do pool e do modo DHCP', () => {
  const t = base(null);
  const e = (campos, id = 'r1', porta = 'gi0', topo = t) => configurarPoolDhcp(topo, id, porta, campos).erro;
  assert.match(e({ inicio: '192.168.1.100', fim: '' }), /primeiro e o último/);
  assert.match(e({ inicio: 'x', fim: '192.168.1.5' }), /inválido/);
  assert.match(e({ inicio: '192.168.2.10', fim: '192.168.2.20' }), /não está na sub-rede/);
  assert.ok(e({ inicio: '192.168.1.0', fim: '192.168.1.5' }), 'endereço de rede não vale');
  assert.ok(e({ inicio: '192.168.1.5', fim: '192.168.1.255' }), 'broadcast não vale');
  assert.match(e({ inicio: '192.168.1.50', fim: '192.168.1.10' }), /maior que o último/);
  const grande = ok(configurarInterface(t, 'r1', 'gi1', { ip: '10.0.0.1', mascara: '/16' }));
  assert.match(e({ inicio: '10.0.0.2', fim: '10.0.9.9' }, 'r1', 'gi1', grande), /no máximo 254/);
  assert.match(e({ inicio: '10.0.0.1', fim: '10.0.0.2' }, 'r1', 'gi1'), /Configure primeiro/);
  assert.match(e({ inicio: '192.168.1.5', fim: '192.168.1.6' }, 'pc1', 'eth0'), /Só roteadores/);
  assert.match(configurarDhcpPc(t, 'r1', true).erro, /Só computadores/);
  const com = ok(configurarPoolDhcp(t, 'r1', 'gi0', { inicio: '192.168.1.10', fim: '192.168.1.20' }));
  const sem = ok(configurarPoolDhcp(com, 'r1', 'gi0', { inicio: '', fim: '' }));
  assert.deepEqual(sem.dispositivos.find(d => d.id === 'r1').pools, []);
  assert.equal(ok(configurarDhcpPc(t, 'pc1', false)).dispositivos.find(d => d.id === 'pc1').dhcp, undefined);
});

test('normalização descarta pools inválidos, duplicados e lixo', () => {
  const t = ok(configurarPoolDhcp(base(null), 'r1', 'gi0', { inicio: '192.168.1.10', fim: '192.168.1.20' }));
  const bruto = JSON.parse(JSON.stringify(t));
  const r1 = bruto.dispositivos.find(d => d.id === 'r1');
  r1.pools.push({ porta: 'gi0', inicio: '1.1.1.1', fim: '1.1.1.9' }, { porta: 'gi9', inicio: '1.1.1.1', fim: '1.1.1.9' }, { porta: 'gi1', inicio: '9.9.9.9', fim: '1.1.1.1' }, 'lixo', null);
  bruto.dispositivos.find(d => d.id === 'pc1').dhcp = 'sim';
  const n = normalizarTopologia(bruto);
  assert.deepEqual(n.dispositivos.find(d => d.id === 'r1').pools, [{ porta: 'gi0', inicio: '192.168.1.10', fim: '192.168.1.20' }]);
  assert.equal(n.dispositivos.find(d => d.id === 'pc1').dhcp, undefined, 'só true literal vale');
  assert.equal(n.dispositivos.find(d => d.id === 'pc2').dhcp, true);
});

test('ipconfig mostra DHCP, servidor e o motivo da falha; /renew só vale com DHCP ligado', () => {
  const t = base(['192.168.1.100', '192.168.1.101']);
  const sim = criarSimulacao(t);
  const todo = executar(sim, 'pc1', 'ipconfig /all').linhas.join('\n');
  assert.match(todo, /DHCP Habilitado[ .]*: Sim/);
  assert.match(todo, /Servidor DHCP[ .]*: 192\.168\.1\.1/);
  assert.match(todo, /Endereço IPv4[ .]*: 192\.168\.1\.100/);
  assert.match(executar(sim, 'pc1', 'ipconfig /renew').linhas.join('\n'), /Concessão DHCP obtida[\s\S]*192\.168\.1\.100/);
  assert.match(executar(sim, 'pc3', 'ipconfig').linhas.join('\n'), /não tem mais endereços livres/);
  assert.match(executar(sim, 'pc3', 'ipconfig /renew').linhas.join('\n'), /Operação falhou.*não tem mais endereços/);
  assert.match(executar(criarSimulacao(base(null)), 'pc1', 'ipconfig /renew').linhas.join('\n'), /Nenhum servidor DHCP respondeu/);
  const fixo = ok(configurarDhcpPc(t, 'pc1', false));
  assert.match(executar(criarSimulacao(fixo), 'pc1', 'ipconfig /renew').linhas.join('\n'), /não está habilitado para DHCP/);
  assert.match(executar(sim, 'pc1', 'ipconfig /all').linhas.join('\n'), /Gateway Padrão[ .]*: 192\.168\.1\.1/);
  assert.match(executar(sim, 'pc1', 'ipconfig /xyz').linhas[0], /Opção inválida/);
});
