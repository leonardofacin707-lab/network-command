// Console estilo Cisco IOS: modos, abreviações, configuração que muda a topologia e comandos show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { executarIos, sessaoInicial, prompt, lerInterface } from '../../js/sim/cli-ios.js';
import { criarSimulacao } from '../../js/sim/motor.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, dispositivo } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
function base() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'switch', 'roteador', 'pc']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'sw1', 'eth0', 'fa1')); t = ok(conectar(t, 'sw1', 'r1', 'fa2', 'gi0')); t = ok(conectar(t, 'r1', 'pc2', 'gi1', 'eth0'));
  t = ok(configurarInterface(t, 'pc1', 'eth0', { ip: '192.168.1.10', mascara: '/24' })); t = ok(configurarGateway(t, 'pc1', '192.168.1.1'));
  t = ok(configurarInterface(t, 'pc2', 'eth0', { ip: '10.0.0.10', mascara: '/24' })); t = ok(configurarGateway(t, 'pc2', '10.0.0.1'));
  return t;
}

/** Roda uma sequência de comandos, aplicando as mudanças de topologia como o laboratório faz. */
function console_(t, id, comandos) {
  let sessao = sessaoInicial(), saida = [];
  for (const c of comandos) {
    const r = executarIos(t, criarSimulacao(t), id, c, sessao);
    if (r.topologia) t = r.topologia;
    sessao = r.sessao; saida.push(...r.linhas);
  }
  return { t, sessao, saida: saida.join('\n') };
}

test('modos e prompts: > # (config)# (config-if)#, com abreviações e saídas', () => {
  const d = dispositivo(base(), 'r1');
  let s = sessaoInicial();
  assert.equal(prompt(d, s), 'R1>');
  const passos = [['en', 'R1#'], ['conf t', 'R1(config)#'], ['int g0/0', 'R1(config-if)#'], ['exit', 'R1(config)#'], ['interface GigabitEthernet0/1', 'R1(config-if)#'], ['end', 'R1#'], ['disable', 'R1>']];
  for (const [cmd, esperado] of passos) { s = executarIos(base(), criarSimulacao(base()), 'r1', cmd, s).sessao; assert.equal(prompt(d, s), esperado, cmd); }
});

test('configurar o roteador pelo console faz o ping entre as redes funcionar', () => {
  const r = console_(base(), 'r1', ['enable', 'configure terminal', 'hostname Borda', 'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown',
    'int g0/1', 'ip add 10.0.0.1 255.255.255.0', 'end', 'show ip interface brief', 'show ip route', 'ping 10.0.0.10']);
  assert.equal(dispositivo(r.t, 'r1').nome, 'Borda');
  assert.match(r.saida, /GigabitEthernet0\/0\s+192\.168\.1\.1\s+YES manual up/);
  assert.match(r.saida, /C\s+10\.0\.0\.0\/24 is directly connected, GigabitEthernet0\/1/);
  assert.match(r.saida, /Gateway of last resort is not set/);
  assert.match(r.saida, /!!!!!\nSuccess rate is 100 percent \(5\/5\)/);
  assert.equal(criarSimulacao(r.t).ping('pc1', 0x0A00000A).status, 'entregue');
});

test('rotas estáticas: ip route, rota padrão marcada com *, no ip route e erros do IOS', () => {
  let r = console_(base(), 'r1', ['en', 'conf t', 'int g0/1', 'ip address 10.0.0.1 255.255.255.0', 'exit', 'ip route 0.0.0.0 0.0.0.0 10.0.0.254', 'ip route 172.16.0.0 255.255.0.0 10.0.0.2', 'do show ip route']);
  assert.match(r.saida, /Gateway of last resort is 10\.0\.0\.254 to network 0\.0\.0\.0/);
  assert.match(r.saida, /S\*\s+0\.0\.0\.0\/0 \[1\/0\] via 10\.0\.0\.254/);
  assert.match(r.saida, /S\s+172\.16\.0\.0\/16 \[1\/0\] via 10\.0\.0\.2/);
  assert.equal(dispositivo(r.t, 'r1').rotas.length, 2);
  r = console_(r.t, 'r1', ['en', 'conf t', 'no ip route 172.16.0.0 255.255.0.0 10.0.0.2', 'no ip route 1.0.0.0 255.0.0.0 10.0.0.2', 'ip route 9.9.9.0', 'xyz', 'end', 'show running-config']);
  assert.equal(dispositivo(r.t, 'r1').rotas.length, 1);
  assert.match(r.saida, /% Rota não encontrada/);
  assert.match(r.saida, /% Incomplete command/);
  assert.match(r.saida, /% Invalid input detected/);
  assert.match(r.saida, /hostname R1\n!\ninterface GigabitEthernet0\/0\n no ip address[\s\S]*ip route 0\.0\.0\.0 0\.0\.0\.0 10\.0\.0\.254\n!\nend/);
});

test('switch: VLAN por porta, trunk, show vlan brief; sem IP nem rotas', () => {
  const r = console_(base(), 'sw1', ['en', 'conf t', 'int f0/1', 'switchport mode access', 'switchport access vlan 10', 'int fa0/3', 'sw mode trunk', 'end', 'show vlan brief', 'conf t', 'int f0/1', 'ip address 1.1.1.1 255.0.0.0']);
  const sw = dispositivo(r.t, 'sw1');
  assert.deepEqual(sw.portas.fa1, { modo: 'access', vlan: 10 });
  assert.equal(sw.portas.fa3.modo, 'trunk');
  assert.match(r.saida, /10\s+VLAN0010\s+active\s+Fa0\/1/);
  assert.match(r.saida, /1\s+default\s+active\s+Fa0\/2, Fa0\/4/);
  assert.match(r.saida, /switch não tem IP/);
});

test('validações: running-config só no privilegiado, interface inexistente, hostname inválido, ajuda', () => {
  const r = console_(base(), 'r1', ['show running-config', 'en', 'conf t', 'interface g0/5', 'hostname @invalido', '?']);
  assert.match(r.saida, /só no modo privilegiado/);
  assert.match(r.saida, /Interface inexistente neste roteador\. Existem: Gi0\/0, Gi0\/1/);
  assert.match(r.saida, /% Nome inválido/);
  assert.match(r.saida, /ip route REDE MÁSCARA PRÓXIMO-SALTO/);
  assert.equal(lerInterface(dispositivo(base(), 'sw1'), 'FastEthernet0/8'), 'fa8');
  assert.equal(lerInterface(dispositivo(base(), 'sw1'), 'g0/1'), null);
  assert.match(executarIos(base(), criarSimulacao(base()), 'pc1', 'en').linhas[0], /não tem console IOS/);
});
