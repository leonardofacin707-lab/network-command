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
    // Níveis que eram "em breve" na v0.1 podem ter ganhado conteúdo depois (níveis 4 e 5); o que já existia não muda.
    if (!antigo.desafios) continue;
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
          // Os distratores foram reescritos na 1.5 (achado 4 da auditoria: a certa era a mais longa em 11 de 14).
          // Enunciado, resposta certa e explicação seguem idênticos; a quantidade de alternativas também.
          assert.equal(q.alternativas.length, d.opcoes.length);
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

test('a resposta certa não se destaca pelo tamanho (achado 4 da auditoria)', () => {
  const quizzes = perguntas.filter(q => q.tipo === 'pergunta');
  const maisLonga = quizzes.filter(q => {
    const t = q.alternativas.map(a => a.length);
    return t[q.correta] === Math.max(...t);
  }).length;
  assert.ok(maisLonga / quizzes.length <= 0.5, `a certa é a mais longa em ${maisLonga} de ${quizzes.length}`);
});

test('níveis jogáveis: 9 desafios cada, com resumo, categoria e sequência sem buracos', () => {
  const jogaveis = niveis.filter(n => n.desafios);
  assert.deepEqual(jogaveis.map(n => n.id), jogaveis.map((_, i) => i + 1), 'os níveis jogáveis são 1..N, sem buracos');
  const ids = niveis.map(n => n.id);
  // um nível "em breve" nunca fica antes de um jogável (senão o jogável nunca abriria)
  const primeiroEmBreve = niveis.findIndex(n => !n.desafios);
  assert.ok(niveis.slice(primeiroEmBreve).every(n => !n.desafios), `ordem dos níveis: ${ids}`);
  for (const n of jogaveis) {
    assert.equal(n.desafios.length, 9, `nível ${n.id}`);
    assert.ok(n.categoria && n.resumo?.length >= 3, `nível ${n.id}`);
  }
});

test('níveis acrescentados (4 em diante): tipos variados e respostas numéricas conferidas', () => {
  const porId = new Map(perguntas.map(q => [q.id, q]));
  for (const nivel of niveis.filter(n => n.desafios && n.id >= 4).map(n => n.id)) {
    const tipos = new Set(perguntas.filter(q => q.nivel === nivel).map(q => q.tipo));
    assert.equal(tipos.size, 5, `nível ${nivel} usa os 5 tipos`);
  }
  assert.equal(porId.get('ethernet-002').resposta, 48);
  assert.equal(porId.get('ipv4-001').resposta, 32);
  assert.equal(porId.get('ipv4-002').resposta, parseInt('11000000', 2));
  // ordem do quadro Ethernet e dos prefixos (menos hosts → mais hosts)
  assert.deepEqual(porId.get('ethernet-003').itens, ['Preâmbulo', 'MAC de destino', 'MAC de origem', 'Tipo', 'Dados', 'FCS']);
  assert.deepEqual(porId.get('ipv4-007').itens, ['/30', '/27', '/24', '/16']);
  assert.ok(porId.get('ipv4-007').itens.map(i => 2 ** (32 - Number(i.slice(1)))).every((v, i, a) => i === 0 || v > a[i - 1]));
});

// As respostas do quiz de endereçamento são conferidas com a aritmética IPv4 do motor (outra implementação).
test('níveis 5 e 6: as contas do quiz batem com o motor IPv4', async () => {
  const ip = await import('../../js/sim/ipv4.js');
  const porId = new Map(perguntas.map(q => [q.id, q]));
  const m = p => ip.mascaraDePrefixo(p);
  const quad = n => ip.formatarIPv4(n);
  assert.equal(porId.get('subnetting-001').resposta, 32 - 27);
  assert.equal(porId.get('subnetting-002').resposta, ip.hostsUteis(m(26)));
  assert.equal(quad(m(26)), '255.255.255.192');
  const s3 = porId.get('subnetting-003');
  assert.equal(s3.alternativas[s3.correta], quad(m(26)));
  for (const p of porId.get('subnetting-004').pares) {
    assert.equal(ip.hostsUteis(m(Number(p.esquerda.slice(1)))), Number(p.direita.split(' ')[0]), p.esquerda);
  }
  // cada host cai na rede /26 indicada
  const s5 = porId.get('subnetting-005');
  for (const it of s5.itens) {
    const rede = quad(ip.enderecoDeRede(ip.lerIPv4(it.texto), m(26)));
    assert.equal(`${rede}/26`, s5.grupos[it.grupo], it.texto);
  }
  assert.equal(ip.hostsUteis(m(26)) >= 50 && ip.hostsUteis(m(27)) < 50, true);
  assert.equal(porId.get('subnetting-007').resposta, 2 ** (27 - 24));
  const s9 = porId.get('subnetting-009');
  assert.equal(s9.alternativas[s9.correta], quad(ip.enderecoDeRede(ip.lerIPv4('172.16.45.200'), m(20))));
  // nível 5
  const i8 = porId.get('ipv4-008');
  assert.equal(i8.alternativas[i8.correta], quad(ip.enderecoDeBroadcast(ip.lerIPv4('192.168.10.0'), m(24))));
  const i9 = porId.get('ipv4-009');
  assert.ok(ip.mesmaRede(ip.lerIPv4('192.168.1.10'), ip.lerIPv4(i9.alternativas[i9.correta]), m(24)));
  i9.alternativas.forEach((a, i) => { if (i !== i9.correta) assert.ok(!ip.mesmaRede(ip.lerIPv4('192.168.1.10'), ip.lerIPv4(a), m(24)), a); });
  for (const [p, m2] of [[8, '255.0.0.0'], [16, '255.255.0.0'], [24, '255.255.255.0'], [25, '255.255.255.128']]) assert.equal(quad(m(p)), m2);
});

test('nível 7 (IPv6): contas e formatos conferidos', () => {
  const porId = new Map(perguntas.map(q => [q.id, q]));
  assert.equal(porId.get('ipv6-001').resposta, 8 * 16);
  assert.equal(porId.get('ipv6-007').resposta, 64);
  // a forma abreviada correta expande para o endereço completo do enunciado (no máximo um "::")
  const expandir = t => {
    assert.ok(!t.includes(':::') && (t.match(/::/g) ?? []).length <= 1, `formato inválido: ${t}`);
    const [a, b] = t.includes('::') ? t.split('::') : [t, null];
    const A = a ? a.split(':') : [], B = b ? b.split(':') : [];
    const meio = b === null ? [] : Array(8 - A.length - B.length).fill('0');
    return [...A, ...meio, ...B].map(g => g.padStart(4, '0')).join(':');
  };
  const q4 = porId.get('ipv6-004');
  const completo = q4.enunciado.match(/[0-9a-f:]{30,}/)[0];
  assert.equal(expandir(q4.alternativas[q4.correta]), completo);
  for (const [i, a] of q4.alternativas.entries()) if (i !== q4.correta) assert.ok(!/^[0-9a-f:]+$/.test(a) || (() => { try { return expandir(a) !== completo; } catch { return true; } })(), a);
  // 48 + 16 + 64 = 128
  assert.deepEqual(porId.get('ipv6-009').itens.map(i => Number(i.match(/\((\d+) bits\)/)[1])).reduce((x, y) => x + y), 128);
  assert.deepEqual(porId.get('ipv6-009').itens.map(i => i.split(' (')[0]), ['Prefixo de roteamento global', 'ID da sub-rede', 'ID da interface']);
});

test('nível 8 (DHCP e NAT): ordem do DORA e porta do servidor', () => {
  const porId = new Map(perguntas.map(q => [q.id, q]));
  assert.deepEqual(porId.get('dhcp-002').itens, ['DHCPDISCOVER', 'DHCPOFFER', 'DHCPREQUEST', 'DHCPACK']);
  assert.equal(porId.get('dhcp-004').resposta, 67);
  assert.equal(niveis.find(n => n.id === 8).desafios.length, 9);
});
