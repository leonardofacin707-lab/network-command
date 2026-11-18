import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarMissoes } from '../../js/missoes/catalogo.js';
import { verificarMissao, calcularXp, validarMissao, ipDoDispositivo } from '../../js/missoes/verificar.js';
import { formatarIPv4 } from '../../js/sim/ipv4.js';
import { conectar, configurarInterface, configurarGateway } from '../../js/sim/topologia.js';

const bruto = JSON.parse(readFileSync(new URL('../../data/missions.json', import.meta.url), 'utf8'));
const missoes = montarMissoes(bruto);
const m = id => missoes.find(x => x.id === id);
const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };

test('os dados das missões são válidos e nenhuma foi descartada', () => {
  assert.equal(missoes.length, bruto.length);
  assert.equal(new Set(missoes.map(x => x.id)).size, missoes.length);
  for (const x of missoes) {
    assert.ok(x.dicas.length >= 1, `${x.id}: sem dicas`);
    assert.ok(x.objetivos.length >= 1);
  }
});

test('toda missão começa quebrada (nenhum objetivo trivialmente cumprido por todos)', () => {
  for (const x of missoes) {
    const r = verificarMissao(x, x.topologia);
    assert.equal(r.todosOk, false, `${x.id} já começa resolvida`);
    assert.ok(r.objetivos.some(o => !o.ok && o.motivo), `${x.id}: falta motivo`);
  }
});

test('cabo esquecido: ligar o PC3 ao switch resolve', () => {
  const x = m('cabo-esquecido');
  const t = ok(conectar(x.topologia, 'pc3', 'sw1'));
  assert.equal(verificarMissao(x, t).todosOk, true);
});

test('IP duplicado: trocar o IP de um deles resolve; trocar para outra rede não', () => {
  const x = m('ip-duplicado');
  const bom = ok(configurarInterface(x.topologia, 'pc3', 'eth0', { ip: '192.168.1.55', mascara: '/24' }));
  assert.equal(verificarMissao(x, bom).todosOk, true);
  const ruim = ok(configurarInterface(x.topologia, 'pc3', 'eth0', { ip: '172.16.0.5', mascara: '/24' }));
  assert.equal(verificarMissao(x, ruim).todosOk, false, 'outra sub-rede sem gateway não alcança');
});

test('máscara errada: a falha é de volta (timeout) e corrigir a máscara resolve', () => {
  const x = m('mascara-errada');
  const antes = verificarMissao(x, x.topologia);
  assert.equal(antes.objetivos[0].ok, false);
  assert.match(antes.objetivos[0].motivo, /resposta não voltou/);
  const t = ok(configurarInterface(x.topologia, 'pc2', 'eth0', { ip: '192.168.1.200', mascara: '255.255.255.0' }));
  assert.equal(verificarMissao(x, t).todosOk, true);
});

test('gateway errado: corrigir o gateway do PC1 resolve', () => {
  const x = m('gateway-errado');
  assert.equal(verificarMissao(x, x.topologia).todosOk, false);
  assert.equal(verificarMissao(x, ok(configurarGateway(x.topologia, 'pc1', '192.168.1.1'))).todosOk, true);
  assert.equal(verificarMissao(x, ok(configurarGateway(x.topologia, 'pc1', '192.168.1.2'))).todosOk, false, 'gateway que não é o roteador não serve');
});

test('roteador sem IP em uma interface: configurar gi1 resolve', () => {
  const x = m('interface-sem-ip');
  const t = ok(configurarInterface(x.topologia, 'r1', 'gi1', { ip: '10.0.0.1', mascara: '/24' }));
  assert.equal(verificarMissao(x, t).todosOk, true);
  const errado = ok(configurarInterface(x.topologia, 'r1', 'gi1', { ip: '10.0.1.1', mascara: '/24' }));
  assert.equal(verificarMissao(x, errado).todosOk, false);
});

test('XP: cada dica tira 20%, com piso de 40%', () => {
  assert.equal(calcularXp(100, 0), 100);
  assert.equal(calcularXp(100, 1), 80);
  assert.equal(calcularXp(250, 2), 150);
  assert.equal(calcularXp(100, 3), 40);
  assert.equal(calcularXp(100, 9), 40);
});

test('validarMissao rejeita lixo e descarta objetivos inexistentes', () => {
  assert.equal(validarMissao(null), null);
  assert.equal(validarMissao({ id: 'Maiúscula!', titulo: 'a', cenario: 'b' }), null);
  const base = bruto[0];
  assert.equal(validarMissao({ ...base, topologia: { dispositivos: [], cabos: [] } }), null);
  assert.equal(validarMissao({ ...base, objetivos: [{ id: 'x', de: 'zz', para: 'pc1' }] }), null);
  const v = validarMissao({ ...base, xp: 99999, dificuldade: 9, dicas: ['a', 3] });
  assert.equal(v.xp, 100);
  assert.equal(v.dificuldade, 1);
  assert.deepEqual(v.dicas, ['a']);
  assert.equal(montarMissoes('lixo').length, 0);
  assert.equal(montarMissoes([bruto[0], bruto[0]]).length, 1, 'id repetido');
});

test('ipDoDispositivo devolve o primeiro IP configurado ou null', () => {
  const x = m('interface-sem-ip');
  assert.equal(formatarIPv4(ipDoDispositivo(x.topologia, 'pc1')), '192.168.1.10');
  assert.equal(ipDoDispositivo(x.topologia, 'sw1'), null);
  assert.equal(ipDoDispositivo(x.topologia, 'nada'), null);
});

// ---- Campus de Redes (missões com VLAN) ----
import { configurarPortaSwitch } from '../../js/sim/topologia.js';
const porta = (t, sw, p, modo, vlan) => ok(configurarPortaSwitch(t, sw, p, { modo, vlan }));
const feito = (x, t) => verificarMissao(x, t).objetivos.map(o => o.ok);

test('campus: 4 missões, separadas das missões comuns', () => {
  assert.deepEqual(missoes.filter(x => x.modulo === 'campus').map(x => x.id), ['porta-na-vlan-errada', 'trunk-esquecido', 'vlans-sem-gateway', 'campus-completo']);
  assert.equal(missoes.filter(x => x.modulo === 'missoes').length, 5);
  assert.equal(validarMissao({ ...bruto[0], modulo: 'qualquer' }).modulo, 'missoes', 'módulo desconhecido vira missões');
});

test('campus: porta na VLAN errada', () => {
  const x = m('porta-na-vlan-errada');
  assert.equal(verificarMissao(x, porta(x.topologia, 'sw1', 'fa3', 'access', 30)).todosOk, false, 'outra VLAN errada');
  assert.equal(verificarMissao(x, porta(x.topologia, 'sw1', 'fa3', 'access', 10)).todosOk, true);
});

test('campus: trunk esquecido exige trunk nos dois lados; access na VLAN 10 resolve só metade', () => {
  const x = m('trunk-esquecido');
  const um = porta(x.topologia, 'sw1', 'fa8', 'trunk');
  assert.equal(verificarMissao(x, um).todosOk, false, 'só um lado');
  const metade = porta(porta(x.topologia, 'sw1', 'fa8', 'access', 10), 'sw2', 'fa8', 'access', 10);
  assert.deepEqual(feito(x, metade), [true, false]);
  const ambos = porta(porta(x.topologia, 'sw1', 'fa8', 'trunk'), 'sw2', 'fa8', 'trunk');
  assert.equal(verificarMissao(x, ambos).todosOk, true);
});

test('campus: interface do roteador na VLAN errada', () => {
  const x = m('vlans-sem-gateway');
  assert.equal(verificarMissao(x, porta(x.topologia, 'sw1', 'fa8', 'access', 10)).todosOk, false);
  assert.equal(verificarMissao(x, porta(x.topologia, 'sw1', 'fa8', 'access', 20)).todosOk, true);
});

test('campus: o campus inteiro tem dois defeitos e cada correção sozinha não basta', () => {
  const x = m('campus-completo');
  const trunk = t => porta(porta(t, 'sw1', 'fa8', 'trunk'), 'sw2', 'fa8', 'trunk');
  const vlan = t => porta(t, 'sw2', 'fa2', 'access', 20);
  assert.equal(verificarMissao(x, trunk(x.topologia)).todosOk, false);
  assert.equal(verificarMissao(x, vlan(x.topologia)).todosOk, false);
  const r = verificarMissao(x, vlan(trunk(x.topologia)));
  assert.equal(r.todosOk, true, JSON.stringify(r.objetivos));
});

test('as habilidades marcadas em missões e projetos existem na árvore (trilha e nível)', () => {
  const skills = JSON.parse(readFileSync(new URL('../../data/skills.json', import.meta.url), 'utf8'));
  const emp = JSON.parse(readFileSync(new URL('../../data/empresa.json', import.meta.url), 'utf8'));
  const trilhas = new Set(skills.trilhas.map(t => t.id)), niveis = new Set(skills.niveis.map(n => n.id));
  for (const item of [...missoes, ...emp.projetos]) {
    assert.ok(item.habilidades?.length >= 1, `${item.id}: sem habilidade`);
    for (const h of item.habilidades) { const [t, n] = h.split('.'); assert.ok(trilhas.has(t) && niveis.has(n) && n !== 'teoria', `${item.id}: ${h}`); }
  }
  assert.deepEqual(validarMissao({ ...bruto[0], habilidades: ['ip.diagnostico', 'lixo', 5, 'x.y'] }).habilidades, ['ip.diagnostico']);
});
