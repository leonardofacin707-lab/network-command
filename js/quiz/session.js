// Uma partida de um nível: desenha cada desafio, repassa as respostas ao tipo certo e acumula os pontos.
import { $, esc, reduzMovimento } from '../core/ui.js';
import { pararMapa } from './map.js';
import pergunta from './types/pergunta.js';
import ligar from './types/ligar.js';
import classificar from './types/classificar.js';
import ordenar from './types/ordenar.js';
import numero from './types/numero.js';

const TIPOS = { pergunta, ligar, classificar, ordenar, numero };

export function criarSessao(ctx, aoTerminar) {
  const { app } = ctx;
  let run = null; // { nivel, i, pts, acertos, erros, fim, est }

  const atual = () => run.nivel.desafios[run.i];
  const api = { finalizar };

  function iniciar(nivel) {
    if (!nivel || !nivel.desafios) return;
    pararMapa();
    run = { nivel, i: 0, pts: 0, acertos: 0 };
    telaDesafio();
  }

  function telaDesafio() {
    const q = atual();
    const total = run.nivel.desafios.length;
    run.erros = 0;
    run.fim = false;
    run.est = {};
    app.innerHTML = `
      <section class="band"><div class="jogo">
        <div class="barra">
          <button class="btn-sec" data-acao="mapa">← Mapa</button>
          <div><b>Nível ${run.nivel.id} · ${esc(run.nivel.nome)}</b>
            <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${run.i}"><i style="width:${run.i / total * 100}%"></i></div></div>
          <span class="pts">${run.pts} pts</span>
        </div>
        <article class="painel card">
          <p class="tipo">${TIPOS[q.tipo].rotulo} · ${run.i + 1} de ${total}</p>
          <h2>${esc(q.enunciado)}</h2>
          <div id="area"></div>
          <div id="feedback" aria-live="polite"></div>
        </article>
      </div></section>`;
    TIPOS[q.tipo].renderizar(q, run);
    window.scrollTo({ top: 0 });
  }

  function finalizar(acertou, pts) {
    const q = atual();
    run.fim = true;
    run.pts += pts;
    if (pts > 0) run.acertos++;
    const ultimo = run.i === run.nivel.desafios.length - 1;
    const titulo = !acertou ? 'Não foi dessa vez' : run.erros === 0 ? 'Perfeito!' : run.erros === 1 ? 'Certo, com um tropeço' : 'Concluído';
    $('.pts').textContent = run.pts + ' pts';
    $('#feedback').innerHTML = `<div class="fb ${acertou ? 'bom' : 'ruim'}">
      <b>${titulo}</b> <span>+${pts} pts</span>
      <p>${esc(q.explicacao)}</p>
      <div class="acoes"><button class="btn" data-acao="proximo">${ultimo ? 'Ver resultado' : 'Continuar'}</button></div>
    </div>`;
    $('[data-acao="proximo"]').focus({ preventScroll: true });
    $('#feedback').scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'nearest' });
  }

  return {
    iniciar,
    ativa: () => run !== null,
    resultadoAtual: () => run,
    encerrar() { run = null; },
    clique(alvo) {
      if (!run || run.fim) return;
      const q = atual();
      TIPOS[q.tipo].clique(alvo, q, run, api);
    },
    enviarNumero() {
      if (!run || run.fim) return;
      const q = atual();
      if (q.tipo === 'numero') TIPOS.numero.enviar(q, run, api);
    },
    proximo() {
      if (!run) return;
      run.i++;
      if (run.i < run.nivel.desafios.length) telaDesafio(); else aoTerminar(run);
    }
  };
}
