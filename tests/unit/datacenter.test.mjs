import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarDatacenter } from '../../js/datacenter/catalogo.js';
import { dispParalelo, minutosDeParada, textoParada, avaliarDesafio, menorCusto, validarDesafio } from '../../js/datacenter/disponibilidade.js';
import { limparDatacenter, normalizar, estadoInicial } from '../../js/core/storage.js';
import { xpDoEstado, xpDatacenter } from '../../js/core/progression.js';

const bruto = JSON.parse(readFileSync(new URL('../../data/datacenter.json', import.meta.url), 'utf8'));
const { camadas, desafios } = montarDatacenter(bruto);
const des = id => desafios.find(d => d.id === id);
const todas = n => ({ unidades: Object.fromEntries(camadas.map(c => [c.id, n])) });

test('contas de disponibilidade: paralelo e parada por ano', () => {
  assert.equal(dispParalelo(0.99, 1), 0.99);
  assert.ok(Math.abs(dispParalelo(0.99, 2) - 0.9999) < 1e-12);
  assert.ok(Math.abs(dispParalelo(0.99, 3) - 0.999999) < 1e-12);
  assert.equal(dispParalelo(0.99, 0), 0);
  assert.ok(Math.abs(minutosDeParada(0.9999) - 52.56) < 0.01, 'quatro noves = 52,56 min/ano');
  assert.ok(Math.abs(minutosDeParada(0.999) / 60 - 8.76) < 0.01, 'três noves = 8,76 h/ano');
  assert.equal(minutosDeParada(1.5), 0);
  assert.match(textoParada(52.56), /52,6 min\/ano/);
  assert.match(textoParada(525.6), /8,8 h\/ano/);
  assert.match(textoParada(0.5), /30 s\/ano/);
});

test('dados válidos e cada desafio tem solução dentro do orçamento, com folga pequena', () => {
  assert.equal(camadas.length, bruto.camadas.length);
  assert.equal(desafios.length, bruto.desafios.length);
  for (const d of desafios) {
    const c = menorCusto(d, camadas);
    assert.ok(c <= d.orcamento, `${d.id}: o mais barato custa ${c}, orçamento ${d.orcamento}`);
    assert.ok(d.orcamento - c <= 8000, `${d.id}: folga de ${d.orcamento - c}`);
    assert.ok(avaliarDesafio(d, camadas, todas(4)).aprovado === false, `${d.id}: "tudo no máximo" estoura o orçamento`);
  }
});

test('o plano de uma unidade por camada não cumpre nenhuma meta (a rede em série é frágil)', () => {
  for (const d of desafios) {
    const r = avaliarDesafio(d, camadas, todas(1));
    assert.equal(r.aprovado, false);
    assert.equal(r.itens.find(i => i.id === 'sla').ok, false);
  }
  const r = avaliarDesafio(des('loja-virtual'), camadas, todas(1));
  assert.ok(Math.abs(r.total - 0.999 * 0.9995 * 0.9999 * 0.999 * 0.998) < 1e-12);
});

test('planos corretos são aprovados', () => {
  assert.equal(avaliarDesafio(des('loja-virtual'), camadas, { unidades: { acesso: 2, agregacao: 1, nucleo: 1, energia: 2, internet: 2 } }).aprovado, true);
  assert.equal(avaliarDesafio(des('sistema-bancario'), camadas, todas(2)).aprovado, true);
  assert.equal(avaliarDesafio(des('pronto-socorro'), camadas, { unidades: { acesso: 2, agregacao: 2, nucleo: 2, energia: 2, internet: 3 } }).aprovado, true);
});

test('cada regra reprova sozinha', () => {
  const d = des('sistema-bancario');
  const falha = plano => avaliarDesafio(d, camadas, plano).itens.filter(i => !i.ok).map(i => i.id);
  assert.deepEqual(falha({ unidades: { ...todas(2).unidades, internet: 0 } }), ['camadas', 'sla'], 'camada ausente');
  assert.deepEqual(falha({ unidades: { ...todas(2).unidades, internet: 1 } }), ['sla'], 'elo fraco derruba a meta');
  const um = falha({ unidades: { ...todas(2).unidades, acesso: 1 } });
  assert.ok(um.includes('sla') && !um.includes('portas'), 'um switch de acesso só: a meta falha, mas 48 portas bastam para 30 servidores');
  assert.deepEqual(falha(todas(3)), ['orcamento']);
});

test('portas: com 1 switch de acesso cada servidor usa 1 porta; com 2 ou mais, 2 portas', () => {
  const d = { ...des('loja-virtual'), servidores: 30, orcamento: Infinity };
  const base = todas(2).unidades;
  const r1 = avaliarDesafio(d, camadas, { unidades: { ...base, acesso: 1 } }).itens.find(i => i.id === 'portas');
  assert.equal(r1.ok, true, '48 ≥ 30');
  const r2 = avaliarDesafio({ ...d, servidores: 30 }, camadas, { unidades: { ...base, acesso: 2 } }).itens.find(i => i.id === 'portas');
  assert.equal(r2.ok, true, '96 ≥ 60');
  const r3 = avaliarDesafio({ ...d, servidores: 50 }, camadas, { unidades: { ...base, acesso: 2 } }).itens.find(i => i.id === 'portas');
  assert.equal(r3.ok, false, '2 switches = 96 portas < 100 (50 servidores × 2)');
});

test('quantidades inválidas contam como zero e o teto é 4', () => {
  const d = des('loja-virtual');
  const r = avaliarDesafio(d, camadas, { unidades: { acesso: -1, agregacao: 1.5, nucleo: 'x', energia: 99, internet: null } });
  assert.equal(r.porCamada.find(c => c.id === 'energia').unidades, 4);
  assert.equal(r.porCamada.find(c => c.id === 'acesso').unidades, 0);
  assert.equal(r.custo, 4 * camadas.find(c => c.id === 'energia').custo);
});

test('validação dos dados', () => {
  const base = bruto.desafios[0];
  assert.equal(validarDesafio(null, camadas), null);
  assert.equal(validarDesafio({ ...base, sla: 1 }, camadas), null);
  assert.equal(validarDesafio({ ...base, sla: 0.5 }, camadas), null);
  assert.equal(validarDesafio({ ...base, camadaAcesso: 'nada' }, camadas), null);
  assert.equal(validarDesafio({ ...base, id: 'Mau Id' }, camadas), null);
  assert.equal(validarDesafio({ ...base, xp: 99999 }, camadas).xp, 100);
  assert.equal(montarDatacenter(undefined).desafios.length, 0);
  assert.equal(montarDatacenter({ camadas: bruto.camadas, desafios: [base, base] }).desafios.length, 1);
  assert.equal(montarDatacenter({ camadas: [{ id: 'a', nome: 'a', disp: 2, custo: 1 }], desafios: [] }).camadas.length, 0);
});

test('estado salvo do Data Center é saneado e o XP soma uma vez por desafio', () => {
  const conhecidos = new Set(['loja-virtual']);
  const r = limparDatacenter({
    'loja-virtual': { unidades: { acesso: 2, 'Mau Id': 1, x: 99, y: 'a' }, concluida: true, em: '2026-11-18T10:00:00.000Z', xp: 150 },
    fantasma: { concluida: true, xp: 5 }
  }, conhecidos);
  assert.deepEqual(Object.keys(r), ['loja-virtual']);
  assert.deepEqual(r['loja-virtual'], { unidades: { acesso: 2 }, concluida: true, em: '2026-11-18T10:00:00.000Z', xp: 150 });
  assert.equal(limparDatacenter({ 'loja-virtual': { concluida: true, xp: 99999, em: 'x' } }, conhecidos)['loja-virtual'].concluida, false);
  assert.deepEqual(limparDatacenter('lixo', conhecidos), {});
  const ref = { limites: {}, perguntas: new Set(), conquistas: new Set(), datacenter: conhecidos };
  assert.deepEqual(normalizar({ versao: 4 }, ref).datacenter, {});
  const e = estadoInicial();
  e.datacenter = { a: { concluida: true, xp: 200 }, b: { concluida: false, xp: 0 } };
  assert.equal(xpDatacenter(e.datacenter), 200);
  assert.equal(xpDoEstado(e), 200);
});

test('conquista Alta disponibilidade só com desafio aprovado', async () => {
  const { avaliar } = await import('../../js/hub/conquistas-regras.js');
  const e = estadoInicial();
  const cat = { limites: {}, jogaveis: [{ id: 1 }], missoes: [] };
  e.datacenter = { a: { concluida: false } };
  assert.ok(!avaliar(e, cat).includes('alta-disponibilidade'));
  e.datacenter.a.concluida = true;
  assert.ok(avaliar(e, cat).includes('alta-disponibilidade'));
});
