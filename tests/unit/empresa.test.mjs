import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarEmpresa } from '../../js/empresa/catalogo.js';
import { alocarVlsm, avaliarProjeto, capacidade, enderecosNecessarios, prefixoMinimoPara, menorCusto, validarProjeto } from '../../js/empresa/planejamento.js';
import { limparEmpresa, normalizar, estadoInicial } from '../../js/core/storage.js';
import { xpDoEstado, xpEmpresa } from '../../js/core/progression.js';

const bruto = JSON.parse(readFileSync(new URL('../../data/empresa.json', import.meta.url), 'utf8'));
const { equipamentos, projetos } = montarEmpresa(bruto);
const proj = id => projetos.find(p => p.id === id);

test('dados: nada descartado e cada projeto tem solução dentro do orçamento (com folga pequena)', () => {
  assert.equal(projetos.length, bruto.projetos.length);
  assert.equal(equipamentos.length, bruto.equipamentos.length);
  for (const p of projetos) {
    const c = menorCusto(p, equipamentos);
    assert.ok(c <= p.orcamento, `${p.id}: o mais barato custa ${c} e o orçamento é ${p.orcamento}`);
    assert.ok(p.orcamento - c <= 300, `${p.id}: orçamento folgado demais (${p.orcamento - c})`);
  }
});

test('capacidade e necessidade: contas de sub-rede', () => {
  assert.equal(capacidade(24), 254);
  assert.equal(capacidade(27), 30);
  assert.equal(capacidade(30), 2);
  assert.equal(enderecosNecessarios(25, 20), 31, '30 + 1 de gateway');
  assert.equal(enderecosNecessarios(12, 20), 16, '14,4 arredonda para 15, +1');
  assert.equal(enderecosNecessarios(3, 50), 6);
  assert.equal(prefixoMinimoPara(31), 26);
  assert.equal(prefixoMinimoPara(30), 27);
  assert.equal(prefixoMinimoPara(5), 29);
});

test('VLSM: aloca do maior para o menor, alinhado, e devolve na ordem recebida', () => {
  const r = alocarVlsm('192.168.10.0/24', [{ id: 'a', prefixo: 28 }, { id: 'b', prefixo: 26 }, { id: 'c', prefixo: 27 }]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocos.map(b => [b.id, b.rede, b.primeiro, b.ultimo, b.broadcast]), [
    ['a', '192.168.10.96', '192.168.10.97', '192.168.10.110', '192.168.10.111'],
    ['b', '192.168.10.0', '192.168.10.1', '192.168.10.62', '192.168.10.63'],
    ['c', '192.168.10.64', '192.168.10.65', '192.168.10.94', '192.168.10.95']
  ]);
  assert.equal(r.usados, 112);
});

test('VLSM: estouro do bloco, prefixo maior que o bloco e bloco inválido são recusados', () => {
  assert.equal(alocarVlsm('172.16.5.0/25', [{ id: 'a', prefixo: 26 }, { id: 'b', prefixo: 26 }, { id: 'c', prefixo: 28 }]).ok, false);
  assert.match(alocarVlsm('172.16.5.0/25', [{ id: 'a', prefixo: 24 }]).erro, /não cabe/);
  assert.equal(alocarVlsm('lixo', []).ok, false);
  assert.equal(alocarVlsm('10.0.0.0/31', []).ok, false);
  // bloco-base desalinhado é normalizado para a rede do bloco
  assert.equal(alocarVlsm('192.168.10.77/24', [{ id: 'a', prefixo: 24 }]).blocos[0].rede, '192.168.10.0');
});

const planoBom = {
  'escritorio-contabil': { prefixos: { administrativo: 27, financeiro: 28, atendimento: 27 }, equip: { switch8: 6, roteador: 1 } },
  clinica: { prefixos: { recepcao: 28, consultorios: 27, administracao: 28, servidores: 29 }, equip: { switch24: 1, switch8: 1, roteador: 1 } },
  'filial-apertada': { prefixos: { vendas: 26, estoque: 28, ti: 28, caixa: 29 }, equip: { switch24: 2, roteador: 1 } }
};

test('um plano correto é aprovado em cada projeto', () => {
  for (const p of projetos) {
    const r = avaliarProjeto(p, equipamentos, planoBom[p.id]);
    assert.deepEqual(r.itens.filter(i => !i.ok), [], `${p.id}: ${JSON.stringify(r.itens.filter(i => !i.ok))}`);
    assert.equal(r.aprovado, true);
  }
});

test('plano vazio não é aprovado e explica o que falta', () => {
  const r = avaliarProjeto(proj('escritorio-contabil'), equipamentos, {});
  assert.equal(r.aprovado, false);
  assert.deepEqual(r.itens.filter(i => !i.ok).map(i => i.id), ['sub-administrativo', 'sub-financeiro', 'sub-atendimento', 'vlsm', 'portas', 'roteador'], 'só o orçamento (custo zero) está ok');
  assert.match(r.itens[0].detalhe, /escolha um prefixo/);
});

test('cada regra reprova sozinha', () => {
  const p = proj('escritorio-contabil');
  const bom = planoBom[p.id];
  const falha = plano => avaliarProjeto(p, equipamentos, plano).itens.filter(i => !i.ok).map(i => i.id);
  assert.deepEqual(falha({ ...bom, prefixos: { ...bom.prefixos, financeiro: 29 } }), ['sub-financeiro'], 'sub-rede pequena');
  assert.deepEqual(falha({ ...bom, equip: { switch8: 5, roteador: 1 } }), ['portas'], 'faltam portas (35 < 38)');
  assert.deepEqual(falha({ ...bom, equip: { switch8: 6 } }), ['roteador']);
  assert.deepEqual(falha({ ...bom, equip: { switch24: 2, roteador: 1 } }), ['orcamento']);
  assert.deepEqual(falha({ ...bom, prefixos: { administrativo: 24, financeiro: 24, atendimento: 24 } }), ['vlsm'], 'três /24 não cabem em um /24');
});

test('desperdício vira aviso, não reprovação', () => {
  const p = proj('escritorio-contabil');
  const r = avaliarProjeto(p, equipamentos, { ...planoBom[p.id], prefixos: { administrativo: 27, financeiro: 26, atendimento: 27 } });
  assert.equal(r.aprovado, true);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /Financeiro/);
});

test('quantidades inválidas contam como zero e o teto é respeitado', () => {
  const p = proj('escritorio-contabil');
  const r = avaliarProjeto(p, equipamentos, { prefixos: {}, equip: { switch8: -3, roteador: 1.5, switch24: 'x' } });
  assert.equal(r.custo, 0);
  const r2 = avaliarProjeto(p, equipamentos, { prefixos: {}, equip: { switch8: 9999 } });
  assert.equal(r2.custo, 50 * 250);
});

test('validarProjeto rejeita lixo', () => {
  const base = bruto.projetos[0];
  assert.equal(validarProjeto(null), null);
  assert.equal(validarProjeto({ ...base, id: 'Maiúscula' }), null);
  assert.equal(validarProjeto({ ...base, bloco: '300.1.1.0/24' }), null);
  assert.equal(validarProjeto({ ...base, setores: [{ id: 'x', nome: 'x', hosts: 0 }] }), null);
  assert.equal(validarProjeto({ ...base, xp: 99999 }).xp, 100);
  assert.equal(validarProjeto({ ...base, setores: [...base.setores, base.setores[0]] }).setores.length, base.setores.length, 'setor repetido');
  assert.equal(montarEmpresa(null).projetos.length, 0);
  assert.equal(montarEmpresa({ projetos: [base, base] }).projetos.length, 1);
});

test('estado salvo da Empresa é saneado', () => {
  const conhecidos = new Set(['clinica']);
  const r = limparEmpresa({
    clinica: { prefixos: { recepcao: 28, 'Mau Id': 28, x: 99, y: 'a' }, equip: { switch8: 3, roteador: -1 }, concluida: true, em: 'ontem', xp: 99999 },
    fantasma: { concluida: true, xp: 100 }, outro: 5
  }, conhecidos);
  assert.deepEqual(Object.keys(r), ['clinica']);
  assert.deepEqual(r.clinica, { prefixos: { recepcao: 28 }, equip: { switch8: 3 }, concluida: false, em: null, xp: 0 });
  assert.deepEqual(limparEmpresa('lixo', conhecidos), {});
  assert.deepEqual(limparEmpresa([1], conhecidos), {});
});

test('normalizar mantém estado antigo sem o campo empresa e lê o novo', () => {
  const ref = { limites: {}, perguntas: new Set(), conquistas: new Set(), missoes: new Set(), empresa: new Set(['clinica']) };
  assert.deepEqual(normalizar({ versao: 4, perfil: { nome: 'A' } }, ref).empresa, {});
  const e = normalizar({ versao: 4, empresa: { clinica: { prefixos: { recepcao: 28 }, equip: {}, concluida: true, em: '2026-11-18T10:00:00.000Z', xp: 200 } } }, ref);
  assert.equal(e.empresa.clinica.xp, 200);
  assert.deepEqual(estadoInicial().empresa, {});
});

test('XP da Empresa soma uma vez por projeto aprovado; conquista só com projeto aprovado', async () => {
  const { avaliar } = await import('../../js/hub/conquistas-regras.js');
  const e = estadoInicial();
  e.empresa = { a: { concluida: true, xp: 200 }, b: { concluida: false, xp: 0 } };
  assert.equal(xpEmpresa(e.empresa), 200);
  assert.equal(xpDoEstado(e), 200);
  const cat = { limites: {}, jogaveis: [{ id: 1 }], missoes: [] };
  assert.ok(avaliar(e, cat).includes('planejador'));
  e.empresa.a.concluida = false;
  assert.ok(!avaliar(e, cat).includes('planejador'));
});
