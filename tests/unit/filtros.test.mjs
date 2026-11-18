// Filtro de pacotes simplificado (ACL sem estado): ordem das regras, resposta bloqueada, validações e normalização.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao, filtroNega } from '../../js/sim/motor.js';
import { executar } from '../../js/sim/terminal.js';
import { lerIPv4 } from '../../js/sim/ipv4.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, adicionarFiltro, removerFiltro, moverFiltro, normalizarTopologia, MAX_FILTROS } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
// pc1 (.10) e pc2 (.20) em 192.168.1.0/24 (r1 gi0, via sw1); pc3 (.10) em 192.168.2.0/24 (r1 gi1)
function base() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'pc', 'switch', 'roteador']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'sw1', 'eth0', 'fa1')); t = ok(conectar(t, 'pc2', 'sw1', 'eth0', 'fa2')); t = ok(conectar(t, 'sw1', 'r1', 'fa3', 'gi0')); t = ok(conectar(t, 'pc3', 'r1', 'eth0', 'gi1'));
  const i = (id, p, ip, m = '/24') => { t = ok(configurarInterface(t, id, p, { ip, mascara: m })); };
  i('pc1', 'eth0', '192.168.1.10'); i('pc2', 'eth0', '192.168.1.20'); i('r1', 'gi0', '192.168.1.1'); i('r1', 'gi1', '192.168.2.1'); i('pc3', 'eth0', '192.168.2.10');
  for (const [pc, gw] of [['pc1', '192.168.1.1'], ['pc2', '192.168.1.1'], ['pc3', '192.168.2.1']]) t = ok(configurarGateway(t, pc, gw));
  return t;
}
const regra = (acao, origem, origemM, destino, destinoM) => ({ acao, origem, origemM, destino, destinoM });
const filtro = (t, ...r) => ok(adicionarFiltro(t, 'r1', regra(...r)));
const ping = (t, de, ip) => criarSimulacao(t).ping(de, lerIPv4(ip));

test('sem regras tudo passa; negar um host bloqueia só ele', () => {
  const t = base();
  assert.equal(ping(t, 'pc2', '192.168.2.10').status, 'entregue');
  const f = filtro(t, 'negar', '192.168.1.20', '/32', '192.168.2.0', '/24');
  const r = ping(f, 'pc2', '192.168.2.10');
  assert.equal(r.status, 'bloqueado');
  assert.equal(r.de, lerIPv4('192.168.1.1'), 'quem avisa é o roteador, pela interface de entrada');
  assert.equal(ping(f, 'pc1', '192.168.2.10').status, 'entregue', 'o outro PC continua passando');
  assert.equal(ping(f, 'pc2', '192.168.1.10').status, 'entregue', 'dentro da mesma rede o roteador não participa');
});

test('o filtro não tem estado: bloquear só o sentido da resposta faz o ping dar timeout', () => {
  const f = filtro(base(), 'negar', '192.168.2.0', '/24', '192.168.1.0', '/24');
  const r = ping(f, 'pc1', '192.168.2.10');
  assert.equal(r.status, 'timeout');
  assert.equal(r.ida.status, 'entregue');
  assert.equal(r.volta.status, 'bloqueado');
});

test('a ordem decide: permitir depois de negar nunca vale; ao subir a regra, passa a valer', () => {
  let t = filtro(base(), 'negar', '192.168.1.0', '/24', '192.168.2.0', '/24');
  t = filtro(t, 'permitir', '192.168.1.10', '/32', '192.168.2.0', '/24');
  assert.equal(ping(t, 'pc1', '192.168.2.10').status, 'bloqueado');
  const certo = ok(moverFiltro(t, 'r1', 1, -1));
  assert.equal(ping(certo, 'pc1', '192.168.2.10').status, 'entregue');
  assert.equal(ping(certo, 'pc2', '192.168.2.10').status, 'bloqueado');
});

test('"qualquer" (campos vazios), o roteador só filtra o que encaminha', () => {
  const f = filtro(base(), 'negar', '', '', '192.168.2.10', '/32');
  assert.equal(ping(f, 'pc1', '192.168.2.10').status, 'bloqueado');
  assert.equal(ping(f, 'pc2', '192.168.2.10').status, 'bloqueado');
  assert.equal(ping(f, 'pc3', '192.168.1.10').status, 'timeout', 'a ida passa, mas a resposta tem pc3 como destino e é bloqueada (sem estado)');
  assert.equal(ping(f, 'pc1', '192.168.2.1').status, 'entregue', 'o roteador é o destino final: o filtro só vale para o que ele encaminha');
  assert.equal(filtroNega(f.dispositivos.find(d => d.id === 'r1'), lerIPv4('1.1.1.1'), lerIPv4('8.8.8.8')), false);
});

test('tracert e ping mostram o bloqueio no terminal', () => {
  const f = filtro(base(), 'negar', '192.168.1.0', '/24', '192.168.2.0', '/24');
  const sim = criarSimulacao(f);
  assert.match(executar(sim, 'pc1', 'ping -n 1 192.168.2.10').linhas.join('\n'), /Comunicação proibida administrativamente/);
  assert.match(executar(criarSimulacao(f), 'pc1', 'tracert 192.168.2.10').linhas.join('\n'), /192\.168\.1\.1\s+relata: Comunicação proibida/);
});

test('validações, duplicadas, limite, remover e mover', () => {
  const t = base();
  const e = (campos, id = 'r1', topo = t) => adicionarFiltro(topo, id, campos).erro;
  assert.match(e(regra('talvez', '', '', '', '')), /permitir ou negar/);
  assert.match(e(regra('negar', '192.168.1.0', '', '', '')), /preencha a rede e a máscara/);
  assert.match(e(regra('negar', 'x', '/24', '', '')), /endereço inválido/);
  assert.match(e(regra('negar', '192.168.1.0', '255.0.255.0', '', '')), /máscara inválida/);
  assert.match(e(regra('negar', '192.168.1.5', '/24', '', '')), /endereço de rede seria 192\.168\.1\.0/);
  assert.match(e(regra('negar', '', '', '', ''), 'pc1'), /Só roteadores/);
  const com = filtro(t, 'negar', '192.168.1.0', '/24', '', '');
  assert.match(e(regra('negar', '192.168.1.0', '255.255.255.0', '', ''), 'r1', com), /já existe/);
  let cheio = t;
  for (let i = 0; i < MAX_FILTROS; i++) cheio = filtro(cheio, 'negar', `10.${i}.0.0`, '/16', '', '');
  assert.match(e(regra('negar', '10.99.0.0', '/16', '', ''), 'r1', cheio), /Limite/);
  const dois = filtro(com, 'permitir', '', '', '', '');
  assert.equal(ok(removerFiltro(dois, 'r1', 0)).dispositivos.find(d => d.id === 'r1').filtros[0].acao, 'permitir');
  assert.ok(removerFiltro(dois, 'r1', 9).erro);
  assert.ok(moverFiltro(dois, 'r1', 0, -1).erro && moverFiltro(dois, 'r1', 1, 1).erro && moverFiltro(dois, 'r1', 0, 2).erro);
  assert.equal(t.dispositivos.find(d => d.id === 'r1').filtros.length, 0, 'topologia original intacta');
});

test('normalização descarta regras inválidas e lixo; PCs e switches não ganham filtros', () => {
  const com = filtro(base(), 'negar', '192.168.1.0', '/24', '', '');
  const bruto = JSON.parse(JSON.stringify(com));
  bruto.dispositivos.find(d => d.id === 'r1').filtros.push({ acao: 'x', origem: '', origemM: '', destino: '', destinoM: '' }, { acao: 'negar', origem: '192.168.1.5', origemM: '/24', destino: '0.0.0.0', destinoM: '0.0.0.0' }, 'lixo', null);
  bruto.dispositivos.find(d => d.id === 'pc1').filtros = [{ acao: 'negar' }];
  const n = normalizarTopologia(bruto);
  assert.deepEqual(n.dispositivos.find(d => d.id === 'r1').filtros, [{ acao: 'negar', origem: '192.168.1.0', origemM: '255.255.255.0', destino: '0.0.0.0', destinoM: '0.0.0.0' }]);
  assert.equal(n.dispositivos.find(d => d.id === 'pc1').filtros, undefined);
});
