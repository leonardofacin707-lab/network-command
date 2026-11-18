import test from 'node:test';
import assert from 'node:assert/strict';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway } from '../../js/sim/topologia.js';
import { diagnosticar } from '../../js/sim/diagnostico.js';

const add = (t, tipo) => adicionarDispositivo(t, tipo).topologia;
const cfg = (t, id, i, m = '/24') => configurarInterface(t, id, 'eth0', { ip: i, mascara: m }).topologia;

test('topologia vazia ou correta não gera avisos', () => {
  assert.deepEqual(diagnosticar(topologiaVazia()), []);
  let t = ['pc', 'pc', 'switch'].reduce(add, topologiaVazia());
  t = conectar(conectar(t, 'pc1', 'sw1').topologia, 'pc2', 'sw1').topologia;
  t = cfg(cfg(t, 'pc1', '192.168.1.10'), 'pc2', '192.168.1.20');
  assert.deepEqual(diagnosticar(t), []);
});

test('avisa PC sem cabo, ligado sem IP, gateway fora da sub-rede e conflito de IP', () => {
  let t = ['pc', 'pc', 'pc', 'switch'].reduce(add, topologiaVazia());
  t = conectar(conectar(t, 'pc1', 'sw1').topologia, 'pc2', 'sw1').topologia;
  t = cfg(t, 'pc1', '192.168.1.10');
  t = cfg(t, 'pc3', '192.168.1.10');
  t = configurarGateway(t, 'pc1', '10.0.0.1').topologia;
  const textos = diagnosticar(t).map(a => a.texto);
  assert.ok(textos.some(x => /PC3 está sem cabo/.test(x)));
  assert.ok(textos.some(x => /PC2 está ligado, mas.*não tem IP/.test(x)));
  assert.ok(textos.some(x => /gateway de PC1 \(10\.0\.0\.1\) está fora/.test(x)));
  t = conectar(t, 'pc3', 'sw1').topologia;
  assert.ok(diagnosticar(t).some(a => /Conflito de IP: PC1 e PC3 usam 192\.168\.1\.10/.test(a.texto)));
});
