import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = c => JSON.parse(readFileSync(new URL('../../' + c, import.meta.url), 'utf8'));
const perguntas = ler('data/questions.json');
const niveis = ler('data/levels.json');
const categorias = ler('data/categories.json');
const habilidades = ler('data/skills.json');
const legado = ler('tests/fixtures/legado.json');

const TIPOS = ['pergunta', 'ligar', 'classificar', 'ordenar', 'numero'];

test('toda pergunta tem os campos obrigatórios e referências válidas', () => {
  const ids = new Set();
  const cats = new Set(categorias.map(c => c.id));
  const trilhas = new Set(habilidades.trilhas.map(t => t.id));
  const grau = new Set(habilidades.niveis.map(n => n.id));
  for (const q of perguntas) {
    assert.ok(!ids.has(q.id), `id repetido: ${q.id}`);
    ids.add(q.id);
    assert.ok(TIPOS.includes(q.tipo), `${q.id}: tipo ${q.tipo}`);
    assert.ok(cats.has(q.categoria), `${q.id}: categoria ${q.categoria}`);
    assert.ok([1, 2, 3].includes(q.dificuldade), `${q.id}: dificuldade`);
    const [trilha, nivel] = q.habilidade.split('.');
    assert.ok(trilhas.has(trilha) && grau.has(nivel), `${q.id}: habilidade ${q.habilidade}`);
    for (const campo of ['assunto', 'enunciado', 'explicacao']) {
      assert.equal(typeof q[campo], 'string', `${q.id}.${campo}`);
      assert.ok(q[campo].trim().length > 0, `${q.id}.${campo} vazio`);
    }
  }
});

test('cada tipo de pergunta tem um conteúdo coerente', () => {
  for (const q of perguntas) {
    if (q.tipo === 'pergunta') {
      assert.ok(q.alternativas.length >= 3, q.id);
      assert.equal(new Set(q.alternativas).size, q.alternativas.length, `${q.id}: alternativas repetidas`);
      assert.ok(Number.isInteger(q.correta) && q.correta >= 0 && q.correta < q.alternativas.length, q.id);
    } else if (q.tipo === 'ligar') {
      assert.ok(q.pares.length >= 2, q.id);
      assert.equal(new Set(q.pares.map(p => p.direita)).size, q.pares.length, `${q.id}: lados direitos repetidos`);
    } else if (q.tipo === 'classificar') {
      assert.ok(q.grupos.length >= 2, q.id);
      for (const i of q.itens) assert.ok(Number.isInteger(i.grupo) && i.grupo >= 0 && i.grupo < q.grupos.length, `${q.id}: grupo inválido`);
      for (let g = 0; g < q.grupos.length; g++) assert.ok(q.itens.some(i => i.grupo === g), `${q.id}: grupo ${g} sem itens`);
    } else if (q.tipo === 'ordenar') {
      assert.equal(new Set(q.itens).size, q.itens.length, `${q.id}: itens repetidos`);
    } else if (q.tipo === 'numero') {
      assert.equal(typeof q.resposta, 'number', q.id);
      assert.ok(q.dica, `${q.id}: sem dica`);
    }
  }
});

test('os níveis apontam para perguntas existentes do mesmo nível', () => {
  const porId = new Map(perguntas.map(q => [q.id, q]));
  const usadas = new Set();
  for (const n of niveis) {
    for (const id of n.desafios ?? []) {
      assert.ok(porId.has(id), `nível ${n.id}: ${id} não existe`);
      assert.equal(porId.get(id).nivel, n.id);
      assert.ok(!usadas.has(id), `${id} em dois níveis`);
      usadas.add(id);
    }
  }
  assert.equal(usadas.size, perguntas.length, 'há pergunta que não pertence a nenhum nível');
});

// Garantia de preservação: o quiz original continua inteiro nos dados novos.
test('preservação: todo o conteúdo da v0.1 está nos dados novos', () => {
  const porId = new Map(perguntas.map(q => [q.id, q]));
  let total = 0;
  for (const antigo of legado) {
    const novo = niveis.find(n => n.id === antigo.id);
    assert.equal(novo.nome, antigo.nome);
    assert.equal(novo.modulos, antigo.modulos);
    assert.equal(novo.icone, antigo.icone);
    if (!antigo.desafios) { assert.equal(novo.desafios, undefined); continue; }
    assert.deepEqual(novo.resumo, antigo.resumo);
    assert.equal(novo.desafios.length, antigo.desafios.length);
    antigo.desafios.forEach((d, i) => {
      const q = porId.get(novo.desafios[i]);
      total++;
      assert.equal(q.enunciado, d.pergunta);
      assert.equal(q.explicacao, d.explica);
      switch (d.tipo) {
        case 'quiz':
          assert.equal(q.tipo, 'pergunta');
          assert.equal(q.alternativas[q.correta], d.opcoes[d.certa]);
          assert.deepEqual([...q.alternativas].sort(), [...d.opcoes].sort());
          break;
        case 'ligar': assert.deepEqual(q.pares.map(p => [p.esquerda, p.direita]), d.pares); break;
        case 'classificar':
          assert.deepEqual(q.grupos, d.grupos);
          assert.deepEqual(q.itens.map(x => [x.texto, x.grupo]), d.itens);
          break;
        case 'ordenar': assert.deepEqual(q.itens, d.itens); break;
        case 'numero':
          assert.equal(q.resposta, d.resposta);
          assert.equal(q.unidade, d.unidade || '');
          assert.equal(q.dica, d.dica);
          break;
      }
    });
  }
  assert.equal(total, 27);
});
