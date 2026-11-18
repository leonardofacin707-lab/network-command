import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarResposta, ultimaPorPergunta, listaRevisao, estatisticas } from '../../js/quiz/historico.js';
import { dominioPorHabilidade, desempenhoPorAssunto, pontosFracos } from '../../js/hub/dominio.js';
import { CONQUISTAS, avaliar, concederNovas, IDS_CONQUISTAS } from '../../js/hub/conquistas-regras.js';
import { nivelDoJogador } from '../../js/core/progression.js';
import { estadoInicial, MAX_HISTORICO } from '../../js/core/storage.js';

const t = min => new Date(Date.UTC(2026, 0, 1, 12, min));
const resp = (q, ok, erros, pts) => ({ q, ok, erros, pts });

test('nível do jogador: 300 XP por nível', () => {
  assert.deepEqual(nivelDoJogador(0), { nivel: 1, xpNoNivel: 0, xpParaProximo: 300 });
  assert.deepEqual(nivelDoJogador(299), { nivel: 1, xpNoNivel: 299, xpParaProximo: 300 });
  assert.deepEqual(nivelDoJogador(300), { nivel: 2, xpNoNivel: 0, xpParaProximo: 300 });
  assert.equal(nivelDoJogador(2700).nivel, 10);
});

test('registrarResposta não muta e limita o tamanho', () => {
  const vazio = [];
  const um = registrarResposta(vazio, resp('a', true, 0, 100), t(0));
  assert.equal(vazio.length, 0);
  assert.deepEqual(um, [{ q: 'a', ok: true, erros: 0, pts: 100, em: t(0).toISOString() }]);
  let h = [];
  for (let i = 0; i < MAX_HISTORICO + 10; i++) h = registrarResposta(h, resp('a', true, 0, 100), t(i));
  assert.equal(h.length, MAX_HISTORICO);
});

test('revisão: só a última tentativa conta, e acerto com tropeço ainda pede revisão', () => {
  let h = [];
  h = registrarResposta(h, resp('a', false, 1, 0), t(1));   // errou
  h = registrarResposta(h, resp('b', true, 1, 60), t(2));   // acertou com um erro
  h = registrarResposta(h, resp('c', true, 0, 100), t(3));  // perfeita
  h = registrarResposta(h, resp('a', true, 0, 100), t(4));  // 'a' foi refeita e ficou perfeita
  assert.deepEqual(listaRevisao(h), ['b']);
  h = registrarResposta(h, resp('c', false, 1, 0), t(5));   // 'c' piorou depois
  assert.deepEqual(listaRevisao(h), ['c', 'b'], 'mais recente primeiro');
  assert.equal(ultimaPorPergunta(h).get('a').ok, true);
  assert.deepEqual(estatisticas(h), { total: 5, perfeitas: 2, taxa: 0.4 });
  assert.equal(estatisticas([]).taxa, null);
});

const perguntas = [
  { id: 'a', categoria: 'fundamentos', assunto: 'Internet', habilidade: 'fundamentos.teoria' },
  { id: 'b', categoria: 'fundamentos', assunto: 'Latência', habilidade: 'fundamentos.teoria' },
  { id: 'c', categoria: 'osi-tcpip', assunto: 'Modelo OSI', habilidade: 'fundamentos.teoria' },
  { id: 'd', categoria: 'ipv4', assunto: 'Endereços', habilidade: 'ip.teoria' }
];

test('domínio por habilidade conta as perguntas dominadas (última tentativa perfeita)', () => {
  let h = [];
  h = registrarResposta(h, resp('a', true, 0, 100), t(1));
  h = registrarResposta(h, resp('b', true, 1, 60), t(2));
  assert.deepEqual(dominioPorHabilidade(h, perguntas), {
    'fundamentos.teoria': { total: 3, dominadas: 1 },
    'ip.teoria': { total: 1, dominadas: 0 }
  });
  assert.deepEqual(dominioPorHabilidade([], perguntas)['ip.teoria'], { total: 1, dominadas: 0 });
});

test('desempenho por assunto usa todas as tentativas e ignora o que nunca foi respondido', () => {
  let h = [];
  h = registrarResposta(h, resp('a', false, 1, 0), t(1));
  h = registrarResposta(h, resp('a', true, 0, 100), t(2));
  h = registrarResposta(h, resp('c', true, 0, 100), t(3));
  h = registrarResposta(h, resp('zzz', true, 0, 100), t(4)); // pergunta que não existe mais
  const d = desempenhoPorAssunto(h, perguntas);
  assert.equal(d.length, 2);
  assert.deepEqual(d.find(x => x.assunto === 'Internet'), { categoria: 'fundamentos', assunto: 'Internet', tentativas: 2, perfeitas: 1, taxa: 0.5 });
  assert.deepEqual(pontosFracos(d).map(x => x.assunto), ['Internet'], 'quem está em 100% não é ponto fraco');
  assert.deepEqual(pontosFracos([]), []);
});

test('conquistas: cada regra depende de dados reais', () => {
  const catalogo = { limites: { 1: 900, 2: 900 }, jogaveis: [{ id: 1 }, { id: 2 }] };
  const novo = () => estadoInicial();
  assert.deepEqual(avaliar(novo(), catalogo), []);

  let e = novo();
  e.quiz.historico = registrarResposta([], resp('a', true, 0, 100), t(1));
  assert.deepEqual(avaliar(e, catalogo), ['primeiro-passo']);

  e = novo();
  e.quiz.melhor = { 1: { pts: 900, estrelas: 3 } };
  assert.deepEqual(avaliar(e, catalogo).sort(), ['nivel-dominado', 'nota-maxima']);
  e.quiz.melhor[2] = { pts: 400, estrelas: 1 };
  assert.ok(avaliar(e, catalogo).includes('trilha-completa'));
  e.quiz.melhor[2] = { pts: 100, estrelas: 0 };
  assert.ok(!avaliar(e, catalogo).includes('trilha-completa'));

  e = novo();
  e.quiz.melhor = { 1: { pts: 900, estrelas: 3 }, 2: { pts: 900, estrelas: 3 }, 3: { pts: 600, estrelas: 1 } };
  assert.ok(avaliar(e, catalogo).includes('tecnico-de-redes'));

  e = novo();
  e.perfil.nome = 'Leo';
  assert.deepEqual(avaliar(e, catalogo), ['identificado']);

  e = novo();
  e.quiz.historico = Array.from({ length: 10 }, (_, i) => ({ q: 'a', ok: true, erros: 0, pts: 100, em: t(i).toISOString() }));
  assert.ok(avaliar(e, catalogo).includes('de-primeira'));
  e.quiz.historico = Array.from({ length: 50 }, (_, i) => ({ q: 'a', ok: false, erros: 1, pts: 0, em: t(i).toISOString() }));
  assert.ok(avaliar(e, catalogo).includes('perseverante'));
  assert.ok(!avaliar(e, catalogo).includes('de-primeira'));
});

test('"Aprendeu com o erro" exige errar primeiro e acertar de primeira depois', () => {
  const catalogo = { limites: {}, jogaveis: [] };
  const com = lista => ({ ...estadoInicial(), quiz: { melhor: {}, historico: lista.reduce((h, r, i) => registrarResposta(h, r, t(i)), []) } });
  assert.ok(avaliar(com([resp('a', false, 1, 0), resp('a', true, 0, 100)]), catalogo).includes('aprendeu-com-o-erro'));
  assert.ok(!avaliar(com([resp('a', true, 0, 100), resp('a', true, 0, 100)]), catalogo).includes('aprendeu-com-o-erro'));
  assert.ok(!avaliar(com([resp('a', false, 1, 0), resp('b', true, 0, 100)]), catalogo).includes('aprendeu-com-o-erro'));
  assert.ok(!avaliar(com([resp('a', true, 0, 100), resp('a', false, 1, 0)]), catalogo).includes('aprendeu-com-o-erro'));
});

test('concederNovas registra a data uma vez só e devolve o mesmo estado se nada mudou', () => {
  const catalogo = { limites: {}, jogaveis: [] };
  const e = { ...estadoInicial(), perfil: { nome: 'Leo', criadoEm: t(0).toISOString() } };
  const e2 = concederNovas(e, catalogo, t(5));
  assert.equal(e2.conquistas.identificado, t(5).toISOString());
  assert.equal(concederNovas(e2, catalogo, t(9)), e2, 'sem novas, mesmo objeto');
  assert.equal(e.conquistas.identificado, undefined, 'não muta o original');
});

test('conquistas têm ids únicos e textos', () => {
  assert.equal(new Set(IDS_CONQUISTAS).size, CONQUISTAS.length);
  for (const c of CONQUISTAS) assert.ok(c.nome && c.descricao && typeof c.teste === 'function');
});
