import test from 'node:test';
import assert from 'node:assert/strict';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, removerCabo, renomear } from '../../js/sim/topologia.js';
import { criarSimulacao, macDe } from '../../js/sim/motor.js';
import { executar } from '../../js/sim/terminal.js';

const add = (t, tipo) => adicionarDispositivo(t, tipo).topologia;
const liga = (t, a, b) => conectar(t, a, b).topologia;
const cfg = (t, id, p, i, m = '/24') => configurarInterface(t, id, p, { ip: i, mascara: m }).topologia;

function lan() {
  let t = topologiaVazia();
  for (const x of ['pc', 'pc', 'switch']) t = add(t, x);
  t = liga(liga(t, 'pc1', 'sw1'), 'pc2', 'sw1');
  t = cfg(cfg(t, 'pc1', 'eth0', '192.168.1.10'), 'pc2', 'eth0', '192.168.1.20');
  return t;
}
function duasRedes() {
  let t = topologiaVazia();
  for (const x of ['pc', 'pc', 'switch', 'switch', 'roteador']) t = add(t, x);
  t = liga(liga(liga(liga(t, 'pc1', 'sw1'), 'sw1', 'r1'), 'pc2', 'sw2'), 'sw2', 'r1');
  t = cfg(cfg(t, 'r1', 'gi0', '192.168.1.1'), 'r1', 'gi1', '10.0.0.1');
  t = configurarGateway(cfg(t, 'pc1', 'eth0', '192.168.1.10'), 'pc1', '192.168.1.1').topologia;
  t = configurarGateway(cfg(t, 'pc2', 'eth0', '10.0.0.10'), 'pc2', '10.0.0.1').topologia;
  return t;
}
const rodar = (t, linha, id = 'pc1', sim = criarSimulacao(t)) => executar(sim, id, linha).linhas.join('\n');

test('hostname e help', () => {
  assert.equal(rodar(lan(), 'hostname'), 'PC1');
  assert.match(rodar(lan(), 'help'), /ipconfig.*\n.*ping/);
  assert.match(rodar(lan(), 'ajuda'), /Comandos disponíveis/);
  assert.deepEqual(executar(criarSimulacao(lan()), 'pc1', 'cls'), { linhas: [], limpar: true });
  assert.deepEqual(executar(criarSimulacao(lan()), 'pc1', '   '), { linhas: [], limpar: false });
});

test('comando desconhecido e dispositivo sem terminal', () => {
  assert.match(rodar(lan(), 'dir'), /'dir' não é reconhecido/);
  assert.match(rodar(lan(), 'format c:'), /'format' não é reconhecido/);
  assert.match(rodar(lan(), 'hostname', 'sw1'), /não tem terminal/);
});

test('ipconfig mostra IP, máscara e gateway; /all mostra MAC e nome', () => {
  let t = duasRedes();
  const s = rodar(t, 'ipconfig');
  assert.match(s, /Adaptador Ethernet Ethernet0:/);
  assert.match(s, /Endereço IPv4[ .]*: 192\.168\.1\.10/);
  assert.match(s, /Máscara de Sub-rede[ .]*: 255\.255\.255\.0/);
  assert.match(s, /Gateway Padrão[ .]*: 192\.168\.1\.1/);
  const all = rodar(t, 'IPCONFIG /ALL');
  assert.ok(all.includes(macDe('pc1', 'eth0').toUpperCase()));
  assert.match(all, /Nome do Host[ .]*: PC1/);
  assert.match(rodar(t, 'ipconfig /x'), /Opção inválida/);
});

test('ipconfig: interface sem IP, sem cabo e IP duplicado', () => {
  let t = lan();
  assert.match(rodar(cfg(t, 'pc1', 'eth0', '', ''), 'ipconfig'), /\(não configurado\)/);
  assert.match(rodar(removerCabo(t, 'c1').topologia, 'ipconfig'), /mídia desconectada/);
  const dup = cfg(t, 'pc2', 'eth0', '192.168.1.10');
  assert.match(rodar(dup, 'ipconfig'), /conflito com outro dispositivo/);
  assert.doesNotMatch(rodar(t, 'ipconfig'), /conflito/);
});

test('ping bem-sucedido: formato e estatísticas', () => {
  const s = rodar(lan(), 'ping 192.168.1.20');
  assert.match(s, /^Disparando contra 192\.168\.1\.20 com 32 bytes de dados:/);
  assert.equal(s.match(/Resposta de 192\.168\.1\.20: bytes=32 tempo<1ms TTL=128/g).length, 4);
  assert.match(s, /Enviados = 4, Recebidos = 4, Perdidos = 0 \(0% de perda\),/);
  assert.match(s, /Mínimo = 0ms, Máximo = 0ms, Média = 0ms/);
});

test('ping -n e ping por nome do dispositivo', () => {
  const s = rodar(lan(), 'ping -n 2 pc2');
  assert.match(s, /Disparando contra PC2 \[192\.168\.1\.20\]/);
  assert.equal(s.match(/Resposta de/g).length, 2);
  assert.match(rodar(lan(), 'ping -n 0 pc2'), /Valor incorreto/);
  assert.match(rodar(lan(), 'ping -n 11 pc2'), /Valor incorreto/);
  assert.match(rodar(lan(), 'ping'), /Uso: ping/);
  assert.match(rodar(lan(), 'ping fantasma'), /não pôde encontrar o host fantasma/);
  assert.match(rodar(lan(), 'ping 300.1.1.1'), /não pôde encontrar o host 300\.1\.1\.1/);
});

test('ping: as mensagens de cada falha', () => {
  const t = lan();
  assert.match(rodar(t, 'ping 192.168.1.99'), /Resposta de 192\.168\.1\.10: Host de destino inacessível\./);
  assert.match(rodar(t, 'ping 10.9.9.9'), /Resposta de 192\.168\.1\.10: Rede de destino inacessível\./);
  assert.match(rodar(cfg(t, 'pc1', 'eth0', '', ''), 'ping 192.168.1.20'), /PING: falha de transmissão\. Falha geral\./);
  assert.match(rodar(removerCabo(t, 'c1').topologia, 'ping 192.168.1.20'), /Falha geral/);
  const volta = rodar(cfg(t, 'pc2', 'eth0', '192.168.1.21', '/30'), 'ping 192.168.1.21');
  assert.match(volta, /Esgotado o tempo limite do pedido\./);
  assert.match(volta, /Recebidos = 0, Perdidos = 4 \(100% de perda\)$/m);
  assert.match(rodar(duasRedes(), 'ping 172.16.0.5'), /Resposta de 192\.168\.1\.1: Rede de destino inacessível\./);
  assert.match(rodar(duasRedes(), 'ping 10.0.0.77'), /Resposta de 192\.168\.1\.1: Host de destino inacessível\./);
});

test('ping entre redes mostra TTL 127', () => {
  assert.match(rodar(duasRedes(), 'ping 10.0.0.10'), /TTL=127/);
});

test('tracert lista os roteadores e o destino', () => {
  const s = rodar(duasRedes(), 'tracert 10.0.0.10');
  assert.match(s, /Rastreando a rota para 10\.0\.0\.10/);
  assert.match(s, /^\s{2}1 .*192\.168\.1\.1$/m);
  assert.match(s, /^\s{2}2 .*10\.0\.0\.10$/m);
  assert.match(s, /Rastreamento concluído\./);
  const mesma = rodar(lan(), 'tracert 192.168.1.20');
  assert.match(mesma, /^\s{2}1 .*192\.168\.1\.20$/m);
  assert.doesNotMatch(mesma, /^\s{2}2 /m);
  assert.match(rodar(lan(), 'tracert'), /Uso: tracert/);
  assert.match(rodar(duasRedes(), 'tracert 172.16.0.5'), /192\.168\.1\.1 {2}relata: Rede de destino inacessível\./);
});

test('arp -a lista só o que foi aprendido (começa vazio, enche após o ping)', () => {
  const sim = criarSimulacao(lan());
  assert.equal(rodar(lan(), 'arp -a', 'pc1', sim), 'Nenhuma entrada ARP encontrada.');
  executar(sim, 'pc1', 'ping -n 1 192.168.1.20');
  const s = rodar(lan(), 'arp -a', 'pc1', sim);
  assert.match(s, /Interface: 192\.168\.1\.10/);
  assert.ok(s.includes('192.168.1.20'));
  assert.ok(s.includes(macDe('pc2', 'eth0')));
  assert.match(s, /dinâmico/);
  assert.match(rodar(lan(), 'arp', 'pc1', sim), /Uso: arp -a/);
});

test('nome do dispositivo editado vale como hostname e como alvo de ping', () => {
  const t = renomear(lan(), 'pc2', 'Servidor').topologia;
  assert.match(rodar(t, 'ping -n 1 servidor'), /Disparando contra Servidor \[192\.168\.1\.20\]/);
  assert.equal(rodar(t, 'hostname', 'pc2'), 'Servidor');
});
