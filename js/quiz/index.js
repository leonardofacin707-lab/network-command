// Módulo Conhecimento (quiz): mapa de níveis, partida, resultado, revisão de erros, histórico e desempenho por assunto.
import { desenharMapa, pararMapa } from './map.js';
import { criarSessao } from './session.js';
import { telaResultado } from './resultado.js';
import { telaRevisao, telaHistorico, telaAssuntos, telaTreino } from './abas.js';
import { desafiosLiberados, sortearTreino } from './treino.js';
import { registrarResposta, listaRevisao } from './historico.js';
import { statusDoNivel } from './unlock.js';
import { limparHash } from '../app/router.js';

const ABAS = [['', 'Mapa de níveis'], ['treino', 'Treino misto'], ['revisao', 'Revisão de erros'], ['historico', 'Histórico'], ['assuntos', 'Por assunto']];

export default {
  id: 'conhecimento',
  montar(raiz, { catalogo, store }, params = []) {
    const aba = params[0] ?? '';
    raiz.innerHTML = `<nav class="abas" id="abas" aria-label="Seções do Conhecimento">
        ${ABAS.map(([id, nome]) => `<a class="aba" href="#/conhecimento${id ? '/' + id : ''}" ${id === (['nivel'].includes(aba) ? '' : aba) ? 'aria-current="page"' : ''}>${nome}</a>`).join('')}
      </nav><div id="tela"></div>`;
    const tela = raiz.querySelector('#tela');
    const abas = raiz.querySelector('#abas');
    const ctx = { app: tela, catalogo, store };

    const sessao = criarSessao(ctx,
      run => { abas.hidden = false; telaResultado(ctx, run); },
      resposta => store.alterar(e => ({ ...e, quiz: { ...e.quiz, historico: registrarResposta(e.quiz.historico, resposta) } })));

    // Mantém a aba destacada igual à tela exibida (o botão "Mapa" troca a tela sem trocar a rota).
    const marcarAba = href => abas.querySelectorAll('.aba').forEach(a => (a.getAttribute('href') === href ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const abrirMapa = () => { sessao.encerrar(); abas.hidden = false; desenharMapa(ctx); };
    const jogar = nivel => { abas.hidden = true; sessao.iniciar(nivel); };
    const jogarId = id => jogar(catalogo.niveis.find(n => n.id === id));
    const revisar = () => {
      const porId = new Map(catalogo.perguntas.map(q => [q.id, q]));
      const desafios = listaRevisao(store.obter().quiz.historico).map(id => porId.get(id));
      if (desafios.length) jogar({ id: 'revisao', nome: 'Revisão de erros', revisao: true, desafios });
    };

    const treinar = () => {
      const desafios = sortearTreino(desafiosLiberados(catalogo.niveis, store.obter().quiz.melhor));
      if (desafios.length) jogar({ id: 'treino', nome: 'Treino misto', revisao: true, treino: true, desafios });
    };

    const cliques = e => {
      const alvo = e.target.closest('button');
      if (!alvo) return;
      if (alvo.classList.contains('no')) {
        if (!alvo.hasAttribute('aria-disabled')) jogarId(Number(alvo.dataset.nivel));
        return;
      }
      const acao = alvo.dataset.acao;
      if (acao === 'mapa') { limparHash('conhecimento'); marcarAba('#/conhecimento'); return abrirMapa(); }
      if (acao === 'jogar') return jogarId(Number(alvo.dataset.nivel));
      if (acao === 'revisar') return revisar();
      if (acao === 'treinar') return treinar();
      if (acao === 'proximo') return sessao.proximo();
      sessao.clique(alvo);
    };
    const envio = e => { if (e.target.id === 'form-num') { e.preventDefault(); sessao.enviarNumero(); } };
    raiz.addEventListener('click', cliques);
    raiz.addEventListener('submit', envio);

    if (aba === 'treino') telaTreino(tela, ctx);
    else if (aba === 'revisao') telaRevisao(tela, ctx);
    else if (aba === 'historico') telaHistorico(tela, ctx);
    else if (aba === 'assuntos') telaAssuntos(tela, ctx);
    else {
      abrirMapa();
      // atalho do dashboard: #/conhecimento/nivel/2 abre o nível, se ele estiver liberado
      if (aba === 'nivel') {
        const nivel = catalogo.niveis.find(n => n.id === Number(params[1]));
        limparHash('conhecimento');
        if (nivel && ['aberto', 'feito'].includes(statusDoNivel(nivel, catalogo.niveis, store.obter().quiz.melhor))) jogar(nivel);
      }
    }

    return () => { pararMapa(); sessao.encerrar(); raiz.removeEventListener('click', cliques); raiz.removeEventListener('submit', envio); };
  }
};
