// Módulo Conhecimento (quiz): junta mapa, partida e resultado e trata os cliques da tela.
import { desenharMapa } from './map.js';
import { criarSessao } from './session.js';
import { telaResultado } from './resultado.js';

export function criarQuiz(ctx) {
  const sessao = criarSessao(ctx, run => telaResultado(ctx, run));
  const abrirMapa = () => { sessao.encerrar(); desenharMapa(ctx); };
  const jogar = id => sessao.iniciar(ctx.catalogo.niveis.find(n => n.id === id));

  document.addEventListener('click', e => {
    const alvo = e.target.closest('button');
    if (!alvo) return;
    if (alvo.classList.contains('no')) {
      if (!alvo.hasAttribute('aria-disabled')) jogar(Number(alvo.dataset.nivel));
      return;
    }
    const acao = alvo.dataset.acao;
    if (acao === 'mapa') return abrirMapa();
    if (acao === 'jogar') return jogar(Number(alvo.dataset.nivel));
    if (acao === 'proximo') return sessao.proximo();
    sessao.clique(alvo);
  });

  document.addEventListener('submit', e => {
    if (e.target.id === 'form-num') { e.preventDefault(); sessao.enviarNumero(); }
  });

  return { abrirMapa };
}
