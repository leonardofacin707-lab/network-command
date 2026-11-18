// Abas do módulo Conhecimento além do mapa: revisão de erros, histórico e desempenho por assunto.
import { esc, dataHora } from '../core/ui.js';
import { listaRevisao, ultimaPorPergunta, estatisticas, foiPerfeita } from './historico.js';
import { desempenhoPorAssunto } from '../hub/dominio.js';
import { desafiosLiberados, TAMANHO_TREINO } from './treino.js';

const resumo = (t, n = 90) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const rotuloResultado = r => (foiPerfeita(r) ? '<span class="ok-txt">✓ De primeira</span>'
  : r.ok ? '<span class="aviso-txt">✓ Com tropeço</span>' : '<span class="ruim-txt">✗ Errou</span>');

export function telaRevisao(app, { catalogo, store }) {
  const historico = store.obter().quiz.historico;
  const ids = listaRevisao(historico);
  const porId = new Map(catalogo.perguntas.map(q => [q.id, q]));
  const ultimas = ultimaPorPergunta(historico);
  if (!ids.length) {
    app.innerHTML = `<section class="band"><div class="wrap painel">
      <h2>Revisão de erros</h2>
      <p class="vazio-msg">${historico.length ? 'Nenhum desafio para revisar: a última tentativa de cada um foi de primeira.' : 'Ainda não há respostas. Jogue um nível no mapa e os desafios com erro aparecerão aqui.'}</p>
    </div></section>`;
    return;
  }
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Revisão de erros</h2>
    <p>${ids.length} ${ids.length === 1 ? 'desafio teve' : 'desafios tiveram'} erro na última tentativa. Refazer não vale pontos, mas tira o desafio desta lista quando você acertar de primeira.</p>
    <table class="tabela"><thead><tr><th>Desafio</th><th>Assunto</th><th>Última tentativa</th></tr></thead><tbody>
      ${ids.map(id => { const q = porId.get(id); const r = ultimas.get(id); return `<tr>
        <td>${esc(resumo(q.enunciado))}</td><td>${esc(q.assunto)}</td><td>${rotuloResultado(r)}<br><small>${dataHora(r.em)}</small></td></tr>`; }).join('')}
    </tbody></table>
    <div class="acoes"><button class="btn" data-acao="revisar">Revisar agora (${ids.length})</button></div>
  </div></section>`;
}

export function telaHistorico(app, { catalogo, store }) {
  const historico = store.obter().quiz.historico;
  const porId = new Map(catalogo.perguntas.map(q => [q.id, q]));
  const est = estatisticas(historico);
  if (!historico.length) {
    app.innerHTML = `<section class="band"><div class="wrap painel"><h2>Histórico de respostas</h2>
      <p class="vazio-msg">Nada por aqui ainda. Cada desafio que você responder fica registrado neste dispositivo.</p></div></section>`;
    return;
  }
  const recentes = [...historico].reverse().slice(0, 40);
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Histórico de respostas</h2>
    <p>${est.total} respostas registradas · ${est.perfeitas} de primeira (${Math.round(est.taxa * 100)}%). Mostrando as ${recentes.length} mais recentes.</p>
    <table class="tabela"><thead><tr><th>Quando</th><th>Desafio</th><th>Resultado</th><th>Pontos</th></tr></thead><tbody>
      ${recentes.map(r => `<tr><td>${dataHora(r.em)}</td><td>${esc(resumo(porId.get(r.q).enunciado, 70))}</td><td>${rotuloResultado(r)}</td><td>${r.pts}</td></tr>`).join('')}
    </tbody></table>
  </div></section>`;
}

export function telaAssuntos(app, { catalogo, store }) {
  const lista = desempenhoPorAssunto(store.obter().quiz.historico, catalogo.perguntas)
    .sort((a, b) => a.taxa - b.taxa || b.tentativas - a.tentativas);
  const nomeCat = Object.fromEntries(catalogo.categorias.map(c => [c.id, c.nome]));
  if (!lista.length) {
    app.innerHTML = `<section class="band"><div class="wrap painel"><h2>Desempenho por assunto</h2>
      <p class="vazio-msg">O desempenho aparece aqui depois das primeiras respostas. Da pior para a melhor taxa de acertos de primeira.</p></div></section>`;
    return;
  }
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Desempenho por assunto</h2>
    <p>Acertos de primeira em relação às tentativas, do assunto que mais precisa de atenção para o mais firme.</p>
    <table class="tabela"><thead><tr><th>Assunto</th><th>Categoria</th><th>Tentativas</th><th>De primeira</th></tr></thead><tbody>
      ${lista.map(a => `<tr><td>${esc(a.assunto)}</td><td>${esc(nomeCat[a.categoria] ?? a.categoria)}</td><td>${a.tentativas}</td>
        <td><div class="barra-prog" role="img" aria-label="${Math.round(a.taxa * 100)}% de acertos de primeira"><i style="width:${a.taxa * 100}%"></i></div>${Math.round(a.taxa * 100)}%</td></tr>`).join('')}
    </tbody></table>
  </div></section>`;
}

export function telaTreino(app, { catalogo, store }) {
  const pool = desafiosLiberados(catalogo.niveis, store.obter().quiz.melhor);
  const quantos = Math.min(TAMANHO_TREINO, pool.length);
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Treino misto</h2>
    <p>Sorteia ${quantos} desafios entre os ${pool.length} dos níveis que você já liberou, de assuntos variados. Não vale pontos nem estrelas, mas as respostas entram no histórico: o que você errar vai para a revisão de erros.</p>
    <div class="acoes"><button class="btn" data-acao="treinar" ${quantos ? '' : 'disabled'}>Começar treino (${quantos})</button></div>
  </div></section>`;
}
