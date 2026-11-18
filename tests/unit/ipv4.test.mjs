import test from 'node:test';
import assert from 'node:assert/strict';
import { lerIPv4, formatarIPv4, mascaraDePrefixo, prefixoDeMascara, lerMascara, enderecoDeRede, enderecoDeBroadcast, mesmaRede, hostsUteis, classeDe, validarEnderecoDeHost } from '../../js/sim/ipv4.js';

test('lerIPv4 aceita só endereços bem formados', () => {
  assert.equal(lerIPv4('192.168.1.10'), 3232235786);
  assert.equal(lerIPv4('0.0.0.0'), 0);
  assert.equal(lerIPv4('255.255.255.255'), 4294967295);
  assert.equal(lerIPv4(' 10.0.0.1 '), 167772161);
  for (const ruim of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', '1.2.3.-4', '01.2.3.4', '1.2.3.04', 'a.b.c.d', '1..2.3', '1.2.3.4 5', '1,2,3,4', null, undefined, 42]) {
    assert.equal(lerIPv4(ruim), null, String(ruim));
  }
});

test('formatarIPv4 é o inverso de lerIPv4', () => {
  for (const ip of ['0.0.0.0', '10.1.2.3', '172.16.0.1', '192.168.255.254', '255.255.255.255']) assert.equal(formatarIPv4(lerIPv4(ip)), ip);
});

test('máscaras: prefixo <-> decimal pontuado', () => {
  assert.equal(formatarIPv4(mascaraDePrefixo(24)), '255.255.255.0');
  assert.equal(formatarIPv4(mascaraDePrefixo(26)), '255.255.255.192');
  assert.equal(mascaraDePrefixo(0), 0);
  assert.equal(mascaraDePrefixo(32), 4294967295);
  for (let p = 0; p <= 32; p++) assert.equal(prefixoDeMascara(mascaraDePrefixo(p)), p);
  assert.equal(prefixoDeMascara(lerIPv4('255.0.255.0')), null);
  assert.equal(prefixoDeMascara(lerIPv4('255.255.255.1')), null);
});

test('lerMascara aceita decimal e prefixo, rejeita o resto', () => {
  assert.equal(lerMascara('255.255.255.0'), mascaraDePrefixo(24));
  assert.equal(lerMascara('/24'), mascaraDePrefixo(24));
  assert.equal(lerMascara('24'), mascaraDePrefixo(24));
  assert.equal(lerMascara('255.255.0.0'), mascaraDePrefixo(16));
  for (const ruim of ['255.0.255.0', '/33', '33', '255.255.255', 'abc', '', null, '-1']) assert.equal(lerMascara(ruim), null, String(ruim));
});

test('rede, broadcast e mesma rede', () => {
  const ip = lerIPv4('192.168.10.77'), m = mascaraDePrefixo(26);
  assert.equal(formatarIPv4(enderecoDeRede(ip, m)), '192.168.10.64');
  assert.equal(formatarIPv4(enderecoDeBroadcast(ip, m)), '192.168.10.127');
  assert.ok(mesmaRede(ip, lerIPv4('192.168.10.100'), m));
  assert.ok(!mesmaRede(ip, lerIPv4('192.168.10.130'), m));
  assert.ok(!mesmaRede(ip, lerIPv4('192.168.10.10'), m), '.10 está na sub-rede .0/26, não na .64/26');
});

test('hosts úteis e classes', () => {
  assert.equal(hostsUteis(mascaraDePrefixo(24)), 254);
  assert.equal(hostsUteis(mascaraDePrefixo(30)), 2);
  assert.equal(hostsUteis(mascaraDePrefixo(26)), 62);
  assert.equal(hostsUteis(mascaraDePrefixo(31)), 0);
  assert.deepEqual(['10.0.0.1', '128.0.0.1', '191.255.0.1', '192.0.0.1', '223.1.1.1', '224.0.0.1', '240.0.0.1'].map(x => classeDe(lerIPv4(x))), ['A', 'B', 'B', 'C', 'C', 'D', 'E']);
});

test('validarEnderecoDeHost', () => {
  const m24 = mascaraDePrefixo(24);
  const ok = (ip, m = m24) => validarEnderecoDeHost(lerIPv4(ip), m);
  assert.equal(ok('192.168.1.10'), null);
  assert.equal(ok('10.0.0.1', mascaraDePrefixo(8)), null);
  assert.match(ok('192.168.1.0'), /endereço de rede/);
  assert.match(ok('192.168.1.255'), /broadcast/);
  assert.match(ok('127.0.0.1'), /loopback/);
  assert.match(ok('0.1.2.3'), /0\.x/);
  assert.match(ok('224.0.0.5'), /multicast/);
  assert.match(ok('192.168.1.10', mascaraDePrefixo(31)), /fora do que/);
  assert.match(ok('192.168.1.10', mascaraDePrefixo(4)), /fora do que/);
  assert.match(validarEnderecoDeHost(null, m24), /IPv4 inválido/);
  assert.match(validarEnderecoDeHost(lerIPv4('1.1.1.1'), null), /Máscara inválida/);
  assert.equal(validarEnderecoDeHost(lerIPv4('192.168.1.64'), mascaraDePrefixo(26)), 'Esse é o endereço de rede da sub-rede, não de um host.');
  assert.equal(validarEnderecoDeHost(lerIPv4('192.168.1.127'), mascaraDePrefixo(26)), 'Esse é o endereço de broadcast da sub-rede, não de um host.');
});
