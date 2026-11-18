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

test('campus: 6 missões (2 de prática), separadas das missões comuns', () => {
  assert.deepEqual(missoes.filter(x => x.modulo === 'campus').map(x => x.id), ['setores-separados', 'porta-na-vlan-errada', 'trunk-esquecido', 'vlans-sem-gateway', 'dois-andares-mesmas-vlans', 'campus-completo']);
  assert.equal(missoes.filter(x => x.modulo === 'missoes').length, 7);
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

// ---- Missões de prática (montar do zero) e objetivos de isolamento ----
test('objetivo de isolamento (esperado: falha) passa só quando o ping NÃO é entregue', () => {
  const x = m('setores-separados');
  const inicial = verificarMissao(x, x.topologia).objetivos;
  assert.deepEqual(inicial.map(o => o.ok), [true, true, false, false], 'tudo na VLAN 1: os setores ainda se enxergam');
  assert.match(inicial[2].texto, /não alcança/);
  assert.match(inicial[2].motivo, /isolados/);
  assert.equal(validarMissao({ ...bruto.find(b => b.id === 'setores-separados') }).objetivos[2].esperado, 'falha');
  assert.equal(validarMissao({ ...bruto[0], objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2', esperado: 'lixo' }] }).objetivos[0].esperado, undefined);
});

test('prática: primeira rede — configurar os três PCs na mesma sub-rede resolve; erros pontuais não', () => {
  const x = m('primeira-rede');
  const cfg = (t, id, ip, mask = '/24') => ok(configurarInterface(t, id, 'eth0', { ip, mascara: mask }));
  const certo = cfg(cfg(cfg(x.topologia, 'pc1', '192.168.1.10'), 'pc2', '192.168.1.20'), 'pc3', '192.168.1.30');
  assert.equal(verificarMissao(x, certo).todosOk, true);
  assert.equal(verificarMissao(x, cfg(cfg(cfg(x.topologia, 'pc1', '192.168.1.10'), 'pc2', '192.168.1.20'), 'pc3', '192.168.2.30')).todosOk, false, 'outra sub-rede');
  assert.equal(verificarMissao(x, cfg(cfg(cfg(x.topologia, 'pc1', '192.168.1.10'), 'pc2', '192.168.1.20'), 'pc3', '192.168.1.20')).todosOk, false, 'IP repetido');
  assert.equal(verificarMissao(x, cfg(cfg(x.topologia, 'pc1', '192.168.1.10'), 'pc2', '192.168.1.20')).todosOk, false, 'PC3 sem IP');
});

test('prática: duas redes, um roteador — exige IP nas duas interfaces e os dois gateways', () => {
  const x = m('duas-redes-um-roteador');
  const i = (t, id, p, ip) => ok(configurarInterface(t, id, p, { ip, mascara: '/24' }));
  let t = i(i(i(i(x.topologia, 'pc1', 'eth0', '192.168.1.10'), 'pc2', 'eth0', '10.0.0.10'), 'r1', 'gi0', '192.168.1.1'), 'r1', 'gi1', '10.0.0.1');
  assert.equal(verificarMissao(x, t).todosOk, false, 'falta o gateway dos PCs');
  const sem2 = ok(configurarGateway(t, 'pc1', '192.168.1.1'));
  assert.equal(verificarMissao(x, sem2).todosOk, false, 'falta o gateway do PC2');
  t = ok(configurarGateway(ok(configurarGateway(t, 'pc1', '192.168.1.1')), 'pc2', '10.0.0.1'));
  assert.equal(verificarMissao(x, t).todosOk, true);
  const semGi1 = i(i(i(x.topologia, 'pc1', 'eth0', '192.168.1.10'), 'pc2', 'eth0', '10.0.0.10'), 'r1', 'gi0', '192.168.1.1');
  const comGateways = ok(configurarGateway(ok(configurarGateway(semGi1, 'pc1', '192.168.1.1')), 'pc2', '10.0.0.1'));
  assert.equal(verificarMissao(x, comGateways).todosOk, false, 'falta a interface gi1');
});

test('prática: setores separados — cada setor numa VLAN própria; trocar só uma porta quebra a comunicação interna', () => {
  const x = m('setores-separados');
  const certo = porta(porta(porta(porta(x.topologia, 'sw1', 'fa1', 'access', 10), 'sw1', 'fa2', 'access', 10), 'sw1', 'fa3', 'access', 20), 'sw1', 'fa4', 'access', 20);
  assert.equal(verificarMissao(x, certo).todosOk, true);
  const quebrado = porta(porta(x.topologia, 'sw1', 'fa1', 'access', 10), 'sw1', 'fa3', 'access', 20);
  assert.equal(verificarMissao(x, quebrado).todosOk, false, 'cada setor ficou dividido entre duas VLANs');
  const mesmaVlan = porta(porta(porta(porta(x.topologia, 'sw1', 'fa1', 'access', 10), 'sw1', 'fa2', 'access', 10), 'sw1', 'fa3', 'access', 10), 'sw1', 'fa4', 'access', 10);
  assert.equal(verificarMissao(x, mesmaVlan).todosOk, false, 'todos na VLAN 10 continuam sem isolamento');
});

test('prática: dois andares — VLANs nos PCs mais trunk nos dois lados', () => {
  const x = m('dois-andares-mesmas-vlans');
  const vlans = t => porta(porta(porta(porta(t, 'sw1', 'fa1', 'access', 10), 'sw1', 'fa2', 'access', 20), 'sw2', 'fa1', 'access', 10), 'sw2', 'fa2', 'access', 20);
  const trunk = t => porta(porta(t, 'sw1', 'fa8', 'trunk'), 'sw2', 'fa8', 'trunk');
  assert.equal(verificarMissao(x, vlans(x.topologia)).todosOk, false, 'sem trunk os andares não se falam');
  assert.equal(verificarMissao(x, trunk(x.topologia)).todosOk, false, 'trunk sem VLANs não isola');
  assert.equal(verificarMissao(x, porta(vlans(trunk(x.topologia)), 'sw2', 'fa8', 'access', 1)).todosOk, false, 'trunk só de um lado');
  const r = verificarMissao(x, vlans(trunk(x.topologia)));
  assert.equal(r.todosOk, true, JSON.stringify(r.objetivos));
});
