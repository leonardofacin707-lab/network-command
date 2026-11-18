// DNS simplificado: cliente com servidor configurado, registros no servidor, nslookup e ping por nome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../js/sim/motor.js';
import { executar } from '../../js/sim/terminal.js';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarDnsPc, adicionarRegistroDns, removerRegistroDns, normalizarTopologia, MAX_REGISTROS_DNS } from '../../js/sim/topologia.js';

const ok = r => { assert.ok(!r.erro, r.erro); return r.topologia; };
// pc1 (cliente .10), pc2 (servidor DNS .50), pc3 (servidor web .60) ligados a sw1
function base({ dns = '192.168.1.50', registros = [['www.loja.local', '192.168.1.60']] } = {}) {
  let t = topologiaVazia();
  for (const tipo of ['pc', 'pc', 'pc', 'switch']) t = ok(adicionarDispositivo(t, tipo));
  ['pc1', 'pc2', 'pc3'].forEach((pc, i) => { t = ok(conectar(t, pc, 'sw1', 'eth0', `fa${i + 1}`)); });
  [['pc1', '.10'], ['pc2', '.50'], ['pc3', '.60']].forEach(([id, fim]) => { t = ok(configurarInterface(t, id, 'eth0', { ip: `192.168.1${fim}`, mascara: '/24' })); });
  if (dns) t = ok(configurarDnsPc(t, 'pc1', dns));
  for (const [nome, ip] of registros) t = ok(adicionarRegistroDns(t, 'pc2', { nome, ip }));
  return t;
}
const sim = t => criarSimulacao(t);

test('resolver: cliente com DNS, servidor com registro e destino alcançável', () => {
  const r = sim(base()).resolver('pc1', 'WWW.Loja.local');
  assert.equal(r.ok, true);
  assert.equal(r.ip, (192 << 24 | 168 << 16 | 1 << 8 | 60) >>> 0);
  assert.equal(r.servidor.d, 'pc2');
});

test('motivos de falha: sem DNS, servidor inalcançável, PC sem serviço, nome inexistente', () => {
  assert.equal(sim(base({ dns: '' })).resolver('pc1', 'www.loja.local').motivo, 'sem-dns');
  assert.equal(sim(base({ dns: '192.168.1.99' })).resolver('pc1', 'www.loja.local').motivo, 'dns-inalcancavel');
  assert.equal(sim(base({ dns: '192.168.1.60' })).resolver('pc1', 'www.loja.local').motivo, 'dns-sem-servico', 'pc3 não tem registros');
  assert.equal(sim(base()).resolver('pc1', 'outro.loja.local').motivo, 'nome-inexistente');
  assert.equal(sim(base()).resolver('pc2', 'www.loja.local').motivo, 'sem-dns', 'o servidor também precisa de DNS configurado para consultar');
});

test('ping e tracert por nome usam o DNS; o nome do dispositivo continua valendo como atalho', () => {
  const s = sim(base());
  const ping = executar(s, 'pc1', 'ping -n 1 www.loja.local').linhas.join('\n');
  assert.match(ping, /Disparando contra www\.loja\.local \[192\.168\.1\.60\]/);
  assert.match(ping, /Recebidos = 1/);
  assert.match(executar(s, 'pc1', 'ping -n 1 PC3').linhas.join('\n'), /Disparando contra PC3 \[192\.168\.1\.60\]/);
  assert.match(executar(sim(base({ dns: '' })), 'pc1', 'ping www.loja.local').linhas.join('\n'), /não pôde encontrar o host www\.loja\.local/);
  assert.match(executar(s, 'pc1', 'tracert www.loja.local').linhas.join('\n'), /Rastreando a rota para www\.loja\.local \[192\.168\.1\.60\]/);
});

test('registro apontando para IP errado: resolve, mas o ping não chega', () => {
  const t = base({ registros: [['www.loja.local', '192.168.1.61']] });
  const s = sim(t);
  assert.equal(s.resolver('pc1', 'www.loja.local').ok, true);
  const linhas = executar(s, 'pc1', 'ping -n 1 www.loja.local').linhas.join('\n');
  assert.match(linhas, /192\.168\.1\.61/);
  assert.match(linhas, /Recebidos = 0/);
});

test('nslookup: saída de sucesso e mensagens de cada falha', () => {
  const s = sim(base());
  assert.match(executar(s, 'pc1', 'nslookup www.loja.local').linhas.join('\n'), /Servidor:\s+PC2\nAddress:\s+192\.168\.1\.50\n\nNome:\s+www\.loja\.local\nAddress:\s+192\.168\.1\.60/);
  assert.match(executar(s, 'pc1', 'nslookup x.loja.local').linhas.join('\n'), /não encontrou x\.loja\.local: Non-existent domain/);
  assert.match(executar(sim(base({ dns: '' })), 'pc1', 'nslookup www.loja.local').linhas.join('\n'), /Nenhum servidor DNS está configurado/);
  assert.match(executar(sim(base({ dns: '192.168.1.99' })), 'pc1', 'nslookup www.loja.local').linhas.join('\n'), /não respondeu/);
  assert.match(executar(sim(base({ dns: '192.168.1.60' })), 'pc1', 'nslookup www.loja.local').linhas.join('\n'), /não é um servidor DNS/);
  assert.match(executar(s, 'pc1', 'nslookup').linhas[0], /Uso: nslookup/);
  assert.match(executar(s, 'pc1', 'ipconfig /all').linhas.join('\n'), /Servidores DNS[ .]*: 192\.168\.1\.50/);
});

test('validações, remover e limite', () => {
  const t = base();
  assert.match(configurarDnsPc(t, 'pc1', 'x').erro, /inválido/);
  assert.match(configurarDnsPc(t, 'sw1', '1.1.1.1').erro, /Só computadores/);
  assert.equal(ok(configurarDnsPc(t, 'pc1', '')).dispositivos.find(d => d.id === 'pc1').dns, undefined);
  const e = (campos, id = 'pc2', topo = t) => adicionarRegistroDns(topo, id, campos).erro;
  assert.match(e({ nome: 'www loja', ip: '1.1.1.1' }), /Nome inválido/);
  assert.match(e({ nome: '-x.local', ip: '1.1.1.1' }), /Nome inválido/);
  assert.match(e({ nome: 'a.local', ip: '999.1.1.1' }), /Endereço do registro inválido/);
  assert.match(e({ nome: 'WWW.loja.local', ip: '1.1.1.1' }), /Já existe/);
  assert.match(e({ nome: 'a.local', ip: '1.1.1.1' }, 'sw1'), /Só computadores/);
  let cheio = t;
  for (let i = 0; i < MAX_REGISTROS_DNS - 1; i++) cheio = ok(adicionarRegistroDns(cheio, 'pc2', { nome: `h${i}.local`, ip: '10.0.0.1' }));
  assert.match(e({ nome: 'extra.local', ip: '10.0.0.1' }, 'pc2', cheio), /Limite/);
  const vazio = ok(removerRegistroDns(t, 'pc2', 0));
  assert.equal(vazio.dispositivos.find(d => d.id === 'pc2').registros, undefined);
  assert.ok(removerRegistroDns(t, 'pc2', 3).erro);
});

test('normalização: descarta DNS e registros inválidos ou duplicados; só PCs têm esses campos', () => {
  const bruto = JSON.parse(JSON.stringify(base()));
  const pc2 = bruto.dispositivos.find(d => d.id === 'pc2');
  pc2.registros.push({ nome: 'WWW.LOJA.LOCAL', ip: '1.1.1.1' }, { nome: 'a b', ip: '1.1.1.1' }, { nome: 'ok.local', ip: 'x' }, 'lixo', null, { nome: 'novo.local', ip: '10.1.1.1' });
  bruto.dispositivos.find(d => d.id === 'pc1').dns = 'texto';
  bruto.dispositivos.find(d => d.id === 'sw1').dns = '1.1.1.1';
  const n = normalizarTopologia(bruto);
  assert.deepEqual(n.dispositivos.find(d => d.id === 'pc2').registros, [{ nome: 'www.loja.local', ip: '192.168.1.60' }, { nome: 'novo.local', ip: '10.1.1.1' }]);
  assert.equal(n.dispositivos.find(d => d.id === 'pc1').dns, undefined);
  assert.equal(n.dispositivos.find(d => d.id === 'sw1').dns, undefined);
});
