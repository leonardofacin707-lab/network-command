// Wi-Fi: associação (SSID, senha, banda, oculto), ponte de camada 2 no ponto de acesso, terminal e validações.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../js/sim/motor.js';
import { executar } from '../../js/sim/terminal.js';
import { lerIPv4 } from '../../js/sim/ipv4.js';
import { associacoesWifi, senhaWifiForte } from '../../js/sim/wifi.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarWifiAp, configurarWifiPc, configurarDhcpPc,
  configurarPoolDhcp, normalizarTopologia, dispositivo } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
// Servidor (pc1, cabo) - SW1 - AP1 ((( Notebook pc2 e pc3 sem fio
function base() {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'pc', 'switch', 'ap']) t = ok(adicionarDispositivo(t, tipo));
  t = ok(conectar(t, 'pc1', 'sw1', 'eth0', 'fa1')); t = ok(conectar(t, 'ap1', 'sw1', 'eth0', 'fa2'));
  for (const [id, fim] of [['pc1', 10], ['pc2', 20], ['pc3', 30]]) t = ok(configurarInterface(t, id, 'eth0', { ip: `192.168.1.${fim}`, mascara: '/24' }));
  t = ok(configurarWifiAp(t, 'ap1', { ssid: 'Escritorio', seguranca: 'wpa2', senha: 'Cafe-com-Leite-2026', banda: 'ambas' }));
  t = ok(configurarWifiPc(t, 'pc2', { ssid: 'Escritorio', senha: 'Cafe-com-Leite-2026' }));
  return t;
}
const ping = (t, de, ip) => criarSimulacao(t).ping(de, lerIPv4(ip));

test('associado ao AP, o notebook está na mesma rede de camada 2 que o servidor com cabo', () => {
  const t = base();
  assert.equal(associacoesWifi(t).get('pc2').ok, true);
  assert.equal(ping(t, 'pc2', '192.168.1.10').status, 'entregue');
  assert.equal(ping(t, 'pc1', '192.168.1.20').status, 'entregue');
  assert.equal(t.cabos.length, 2, 'o cabo sem fio é só da simulação');
});

test('motivos: SSID com maiúscula diferente, senha errada, banda 5 GHz para adaptador antigo, cabo em uso', () => {
  const motivo = (t, id = 'pc3') => associacoesWifi(t).get(id).motivo;
  assert.equal(motivo(ok(configurarWifiPc(base(), 'pc3', { ssid: 'escritorio', senha: 'Cafe-com-Leite-2026' }))), 'ssid-nao-encontrado');
  assert.equal(motivo(ok(configurarWifiPc(base(), 'pc3', { ssid: 'Escritorio', senha: 'cafe-com-leite-2026' }))), 'senha-incorreta');
  const so5 = ok(configurarWifiAp(base(), 'ap1', { ssid: 'Escritorio', seguranca: 'wpa2', senha: 'Cafe-com-Leite-2026', banda: '5' }));
  assert.equal(motivo(ok(configurarWifiPc(so5, 'pc3', { ssid: 'Escritorio', senha: 'Cafe-com-Leite-2026', so24: true }))), 'banda-incompativel');
  assert.equal(associacoesWifi(ok(configurarWifiPc(base(), 'pc1', { ssid: 'Escritorio', senha: 'Cafe-com-Leite-2026' }))).get('pc1').motivo, 'cabo-em-uso');
  const t = ok(configurarWifiPc(base(), 'pc3', { ssid: 'Escritorio', senha: 'errada123' }));
  assert.equal(ping(t, 'pc3', '192.168.1.10').status, 'sem-link');
});

test('rede aberta aceita qualquer senha; SSID oculto aceita quem digita o nome certo', () => {
  const aberta = ok(configurarWifiAp(base(), 'ap1', { ssid: 'Escritorio', seguranca: 'aberta', banda: '2.4' }));
  assert.equal(dispositivo(aberta, 'ap1').wifi.senha, '');
  assert.equal(associacoesWifi(ok(configurarWifiPc(aberta, 'pc3', { ssid: 'Escritorio', senha: 'qualquer' }))).get('pc3').ok, true);
  const oculta = ok(configurarWifiAp(base(), 'ap1', { ssid: 'Escritorio', seguranca: 'wpa3', senha: 'Cafe-com-Leite-2026', banda: 'ambas', oculto: true }));
  assert.equal(associacoesWifi(oculta).get('pc2').ok, true);
});

test('DHCP pelo Wi-Fi: o notebook recebe endereço do roteador ligado ao switch', () => {
  let t = base();
  t = ok(adicionarDispositivo(t, 'roteador')); t = ok(conectar(t, 'r1', 'sw1', 'gi0', 'fa3'));
  t = ok(configurarInterface(t, 'r1', 'gi0', { ip: '192.168.1.1', mascara: '/24' }));
  t = ok(configurarPoolDhcp(t, 'r1', 'gi0', { inicio: '192.168.1.100', fim: '192.168.1.110' }));
  t = ok(configurarDhcpPc(t, 'pc2', true));
  assert.equal(criarSimulacao(t).concessoes.get('pc2').ok, true);
});

test('terminal: netsh wlan show networks e interfaces, ipconfig com adaptador sem fio', () => {
  let t = ok(configurarWifiPc(base(), 'pc3', { ssid: 'Escritorio', senha: 'errada123' }));
  t = ok(adicionarDispositivo(t, 'ap')); t = ok(configurarWifiAp(t, 'ap2', { ssid: 'Diretoria', seguranca: 'wpa3', senha: 'Senha-Forte-Da-Dir', banda: '5', oculto: true }));
  const sim = criarSimulacao(t);
  const run = (id, l) => executar(sim, id, l).linhas.join('\n');
  const redes = run('pc2', 'netsh wlan show networks');
  assert.match(redes, /SSID 1 : Escritorio\n\s+Autenticação\s+: WPA2-Personal\n\s+Banda\s+: 2,4 e 5 GHz/);
  assert.doesNotMatch(redes, /Diretoria/, 'SSID oculto não aparece');
  assert.match(run('pc2', 'netsh wlan show interfaces'), /Estado\s+: conectado[\s\S]*Ponto de acesso\s+: AP1/);
  assert.match(run('pc3', 'netsh wlan show interfaces'), /desconectado[\s\S]*Motivo\s+: a senha não confere/);
  assert.match(run('pc2', 'ipconfig'), /Adaptador de Rede sem Fio Wi-Fi:/);
  assert.match(run('pc1', 'netsh wlan show interfaces'), /Wi-Fi não configurado/);
});

test('validações, senha forte e normalização', () => {
  const t = base();
  assert.match(configurarWifiAp(t, 'ap1', { ssid: '', seguranca: 'wpa2', senha: '12345678' }).erro, /SSID inválido/);
  assert.match(configurarWifiAp(t, 'ap1', { ssid: 'X', seguranca: 'wpa2', senha: 'curta' }).erro, /8 a 63/);
  assert.match(configurarWifiAp(t, 'ap1', { ssid: 'X', seguranca: 'wep', senha: '12345678' }).erro, /segurança/);
  assert.match(configurarWifiAp(t, 'pc1', { ssid: 'X', seguranca: 'aberta' }).erro, /pontos de acesso/);
  assert.equal(dispositivo(ok(configurarWifiPc(t, 'pc2', { ssid: '' })), 'pc2').wifi, undefined);
  assert.equal(senhaWifiForte({ ssid: 'A', seguranca: 'wpa2', senha: 'Cafe-com-Leite-2026' }), true);
  assert.equal(senhaWifiForte({ ssid: 'A', seguranca: 'wpa2', senha: '12345678' }), false);
  assert.equal(senhaWifiForte({ ssid: 'A', seguranca: 'wpa2', senha: 'aaaaaaaaaaaa' }), false, 'pouca variedade');
  assert.equal(senhaWifiForte({ ssid: 'A', seguranca: 'aberta', senha: '' }), false);
  assert.deepEqual(normalizarTopologia(JSON.parse(JSON.stringify(t))), t);
  const c = JSON.parse(JSON.stringify(t)); c.dispositivos.find(d => d.id === 'ap1').wifi = { ssid: 'X', seguranca: 'wep' };
  assert.equal(normalizarTopologia(c).dispositivos.find(d => d.id === 'ap1').wifi.seguranca, 'wpa2', 'inválido volta ao padrão seguro');
});
