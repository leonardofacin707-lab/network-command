import test from 'node:test';
import assert from 'node:assert/strict';
import { topologiaVazia, adicionarDispositivo, moverDispositivo, renomear, configurarInterface, configurarGateway, conectar, removerCabo, removerDispositivo, normalizarTopologia, portasLivres, vizinhos, dispositivo, MAX_DISPOSITIVOS, LARGURA, ALTURA } from '../../js/sim/topologia.js';

const montar = (...tipos) => tipos.reduce((t, tipo) => adicionarDispositivo(t, tipo).topologia, topologiaVazia());

test('adicionar dispositivos gera ids e nomes únicos e preenche as interfaces', () => {
  let t = montar('pc', 'pc', 'switch', 'roteador');
  assert.deepEqual(t.dispositivos.map(d => [d.id, d.nome]), [['pc1', 'PC1'], ['pc2', 'PC2'], ['sw1', 'SW1'], ['r1', 'R1']]);
  assert.equal(dispositivo(t, 'pc1').interfaces.length, 1);
  assert.equal(dispositivo(t, 'pc1').gateway, '');
  assert.equal(dispositivo(t, 'r1').interfaces.length, 2);
  assert.equal(dispositivo(t, 'sw1').interfaces.length, 0);
  t = removerDispositivo(t, 'pc1').topologia;
  assert.equal(adicionarDispositivo(t, 'pc').id, 'pc1', 'reaproveita o menor número livre');
  assert.match(adicionarDispositivo(t, 'tv').erro, /desconhecido/);
});

test('limite de dispositivos', () => {
  let t = topologiaVazia();
  for (let i = 0; i < MAX_DISPOSITIVOS; i++) t = adicionarDispositivo(t, 'pc').topologia;
  assert.match(adicionarDispositivo(t, 'pc').erro, /no máximo 16/);
});

test('mover limita ao tamanho da área de trabalho', () => {
  const t = montar('pc');
  const m = moverDispositivo(t, 'pc1', -500, 99999).topologia.dispositivos[0];
  assert.deepEqual([m.x, m.y], [40, ALTURA - 40]);
  assert.equal(moverDispositivo(t, 'pc1', 99999, 0).topologia.dispositivos[0].x, LARGURA - 40);
  assert.ok(moverDispositivo(t, 'nao-existe', 1, 1).erro);
});

test('renomear valida formato e unicidade (sem diferenciar maiúsculas)', () => {
  const t = montar('pc', 'pc');
  assert.equal(renomear(t, 'pc1', 'Servidor-1').topologia.dispositivos[0].nome, 'Servidor-1');
  for (const ruim of ['', '  ', '-x', 'nome com espaço', 'a'.repeat(16), '<b>', 'ação']) assert.ok(renomear(t, 'pc1', ruim).erro, ruim);
  assert.match(renomear(t, 'pc1', 'pc2').erro, /Já existe/);
  assert.ok(renomear(t, 'pc1', 'PC1').topologia, 'pode manter o próprio nome');
});

test('configurar interface: valida IP e máscara, aceita /24, normaliza e permite limpar', () => {
  const t = montar('pc');
  const ok = configurarInterface(t, 'pc1', 'eth0', { ip: ' 192.168.1.10 ', mascara: '/24' }).topologia;
  assert.deepEqual(dispositivo(ok, 'pc1').interfaces[0], { id: 'eth0', ip: '192.168.1.10', mascara: '255.255.255.0' });
  assert.match(configurarInterface(t, 'pc1', 'eth0', { ip: '300.1.1.1', mascara: '/24' }).erro, /IPv4 inválido/);
  assert.match(configurarInterface(t, 'pc1', 'eth0', { ip: '192.168.1.10', mascara: '255.0.255.0' }).erro, /Máscara inválida/);
  assert.match(configurarInterface(t, 'pc1', 'eth0', { ip: '192.168.1.0', mascara: '/24' }).erro, /endereço de rede/);
  assert.match(configurarInterface(t, 'pc1', 'eth0', { ip: '', mascara: '/24' }).erro, /Informe o endereço IP/);
  assert.match(configurarInterface(t, 'pc1', 'eth0', { ip: '10.0.0.1', mascara: '' }).erro, /Informe a máscara/);
  assert.ok(configurarInterface(t, 'pc1', 'fa9', { ip: '', mascara: '' }).erro);
  const limpo = configurarInterface(ok, 'pc1', 'eth0', { ip: '', mascara: '' }).topologia;
  assert.deepEqual(dispositivo(limpo, 'pc1').interfaces[0], { id: 'eth0', ip: '', mascara: '' });
  assert.equal(dispositivo(ok, 'pc1').interfaces[0].ip, '192.168.1.10', 'não muta o original');
});

test('gateway: só PCs, valida formato, aceita limpar', () => {
  const t = montar('pc', 'switch');
  assert.equal(configurarGateway(t, 'pc1', '192.168.1.1').topologia.dispositivos[0].gateway, '192.168.1.1');
  assert.match(configurarGateway(t, 'pc1', '1.1.1').erro, /Gateway inválido/);
  assert.match(configurarGateway(t, 'sw1', '1.1.1.1').erro, /Só computadores/);
  assert.equal(configurarGateway(configurarGateway(t, 'pc1', '1.1.1.1').topologia, 'pc1', '').topologia.dispositivos[0].gateway, '');
});

test('conectar usa portas livres e recusa casos inválidos', () => {
  let t = montar('pc', 'pc', 'switch');
  const r = conectar(t, 'pc1', 'sw1');
  assert.deepEqual(r.cabo, { id: 'c1', a: { d: 'pc1', p: 'eth0' }, b: { d: 'sw1', p: 'fa1' } });
  t = r.topologia;
  t = conectar(t, 'pc2', 'sw1').topologia;
  assert.equal(t.cabos[1].b.p, 'fa2');
  assert.match(conectar(t, 'pc1', 'sw1').erro, /já estão ligados/);
  assert.match(conectar(t, 'pc1', 'pc1').erro, /ele mesmo/);
  assert.match(conectar(t, 'pc1', 'pc2').erro, /não tem porta livre/);
  assert.ok(conectar(t, 'pc1', 'fantasma').erro);
  assert.equal(portasLivres(t, 'sw1').length, 6);
  assert.deepEqual(vizinhos(t, 'sw1').map(v => v.outro.d).sort(), ['pc1', 'pc2']);
});

test('um switch com as 8 portas ocupadas recusa o nono cabo', () => {
  let t = montar('switch');
  for (let i = 0; i < 8; i++) { t = adicionarDispositivo(t, 'pc').topologia; t = conectar(t, `pc${i + 1}`, 'sw1').topologia; }
  t = adicionarDispositivo(t, 'pc').topologia;
  assert.match(conectar(t, 'pc9', 'sw1').erro, /SW1 não tem porta livre/);
});

test('remover cabo e remover dispositivo (leva os cabos junto)', () => {
  let t = montar('pc', 'switch');
  t = conectar(t, 'pc1', 'sw1').topologia;
  assert.equal(removerCabo(t, 'c1').topologia.cabos.length, 0);
  const sem = removerDispositivo(t, 'sw1').topologia;
  assert.equal(sem.cabos.length, 0);
  assert.equal(sem.dispositivos.length, 1);
  assert.equal(t.cabos.length, 1, 'não muta o original');
});

test('normalizarTopologia descarta lixo e repara o que dá', () => {
  for (const lixo of [null, undefined, 5, 'x', [], {}, { dispositivos: 'x', cabos: 3 }]) assert.deepEqual(normalizarTopologia(lixo), topologiaVazia());
  const t = normalizarTopologia({
    dispositivos: [
      { id: 'pc1', tipo: 'pc', nome: 'Meu-PC', x: -50, y: 1e9, interfaces: [{ id: 'eth0', ip: '10.0.0.5', mascara: '255.0.0.0' }], gateway: '10.0.0.1' },
      { id: 'pc2', tipo: 'pc', nome: 'meu-pc', x: 100, y: 100, interfaces: [{ id: 'eth0', ip: '10.0.0.0', mascara: '255.0.0.0' }], gateway: 'lixo' },
      { id: 'pc1', tipo: 'pc', nome: 'duplicado' },
      { id: 'sw1', tipo: 'switch', nome: '<img src=x>' },
      { id: 'tv1', tipo: 'tv', nome: 'TV' },
      { tipo: 'pc' }, null, 7
    ],
    cabos: [
      { id: 'c1', a: { d: 'pc1', p: 'eth0' }, b: { d: 'sw1', p: 'fa1' } },
      { id: 'c2', a: { d: 'pc2', p: 'eth0' }, b: { d: 'sw1', p: 'fa1' } },     // porta do switch repetida
      { id: 'c3', a: { d: 'pc2', p: 'eth0' }, b: { d: 'pc2', p: 'eth0' } },     // consigo mesmo
      { id: 'c4', a: { d: 'pc2', p: 'eth9' }, b: { d: 'sw1', p: 'fa2' } },      // porta inexistente
      { id: 'c5', a: { d: 'pc2', p: 'eth0' }, b: { d: 'fantasma', p: 'fa2' } },
      { id: 'c1', a: { d: 'pc2', p: 'eth0' }, b: { d: 'sw1', p: 'fa3' } },      // id repetido
      { id: 'c6', a: { d: 'pc1', p: 'eth0' }, b: { d: 'sw1', p: 'fa4' } }       // pc1 já ligado e par repetido
    ]
  });
  assert.deepEqual(t.dispositivos.map(d => d.id), ['pc1', 'pc2', 'sw1']);
  assert.deepEqual([t.dispositivos[0].x, t.dispositivos[0].y], [40, ALTURA - 40]);
  assert.equal(t.dispositivos[0].interfaces[0].ip, '10.0.0.5');
  assert.equal(t.dispositivos[1].nome, 'PC2', 'nome repetido (sem diferenciar maiúsculas) vira o id');
  assert.equal(t.dispositivos[1].interfaces[0].ip, '', 'IP de rede é descartado');
  assert.equal(t.dispositivos[1].gateway, '');
  assert.equal(t.dispositivos[2].nome, 'SW1', 'nome com HTML é trocado');
  assert.deepEqual(t.cabos.map(c => c.id), ['c1']);
});

test('normalizar é idempotente numa topologia válida', () => {
  let t = montar('pc', 'pc', 'switch', 'roteador');
  t = conectar(t, 'pc1', 'sw1').topologia;
  t = conectar(t, 'pc2', 'sw1').topologia;
  t = configurarInterface(t, 'pc1', 'eth0', { ip: '192.168.1.10', mascara: '/24' }).topologia;
  assert.deepEqual(normalizarTopologia(t), t);
  assert.deepEqual(normalizarTopologia(JSON.parse(JSON.stringify(t))), t);
});
