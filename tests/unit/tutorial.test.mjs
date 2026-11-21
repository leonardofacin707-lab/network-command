// Tutorial guiado: os passos são verificados no modelo e o ping pelo simulador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cenarioTutorial, situacaoTutorial, comandoEhPing, PASSOS } from '../../js/tutorial/passos.js';
import { conectar, configurarInterface } from '../../js/sim/topologia.js';

const passo = (r) => { assert.equal(r.erro, undefined, r.erro); return r.topologia; };

test('cenário começa sem cabos e sem endereços; o primeiro passo é o cabo do PC1', () => {
  const s = situacaoTutorial(cenarioTutorial());
  assert.equal(s.atual, 'cabo1');
  assert.equal(s.concluido, false);
  assert.equal(s.passos.length, PASSOS.length);
});

test('passos na ordem até o ping confirmado pelo simulador', () => {
  let t = cenarioTutorial();
  t = passo(conectar(t, 'pc1', 'sw1', 'eth0', 'fa1'));
  assert.equal(situacaoTutorial(t).atual, 'cabo2');
  t = passo(conectar(t, 'pc2', 'sw1', 'eth0', 'fa2'));
  assert.equal(situacaoTutorial(t).atual, 'ip1');
  t = passo(configurarInterface(t, 'pc1', 'eth0', { ip: '192.168.1.10', mascara: '255.255.255.0' }));
  assert.equal(situacaoTutorial(t).atual, 'ip2');
  const fora = passo(configurarInterface(t, 'pc2', 'eth0', { ip: '10.0.0.20', mascara: '255.255.255.0' }));
  assert.equal(situacaoTutorial(fora).atual, 'ip2', 'rede diferente não vale');
  const igual = passo(configurarInterface(t, 'pc2', 'eth0', { ip: '192.168.1.10', mascara: '255.255.255.0' }));
  assert.equal(situacaoTutorial(igual).atual, 'ip2', 'endereço repetido não vale');
  t = passo(configurarInterface(t, 'pc2', 'eth0', { ip: '192.168.1.20', mascara: '255.255.255.0' }));
  assert.equal(situacaoTutorial(t).atual, 'ping');
  assert.equal(situacaoTutorial(t, { pingou: false }).concluido, false, 'precisa rodar o ping no terminal');
  assert.equal(situacaoTutorial(t, { pingou: true }).concluido, true);
});

test('a ordem importa: endereço sem cabo não pula passos', () => {
  const t = passo(configurarInterface(cenarioTutorial(), 'pc1', 'eth0', { ip: '192.168.1.10', mascara: '/24' }));
  const s = situacaoTutorial(t);
  assert.equal(s.atual, 'cabo1');
  assert.equal(s.passos.find(p => p.id === 'ip1').ok, false);
});

test('comandoEhPing', () => {
  assert.ok(comandoEhPing('ping 192.168.1.20'));
  assert.ok(comandoEhPing('  PING -6 x'));
  assert.equal(comandoEhPing('ipconfig'), false);
  assert.equal(comandoEhPing('tracert 1.1.1.1'), false);
});
