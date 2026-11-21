// Configurações do aparelho, provedores de conta (só o local existe) e sincronização entre aparelhos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { limparConfig, configPadrao } from '../../js/core/config.js';
import { PROVEDORES, provedorValido, provedorAtivo, CAMPOS_PROVEDOR } from '../../js/conta/provedores.js';
import { codificarEstado, decodificarCodigo, extrairCodigo, mesclarEstados, resumoProgresso, PREFIXO_COMPACTO, PREFIXO_SIMPLES, MAX_JSON } from '../../js/conta/sincronizar.js';
import { normalizar, estadoInicial, limparTutorial } from '../../js/core/storage.js';

const ref = { limites: { 1: 300, 2: 300 }, perguntas: new Set(['p1', 'p2', 'p3']), conquistas: new Set(['c1', 'c2']), missoes: new Set(['m1', 'm2']), empresa: new Set(['e1']), datacenter: new Set(['d1']) };
const em = m => new Date(Date.UTC(2026, 10, 1, 12, m)).toISOString();
const topoUm = { dispositivos: [{ id: 'pc1', tipo: 'pc', nome: 'PC1', x: 100, y: 100, interfaces: [{ id: 'eth0', ip: '', mascara: '' }], gateway: '' }], cabos: [] };

test('config: só valores conhecidos; o resto volta ao padrão', () => {
  assert.deepEqual(limparConfig(null), configPadrao());
  assert.deepEqual(limparConfig({ movimento: 'reduzir', inicio: 'dashboard', extra: 1 }), { movimento: 'reduzir', inicio: 'dashboard' });
  assert.deepEqual(limparConfig({ movimento: '<script>', inicio: 'laboratorio' }), configPadrao());
});

test('estado: config e tutorial passam pela validação', () => {
  const e = normalizar({ versao: 4, config: { movimento: 'reduzir' }, tutorial: { concluido: true, em: 'ontem', topologia: 'lixo' } }, ref);
  assert.equal(e.config.movimento, 'reduzir');
  assert.equal(e.tutorial.concluido, false, 'conclusão sem data válida não vale');
  assert.deepEqual(e.tutorial.topologia, { dispositivos: [], cabos: [] });
  assert.equal(limparTutorial({ concluido: true, em: em(1) }).concluido, true);
});

test('provedores: só o local existe, segue o formato e não pede login', () => {
  assert.equal(PROVEDORES.length, 1);
  for (const p of PROVEDORES) { assert.ok(provedorValido(p), p.id); assert.ok(p.disponivel); for (const c of CAMPOS_PROVEDOR) assert.ok(c in p, c); }
  assert.equal(provedorAtivo().id, 'local');
  assert.equal(provedorAtivo().precisaLogin, false);
  assert.equal(provedorValido({ id: 'Conta!', nome: 'x', descricao: 'y', disponivel: true, precisaLogin: true }), false);
});

for (const comprimir of [true, false]) {
  test(`código de sincronização ${comprimir ? 'comprimido' : 'simples'}: ida e volta sem perda, sem a config`, async () => {
    const estado = { ...estadoInicial(), perfil: { nome: 'Léo', criadoEm: em(0) }, quiz: { melhor: { 1: { pts: 200, estrelas: 2 } }, historico: [{ q: 'p1', ok: true, erros: 0, pts: 100, em: em(1) }] }, config: { movimento: 'reduzir', inicio: 'dashboard' } };
    const codigo = await codificarEstado(estado, { comprimir });
    assert.ok(codigo.startsWith(comprimir ? PREFIXO_COMPACTO : PREFIXO_SIMPLES));
    assert.match(codigo, /^NC[01]\.[A-Za-z0-9_-]+$/, 'só caracteres seguros para link');
    const r = await decodificarCodigo(`  https://exemplo.github.io/jogo/#/sincronizar/${codigo}  `);
    assert.equal(r.erro, undefined);
    assert.equal(r.estado.perfil.nome, 'Léo');
    assert.deepEqual(r.estado.quiz, estado.quiz);
    assert.equal(r.estado.config, undefined, 'preferências do aparelho não viajam');
  });
}

test('código: rejeita lixo, códigos alterados, de outro app e grandes demais', async () => {
  assert.ok((await decodificarCodigo('')).erro);
  assert.ok((await decodificarCodigo('olá mundo')).erro);
  assert.ok((await decodificarCodigo('NC1.@@@')).erro);
  const bom = await codificarEstado(estadoInicial());
  assert.ok((await decodificarCodigo(bom.slice(0, -6))).erro, 'código cortado');
  const outroApp = PREFIXO_SIMPLES + Buffer.from(JSON.stringify({ app: 'outro', estado: {} })).toString('base64url');
  assert.ok((await decodificarCodigo(outroApp)).erro);
  // "bomba" de compressão: muito pequeno comprimido, enorme ao abrir
  const enorme = { app: 'network-command', estado: { lixo: 'a'.repeat(MAX_JSON * 2) } };
  const bomba = await codificarEstado(enorme.estado);
  assert.ok(bomba.length < 100_000);
  assert.match((await decodificarCodigo(bomba)).erro, /incompleto|grande/);
});

test('extrairCodigo aceita link ou código com quebras de linha', () => {
  assert.equal(extrairCodigo('NC0.ab\ncd'), 'NC0.abcd');
  assert.equal(extrairCodigo('https://x.io/#/sincronizar/NC1.xyz'), 'NC1.xyz');
});

test('juntar: nada se perde e fica o melhor de cada item', () => {
  const celular = normalizar({ versao: 4, perfil: { nome: 'Leo', criadoEm: em(5) },
    quiz: { melhor: { 1: { pts: 100, estrelas: 1 } }, historico: [{ q: 'p1', ok: false, erros: 1, pts: 0, em: em(1) }, { q: 'p2', ok: true, erros: 0, pts: 100, em: em(3) }] },
    conquistas: { c1: em(4) }, missoes: { m1: { topologia: topoUm, concluida: true, em: em(2), xp: 80, dicas: 1 } },
    diario: { ultimoDia: '2026-11-20', sequencia: 3, melhor: 3 }, simulados: { geral: { melhor: 70, em: em(1), tentativas: 2 } },
    config: { movimento: 'reduzir', inicio: 'inicio' } }, ref);
  const pc = normalizar({ versao: 4, perfil: { nome: '', criadoEm: em(0) },
    quiz: { melhor: { 1: { pts: 250, estrelas: 2 }, 2: { pts: 50, estrelas: 0 } }, historico: [{ q: 'p1', ok: false, erros: 1, pts: 0, em: em(1) }, { q: 'p3', ok: true, erros: 0, pts: 100, em: em(2) }] },
    conquistas: { c1: em(2), c2: em(6) }, missoes: { m1: { topologia: topoUm, concluida: true, em: em(1), xp: 100, dicas: 0 }, m2: { topologia: topoUm, concluida: false, em: null, xp: 0, dicas: 2 } },
    diario: { ultimoDia: '2026-11-21', sequencia: 1, melhor: 5 }, simulados: { geral: { melhor: 90, em: em(7), tentativas: 1 } },
    tutorial: { concluido: true, em: em(3) }, config: { movimento: 'sistema', inicio: 'dashboard' } }, ref);

  const j = normalizar(mesclarEstados(celular, pc), ref);
  assert.equal(j.perfil.nome, 'Leo');
  assert.equal(j.perfil.criadoEm, em(0), 'conta desde o mais antigo');
  assert.deepEqual(j.quiz.melhor, { 1: { pts: 250, estrelas: 2 }, 2: { pts: 50, estrelas: 0 } });
  assert.deepEqual(j.quiz.historico.map(r => r.q), ['p1', 'p3', 'p2'], 'união sem repetir, em ordem de data');
  assert.deepEqual(j.conquistas, { c1: em(2), c2: em(6) });
  assert.equal(j.missoes.m1.xp, 100);
  assert.equal(j.missoes.m2.dicas, 2);
  assert.deepEqual(j.diario, { ultimoDia: '2026-11-21', sequencia: 1, melhor: 5 });
  assert.equal(j.simulados.geral.melhor, 90);
  assert.equal(j.tutorial.concluido, true);
  assert.deepEqual(j.config, { movimento: 'reduzir', inicio: 'inicio' }, 'preferências deste aparelho ficam');

  // juntar de novo não muda nada (pode sincronizar quantas vezes quiser)
  assert.deepEqual(normalizar(mesclarEstados(j, pc), ref), j);
  assert.deepEqual(normalizar(mesclarEstados(j, celular), ref), j);
  assert.equal(resumoProgresso(j).missoes, 1);
  assert.equal(resumoProgresso(j).respostas, 3);
});

test('juntar com um estado vazio ou lixo mantém o local', () => {
  const local = normalizar({ versao: 4, perfil: { nome: 'Ana', criadoEm: em(0) }, conquistas: { c1: em(1) } }, ref);
  assert.deepEqual(normalizar(mesclarEstados(local, normalizar({ versao: 4, perfil: { criadoEm: em(9) } }, ref)), ref), local);
  assert.deepEqual(normalizar(mesclarEstados(local, normalizar('lixo', ref)), ref).conquistas, local.conquistas);
});
