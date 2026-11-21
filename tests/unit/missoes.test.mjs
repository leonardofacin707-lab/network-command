import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarMissoes } from '../../js/missoes/catalogo.js';
import { verificarMissao, calcularXp, validarMissao, ipDoDispositivo } from '../../js/missoes/verificar.js';
import { formatarIPv4 } from '../../js/sim/ipv4.js';
import { removerCabo, conectar, configurarInterface, configurarGateway, adicionarRotaEstatica, removerRotaEstatica, configurarPoolDhcp, adicionarFiltro, removerFiltro, moverFiltro, configurarDnsPc, adicionarRegistroDns, removerRegistroDns, configurarNat, configurarServicos, configurarInterface6, configurarRoteamento6, adicionarRota6, configurarWifiAp, configurarWifiPc } from '../../js/sim/topologia.js';

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
  assert.equal(missoes.filter(x => x.modulo === 'missoes').length, 40);
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

// ---- Missões de rotas estáticas ----
const rotaEst = (t, id, rede, mascara, via) => ok(adicionarRotaEstatica(t, id, { rede, mascara, via }));

test('rota que só vai: o pacote chega, a resposta não volta; a rota no R2 resolve', () => {
  const x = m('rota-so-de-ida');
  const r = verificarMissao(x, x.topologia);
  assert.equal(r.objetivos[0].motivo, 'o pacote chegou, mas a resposta não voltou');
  assert.equal(r.objetivos[1].motivo, 'um roteador do caminho não conhece essa rede');
  assert.equal(verificarMissao(x, rotaEst(x.topologia, 'r2', '192.168.1.0', '/24', '10.0.0.3')).todosOk, false, 'próximo salto sem ninguém');
  assert.equal(verificarMissao(x, rotaEst(x.topologia, 'r2', '192.168.1.0', '/24', '10.0.0.1')).todosOk, true);
  assert.equal(verificarMissao(x, rotaEst(x.topologia, 'r2', '0.0.0.0', '/0', '10.0.0.1')).todosOk, true, 'rota padrão também serve');
});

test('rotas estáticas passo a passo: exige as duas rotas', () => {
  const x = m('rotas-estaticas');
  const ida = rotaEst(x.topologia, 'r1', '172.16.0.0', '/24', '10.0.0.2');
  const volta = rotaEst(x.topologia, 'r2', '192.168.1.0', '/24', '10.0.0.1');
  assert.equal(verificarMissao(x, ida).todosOk, false);
  assert.equal(verificarMissao(x, volta).todosOk, false);
  assert.equal(verificarMissao(x, rotaEst(ida, 'r2', '192.168.1.0', '/24', '10.0.0.1')).todosOk, true);
  assert.equal(verificarMissao(x, rotaEst(ida, 'r2', '192.168.2.0', '/24', '10.0.0.1')).todosOk, false, 'rota de volta para a rede errada');
});

test('rota padrão: só a rota 0.0.0.0/0 no R1 (o provedor já conhece a empresa)', () => {
  const x = m('rota-padrao');
  assert.equal(verificarMissao(x, x.topologia).objetivos.map(o => o.ok).join(), 'false,false');
  assert.equal(verificarMissao(x, rotaEst(x.topologia, 'r1', '8.8.8.0', '/24', '203.0.113.2')).todosOk, true, 'rota específica também resolve');
  assert.equal(verificarMissao(x, rotaEst(x.topologia, 'r1', '0.0.0.0', '/0', '203.0.113.2')).todosOk, true);
  assert.match(adicionarRotaEstatica(x.topologia, 'r1', { rede: '0.0.0.0', mascara: '/0', via: '203.0.113.9' }).erro, /ligada diretamente/, 'próximo salto fora do enlace é recusado');
});

// ---- Missões de DHCP ----
const pool = (t, porta, inicio, fim) => ok(configurarPoolDhcp(t, 'r1', porta, { inicio, fim }));

test('DHCP sem servidor: nenhum PC recebe endereço até o roteador ganhar um pool', () => {
  const x = m('dhcp-sem-servidor');
  assert.equal(verificarMissao(x, x.topologia).objetivos.every(o => !o.ok), true);
  assert.equal(verificarMissao(x, pool(x.topologia, 'gi0', '192.168.10.100', '192.168.10.150')).todosOk, true);
  assert.equal(verificarMissao(x, pool(x.topologia, 'gi0', '192.168.10.100', '192.168.10.101')).todosOk, false, 'pool de 2 endereços para 3 PCs');
  assert.match(configurarPoolDhcp(x.topologia, 'r1', 'gi0', { inicio: '192.168.20.1', fim: '192.168.20.9' }).erro, /não está na sub-rede/);
});

test('pool curto: aumentar o pool resolve; o PC4 só fica sem endereço por falta de pool', () => {
  const x = m('dhcp-pool-curto');
  const r = verificarMissao(x, x.topologia);
  assert.equal(r.todosOk, false);
  assert.equal(r.objetivos.filter(o => o.ok).length, 1, 'só PC2↔PC3 funciona');
  assert.equal(verificarMissao(x, pool(x.topologia, 'gi0', '192.168.10.100', '192.168.10.103')).todosOk, true);
  assert.equal(verificarMissao(x, pool(x.topologia, 'gi0', '192.168.10.50', '192.168.10.99')).todosOk, true, 'outro pool qualquer da rede serve');
});

test('DHCP para duas redes: precisa de um pool em cada interface (a concessão traz o gateway)', () => {
  const x = m('dhcp-duas-redes');
  assert.equal(verificarMissao(x, x.topologia).objetivos.every(o => !o.ok), true);
  const so1 = pool(x.topologia, 'gi0', '192.168.10.100', '192.168.10.110');
  const r1 = verificarMissao(x, so1);
  assert.deepEqual(r1.objetivos.map(o => o.ok), [true, false, false, false], 'só a rede 10 funciona');
  const dois = pool(so1, 'gi1', '192.168.20.100', '192.168.20.110');
  assert.equal(verificarMissao(x, dois).todosOk, true);
  const curto = pool(so1, 'gi1', '192.168.20.100', '192.168.20.100');
  assert.equal(verificarMissao(x, curto).todosOk, false, 'um endereço para dois PCs');
});

// ---- Missões de filtro de pacotes ----
const nega = (t, origem, origemM, destino, destinoM) => ok(adicionarFiltro(t, 'r1', { acao: 'negar', origem, origemM, destino, destinoM }));

test('filtro do convidado: tudo passa no começo (o isolamento falha); negar só o convidado resolve', () => {
  const x = m('filtro-convidado');
  assert.deepEqual(verificarMissao(x, x.topologia).objetivos.map(o => o.ok), [true, false, true]);
  assert.equal(verificarMissao(x, nega(x.topologia, '192.168.1.20', '/32', '192.168.2.0', '/24')).todosOk, true);
  assert.equal(verificarMissao(x, nega(x.topologia, '192.168.1.20', '/32', '', '')).todosOk, true, 'qualquer destino também serve');
  const demais = verificarMissao(x, nega(x.topologia, '192.168.1.0', '/24', '192.168.2.0', '/24'));
  assert.deepEqual(demais.objetivos.map(o => o.ok), [false, true, true], 'negar a rede inteira derruba o funcionário');
  assert.match(demais.objetivos[0].motivo, /filtro de pacotes/);
});

test('regra que nunca vale: subir a permissão resolve; remover o bloqueio geral estraga o isolamento', () => {
  const x = m('filtro-ordem');
  assert.deepEqual(verificarMissao(x, x.topologia).objetivos.map(o => o.ok), [false, true, true]);
  assert.equal(verificarMissao(x, ok(moverFiltro(x.topologia, 'r1', 1, -1))).todosOk, true);
  assert.deepEqual(verificarMissao(x, ok(removerFiltro(x.topologia, 'r1', 0))).objetivos.map(o => o.ok), [true, false, true]);
});

test('a resposta que não volta: só removendo a regra (o filtro não tem estado)', () => {
  const x = m('filtro-resposta');
  const r = verificarMissao(x, x.topologia);
  assert.deepEqual(r.objetivos.map(o => o.ok), [false, false]);
  assert.equal(r.objetivos[0].motivo, 'o pacote chegou, mas a resposta não voltou');
  assert.equal(verificarMissao(x, ok(removerFiltro(x.topologia, 'r1', 0))).todosOk, true);
  assert.equal(verificarMissao(x, nega(x.topologia, '192.168.2.10', '/32', '192.168.1.10', '/32')).todosOk, false, 'estreitar a regra não resolve o funcionário bloqueado');
});

// ---- Missões com vários defeitos ----
test('filial fora do ar: três defeitos, e cada correção sozinha não basta', () => {
  const x = m('filial-fora-do-ar');
  const t0 = x.topologia;
  assert.equal(verificarMissao(x, t0).objetivos.every(o => !o.ok), true);
  const gw = ok(configurarGateway(t0, 'pc1', '192.168.1.1'));
  const pl = ok(configurarPoolDhcp(t0, 'r2', 'gi1', { inicio: '172.16.0.100', fim: '172.16.0.110' }));
  const rt = rotaEst(t0, 'r2', '192.168.1.0', '/24', '10.0.0.1');
  for (const parcial of [gw, pl, rt, ok(configurarPoolDhcp(gw, 'r2', 'gi1', { inicio: '172.16.0.100', fim: '172.16.0.110' })), rotaEst(pl, 'r2', '192.168.1.0', '/24', '10.0.0.1')]) {
    assert.equal(verificarMissao(x, parcial).todosOk, false);
  }
  assert.equal(verificarMissao(x, rotaEst(ok(configurarPoolDhcp(gw, 'r2', 'gi1', { inicio: '172.16.0.100', fim: '172.16.0.110' })), 'r2', '192.168.1.0', '/24', '10.0.0.1')).todosOk, true);
});

test('dois sites, quatro defeitos: só consertando os quatro todos os objetivos passam', () => {
  const x = m('dois-sites-quatro-defeitos');
  const t0 = x.topologia;
  assert.equal(verificarMissao(x, t0).objetivos.every(o => !o.ok), true);
  const pool = t => ok(configurarPoolDhcp(t, 'r1', 'gi0', { inicio: '192.168.1.100', fim: '192.168.1.110' }));
  const rota = t => rotaEst(ok(removerRotaEstatica(t, 'r1', 0)), 'r1', '172.16.0.0', '/24', '10.0.0.2');
  const filtro = t => ok(removerFiltro(t, 'r2', 0));
  const gwSrv = t => ok(configurarGateway(t, 'pc3', '172.16.0.1'));
  const combinacoes = [[pool], [rota], [filtro], [gwSrv], [pool, rota, filtro], [pool, rota, gwSrv], [pool, filtro, gwSrv], [rota, filtro, gwSrv]];
  for (const c of combinacoes) assert.equal(verificarMissao(x, c.reduce((t, f) => f(t), t0)).todosOk, false, `faltando um defeito (${c.length} correções)`);
  assert.equal(verificarMissao(x, [pool, rota, filtro, gwSrv].reduce((t, f) => f(t), t0)).todosOk, true);
});

// ---- Missões de DNS ----
test('objetivo por nome: texto e motivos de falha vêm do DNS', () => {
  const x = m('dns-ping-no-nome');
  const r = verificarMissao(x, x.topologia);
  assert.equal(r.objetivos[0].texto, 'Cliente1 alcança www.loja.local (pelo nome)');
  assert.equal(r.objetivos[0].motivo, 'o computador não tem servidor DNS configurado');
  assert.equal(verificarMissao(x, ok(configurarDnsPc(x.topologia, 'pc1', '192.168.1.50'))).todosOk, true);
  assert.equal(verificarMissao(x, ok(configurarDnsPc(x.topologia, 'pc1', '192.168.1.99'))).objetivos[0].motivo, 'o servidor DNS configurado não responde');
  assert.equal(verificarMissao(x, ok(configurarDnsPc(x.topologia, 'pc1', '192.168.1.60'))).objetivos[0].motivo, 'o endereço configurado como DNS não é um servidor DNS');
});

test('registro errado: o nome resolve mas o ping falha; trocar o registro resolve', () => {
  const x = m('dns-registro-errado');
  const antes = verificarMissao(x, x.topologia);
  assert.equal(antes.todosOk, false);
  assert.equal(antes.objetivos[0].motivo, 'ninguém respondeu na rede local');
  const certo = ok(adicionarRegistroDns(ok(removerRegistroDns(x.topologia, 'pc2', 0)), 'pc2', { nome: 'www.loja.local', ip: '192.168.1.60' }));
  assert.equal(verificarMissao(x, certo).todosOk, true);
  assert.equal(verificarMissao(x, ok(adicionarRegistroDns(x.topologia, 'pc2', { nome: 'outro.loja.local', ip: '192.168.1.60' }))).todosOk, false, 'registro novo não troca o errado');
});

test('DNS da empresa: precisa dos dois registros e do DNS nos dois clientes', () => {
  const x = m('dns-da-empresa');
  const reg = (t, nome, ip) => ok(adicionarRegistroDns(t, 'pc3', { nome, ip }));
  const dns = (t, id) => ok(configurarDnsPc(t, id, '192.168.1.50'));
  const registros = reg(reg(x.topologia, 'intranet.empresa.local', '192.168.1.60'), 'arquivos.empresa.local', '192.168.1.70');
  assert.equal(verificarMissao(x, x.topologia).objetivos.every(o => !o.ok), true);
  assert.equal(verificarMissao(x, dns(dns(x.topologia, 'pc1'), 'pc2')).todosOk, false, 'só clientes');
  assert.equal(verificarMissao(x, registros).todosOk, false, 'só registros');
  assert.deepEqual(verificarMissao(x, dns(registros, 'pc1')).objetivos.map(o => o.ok), [true, false, true, false], 'só o cliente 1');
  assert.equal(verificarMissao(x, dns(dns(registros, 'pc1'), 'pc2')).todosOk, true);
  assert.equal(verificarMissao(x, dns(dns(reg(x.topologia, 'intranet.empresa.local', '192.168.1.60'), 'pc1'), 'pc2')).todosOk, false, 'falta o registro de arquivos');
});

test('validarMissao aceita objetivo por nome e descarta nome inválido', () => {
  const base = JSON.parse(JSON.stringify(m('dns-ping-no-nome')));
  base.objetivos = [{ id: 'a', de: 'pc1', nome: 'www.loja.local' }, { id: 'b', de: 'pc1', nome: 'x y' }, { id: 'c', de: 'pc1' }, { id: 'd', de: 'pc9', nome: 'a.b' }];
  const v = validarMissao(base);
  assert.deepEqual(v.objetivos, [{ id: 'a', de: 'pc1', nome: 'www.loja.local' }]);
});

// ---- Fundamentos (switches) e o chefão de cinco camadas ----
test('dois switches: ligar os switches (ou mover o PC3) resolve', () => {
  const x = m('dois-switches');
  assert.deepEqual(verificarMissao(x, x.topologia).objetivos.map(o => o.ok), [true, false, false]);
  assert.equal(verificarMissao(x, ok(conectar(x.topologia, 'sw1', 'sw2', 'fa8', 'fa8'))).todosOk, true);
  const movido = ok(conectar(ok(removerCabo(x.topologia, x.topologia.cabos.find(c => c.a.d === 'pc3' || c.b.d === 'pc3').id)), 'pc3', 'sw1', 'eth0', 'fa3'));
  assert.equal(verificarMissao(x, movido).todosOk, true);
});

test('chefão de cinco camadas: cada um dos cinco defeitos é necessário', () => {
  const x = m('chefao-cinco-camadas');
  const t0 = x.topologia;
  assert.equal(verificarMissao(x, t0).objetivos.every(o => !o.ok), true);
  const correcoes = {
    cabo: t => ok(conectar(t, 'pc2', 'sw1', 'eth0', 'fa2')),
    pool: t => ok(configurarPoolDhcp(t, 'r1', 'gi0', { inicio: '192.168.1.100', fim: '192.168.1.110' })),
    rota: t => rotaEst(t, 'r1', '172.16.0.0', '/24', '10.0.0.2'),
    filtro: t => ok(removerFiltro(t, 'r2', 0)),
    dns: t => ok(configurarDnsPc(ok(configurarDnsPc(t, 'pc1', '172.16.0.10')), 'pc2', '172.16.0.10'))
  };
  const aplicar = nomes => nomes.reduce((t, n) => correcoes[n](t), t0);
  const todas = Object.keys(correcoes);
  assert.equal(verificarMissao(x, aplicar(todas)).todosOk, true);
  for (const faltando of todas) assert.equal(verificarMissao(x, aplicar(todas.filter(n => n !== faltando))).todosOk, false, `sem a correção "${faltando}"`);
});

// ---- NAT ----
test('NAT: "a ida chega, a volta se perde" só resolve com NAT (rota no provedor é recusada pela restrição)', () => {
  const x = m('nat-sem-volta');
  const t0 = x.topologia;
  assert.deepEqual(verificarMissao(x, t0).objetivos.map(o => o.ok), [false, true]);
  assert.match(verificarMissao(x, t0).objetivos[0].motivo, /resposta não voltou/);
  assert.equal(verificarMissao(x, ok(configurarNat(t0, 'r1', { dentro: 'gi0', fora: 'gi1' }))).todosOk, true);
  const atalho = rotaEst(t0, 'r2', '192.168.1.0', '/24', '200.0.0.2');
  const r = verificarMissao(x, atalho);
  assert.equal(r.objetivos[0].ok, true, 'o ping até passaria...');
  assert.equal(r.objetivos[1].ok, false, '...mas o provedor não pode ter rota privada');
  assert.equal(r.todosOk, false);
});

test('NAT: lados trocados bloqueiam e a troca resolve', () => {
  const x = m('nat-lados-trocados');
  const antes = verificarMissao(x, x.topologia);
  assert.equal(antes.objetivos[0].ok, false);
  assert.match(antes.objetivos[0].motivo, /NAT com os lados trocados/);
  assert.equal(verificarMissao(x, ok(configurarNat(x.topologia, 'r1', { dentro: 'gi0', fora: 'gi1' }))).todosOk, true);
});

test('NAT: saída da empresa exige IP, rota e NAT (cada um é necessário)', () => {
  const x = m('nat-saida-da-empresa');
  const t0 = x.topologia;
  assert.equal(verificarMissao(x, t0).todosOk, false);
  const correcoes = {
    ip: t => ok(configurarInterface(t, 'r1', 'gi1', { ip: '200.0.0.2', mascara: '/30' })),
    // sem o IP da interface a rota nem pode ser criada (o simulador recusa): nesse caso fica sem rota
    rota: t => adicionarRotaEstatica(t, 'r1', { rede: '0.0.0.0', mascara: '/0', via: '200.0.0.1' }).topologia ?? t,
    nat: t => ok(configurarNat(t, 'r1', { dentro: 'gi0', fora: 'gi1' }))
  };
  const aplicar = nomes => nomes.reduce((t, n) => correcoes[n](t), t0);
  const todas = Object.keys(correcoes);
  assert.equal(verificarMissao(x, aplicar(todas)).todosOk, true);
  for (const faltando of todas) assert.equal(verificarMissao(x, aplicar(todas.filter(n => n !== faltando))).todosOk, false, `sem "${faltando}"`);
});

test('NAT: objetivo de restrição é validado e normalizado', () => {
  const base = JSON.parse(JSON.stringify(m('nat-sem-volta')));
  base.objetivos = [{ id: 'a', tipo: 'sem-rota-privada', roteador: 'r2', lixo: 1 }, { id: 'b', tipo: 'sem-rota-privada', roteador: 'pc1' }, { id: 'c', tipo: 'sem-rota-privada', roteador: 'zz' }];
  assert.deepEqual(validarMissao(base).objetivos, [{ id: 'a', tipo: 'sem-rota-privada', roteador: 'r2' }]);
});

// ---- Segurança ----
const cabo = (t, id) => t.cabos.find(c => c.a.d === id || c.b.d === id).id;
const porNomeDisp = (t, nome) => t.dispositivos.find(d => d.nome === nome).id;

test('segurança: DHCP falso — desligar o equipamento desconhecido (ou apagar o pool dele) resolve', () => {
  const x = m('seg-dhcp-falso'), t0 = x.topologia, falso = porNomeDisp(t0, 'Desconhecido');
  const r0 = verificarMissao(x, t0);
  assert.equal(r0.todosOk, false);
  assert.match(r0.objetivos[2].motivo, /outro servidor DHCP \(Desconhecido, 192\.168\.1\.254\)/);
  assert.equal(verificarMissao(x, ok(removerCabo(t0, cabo(t0, falso)))).todosOk, true);
  assert.equal(verificarMissao(x, ok(configurarPoolDhcp(t0, falso, 'gi0', { inicio: '', fim: '' }))).todosOk, true);
});

test('segurança: gateway falso — conflito de IP com o gateway; tirar o visitante resolve', () => {
  const x = m('seg-gateway-falso'), t0 = x.topologia, vis = porNomeDisp(t0, 'Visitante');
  const r0 = verificarMissao(x, t0);
  assert.equal(r0.todosOk, false);
  assert.match(r0.objetivos[0].motivo, /IP duplicado/);
  assert.equal(verificarMissao(x, ok(removerCabo(t0, cabo(t0, vis)))).todosOk, true);
  assert.equal(verificarMissao(x, ok(configurarInterface(t0, vis, 'eth0', { ip: '192.168.1.99', mascara: '/24' }))).todosOk, true);
});

test('segurança: DNS falso — o nome resolve, mas para o computador errado; trocar o DNS do Cliente1 resolve', () => {
  const x = m('seg-dns-falso'), t0 = x.topologia;
  const r0 = verificarMissao(x, t0);
  assert.deepEqual(r0.objetivos.map(o => o.ok), [false, true, true]);
  assert.match(r0.objetivos[0].motivo, /respondeu 192\.168\.1\.66, que não é o endereço de Banco/);
  assert.equal(verificarMissao(x, ok(configurarDnsPc(t0, 'pc1', '192.168.1.50'))).todosOk, true);
});

test('segurança: feche o Telnet — só a regra por porta e origem no R1 resolve; desligar o Telnet no servidor tira o Admin', () => {
  const x = m('seg-feche-telnet'), t0 = x.topologia, srv = porNomeDisp(t0, 'Servidor');
  assert.deepEqual(verificarMissao(x, t0).objetivos.map(o => o.ok), [true, true, false, false, true]);
  const regra = extra => ok(adicionarFiltro(t0, 'r1', { acao: 'negar', origem: '192.168.1.0', origemM: '/24', destino: '10.0.0.10', destinoM: '/32', ...extra }));
  assert.equal(verificarMissao(x, regra({ protocolo: 'tcp', porta: '23' })).todosOk, true);
  assert.equal(verificarMissao(x, regra({})).todosOk, false, 'sem porta derruba o site e o SSH');
  assert.equal(verificarMissao(x, ok(configurarServicos(t0, srv, [22, 80]))).todosOk, false, 'o Admin perde o Telnet');
});

test('segurança: bloqueio demais — trocar a regra ip por icmp devolve o site e mantém o ping bloqueado', () => {
  const x = m('seg-bloqueio-demais'), t0 = x.topologia;
  assert.deepEqual(verificarMissao(x, t0).objetivos.map(o => o.ok), [false, false, true]);
  const certo = ok(adicionarFiltro(ok(removerFiltro(t0, 'r1', 0)), 'r1', { acao: 'negar', origem: '192.168.1.0', origemM: '/24', destino: '10.0.0.10', destinoM: '/32', protocolo: 'icmp' }));
  assert.equal(verificarMissao(x, certo).todosOk, true);
  assert.equal(verificarMissao(x, ok(removerFiltro(t0, 'r1', 0))).todosOk, false, 'tirar a regra libera o ping');
});

test('objetivos novos são validados: porta, nome+para e dhcp-de', () => {
  const base = JSON.parse(JSON.stringify(m('seg-dns-falso')));
  base.objetivos = [{ id: 'a', de: 'pc1', para: 'pc4', porta: 443 }, { id: 'b', de: 'pc1', para: 'pc4', porta: 70000 }, { id: 'c', de: 'pc1', nome: 'banco.local', para: 'pc4' },
    { id: 'd', tipo: 'dhcp-de', pc: 'pc1', roteador: 'pc2' }, { id: 'e', tipo: 'qualquer', de: 'pc1', para: 'pc2' }];
  assert.deepEqual(validarMissao(base).objetivos, [{ id: 'a', de: 'pc1', para: 'pc4', porta: 443 }, { id: 'b', de: 'pc1', para: 'pc4' }, { id: 'c', de: 'pc1', nome: 'banco.local', para: 'pc4' }]);
});

// ---- IPv6 ----
test('IPv6: primeiros passos — endereços no mesmo /64 resolvem; prefixos diferentes não', () => {
  const x = m('ipv6-primeiros-passos'), t0 = x.topologia;
  assert.match(verificarMissao(x, t0).objetivos[0].motivo, /não tem endereço IPv6 global/);
  const com = (t, id, e) => ok(configurarInterface6(t, id, 'eth0', { ip6: e }));
  const certo = com(com(com(t0, 'pc1', '2001:db8:1::10/64'), 'pc2', '2001:db8:1::20/64'), 'pc3', '2001:db8:1::30/64');
  assert.equal(verificarMissao(x, certo).todosOk, true);
  assert.equal(verificarMissao(x, com(certo, 'pc3', '2001:db8:9::30/64')).todosOk, false);
});

test('IPv6: roteador sem ipv6 unicast-routing; ligar resolve', () => {
  const x = m('ipv6-roteador-nao-roteia');
  assert.match(verificarMissao(x, x.topologia).objetivos[0].motivo, /ipv6 unicast-routing/);
  assert.equal(verificarMissao(x, ok(configurarRoteamento6(x.topologia, 'r1', true))).todosOk, true);
});

test('IPv6: SLAAC só funciona quando o R1 tem prefixo /64 na interface dos clientes', () => {
  const x = m('ipv6-slaac');
  assert.match(verificarMissao(x, x.topologia).objetivos[0].motivo, /não tem endereço IPv6 global|origem não tem endereço IPv6/);
  assert.equal(verificarMissao(x, ok(configurarInterface6(x.topologia, 'r1', 'gi0', { ip6: '2001:db8:1::1/64' }))).todosOk, true);
  assert.equal(verificarMissao(x, ok(configurarInterface6(x.topologia, 'r1', 'gi0', { ip6: '2001:db8:1::1/56' }))).todosOk, false, '/56 não serve para SLAAC');
});

test('IPv6: prefixo digitado errado; corrigir o endereço do Cliente2 resolve', () => {
  const x = m('ipv6-prefixo-errado');
  const r0 = verificarMissao(x, x.topologia);
  assert.deepEqual(r0.objetivos.map(o => o.ok), [true, false]);
  assert.match(r0.objetivos[1].motivo, /gateway IPv6 da origem não está na rede/);
  assert.equal(verificarMissao(x, ok(configurarInterface6(x.topologia, 'pc2', 'eth0', { ip6: '2001:db8:1::20/64' }))).todosOk, true);
});

test('IPv6: rotas estáticas nos dois roteadores (rota só de ida não basta)', () => {
  const x = m('ipv6-rotas-estaticas'), t0 = x.topologia;
  const ida = ok(adicionarRota6(t0, 'r1', { rede: '2001:db8:b::/64', via: '2001:db8:ff::2' }));
  assert.equal(verificarMissao(x, ida).todosOk, false);
  assert.equal(verificarMissao(x, ok(adicionarRota6(ida, 'r2', { rede: '::/0', via: '2001:db8:ff::1' }))).todosOk, true);
});

// ---- Wi-Fi ----
const idDe = (t, nome) => t.dispositivos.find(d => d.nome === nome).id;
const wifiPc = (t, nome, w) => ok(configurarWifiPc(t, idDe(t, nome), w));
const wifiAp = (t, w) => ok(configurarWifiAp(t, idDe(t, 'AP1'), w));

test('Wi-Fi: senha com maiúsculas erradas; corrigir resolve', () => {
  const x = m('wifi-senha-errada');
  const r0 = verificarMissao(x, x.topologia);
  assert.deepEqual(r0.objetivos.map(o => o.ok), [true, false]);
  assert.match(r0.objetivos[1].motivo, /não conectou ao Wi-Fi: a senha não confere/);
  assert.equal(verificarMissao(x, wifiPc(x.topologia, 'Notebook2', { ssid: 'Escritorio', senha: 'Cafe-com-Leite-2026' })).todosOk, true);
});

test('Wi-Fi: SSID oculto com maiúscula diferente; escrever o nome exato resolve', () => {
  const x = m('wifi-ssid-oculto');
  assert.match(verificarMissao(x, x.topologia).objetivos[0].motivo, /nenhuma rede com esse nome/);
  assert.equal(verificarMissao(x, wifiPc(x.topologia, 'Notebook1', { ssid: 'Diretoria', senha: 'Reuniao-Sexta-9h' })).todosOk, true);
});

test('Wi-Fi: leitor só 2,4 GHz; AP em ambas as bandas resolve e mantém o Caixa', () => {
  const x = m('wifi-leitor-antigo');
  assert.match(verificarMissao(x, x.topologia).objetivos[1].motivo, /só transmite em 5 GHz/);
  assert.equal(verificarMissao(x, wifiAp(x.topologia, { ssid: 'Loja', seguranca: 'wpa2', senha: 'Vitrine-Azul-77', banda: 'ambas' })).todosOk, true);
});

test('Wi-Fi: rede aberta — WPA2 com senha forte e clientes atualizados; senha fraca não basta', () => {
  const x = m('wifi-rede-aberta'), t0 = x.topologia;
  assert.deepEqual(verificarMissao(x, t0).objetivos.map(o => o.ok), [false, true, true]);
  const forte = 'Jaleco-Verde-2031!', fraca = '12345678';
  const com = senha => ['Recepcao', 'Consultorio'].reduce((t, n) => wifiPc(t, n, { ssid: 'Clinica', senha }), wifiAp(t0, { ssid: 'Clinica', seguranca: 'wpa2', senha, banda: 'ambas' }));
  assert.equal(verificarMissao(x, com(forte)).todosOk, true);
  assert.match(verificarMissao(x, com(fraca)).objetivos[0].motivo, /curta ou óbvia/);
  assert.deepEqual(verificarMissao(x, wifiAp(t0, { ssid: 'Clinica', seguranca: 'wpa3', senha: forte, banda: 'ambas' })).objetivos.map(o => o.ok), [true, false, false], 'trocar só o AP derruba os clientes');
});
