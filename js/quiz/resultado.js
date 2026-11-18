import { esc } from '../core/ui.js';
import { xpDoEstado, cargoDe } from '../core/progression.js';
import { maximoDoNivel, estrelasPorPontos, registrarResultado } from './scoring.js';
import { statusDoNivel } from './unlock.js';

/** Grava o resultado da partida no estado e mostra a tela de resultado. */
export function telaResultado({ app, catalogo, store }, run) {
  if (run.nivel.revisao) return telaResultadoRevisao(app, run);
  const n = run.nivel;
  const maximo = maximoDoNivel(n.desafios.length);
  const estrelas = estrelasPorPontos(run.pts, maximo);
  const antes = store.obter().quiz.melhor;
  const cargoAntes = cargoDe(xpDoEstado(store.obter()));
  const r = registrarResultado(antes, n.id, run.pts, estrelas);
  if (r.recorde) store.alterar(e => ({ ...e, quiz: { ...e.quiz, melhor: r.melhor } }));
  const melhor = store.obter().quiz.melhor;
  const cargoDepois = cargoDe(xpDoEstado(store.obter()));
  const prox = catalogo.niveis[catalogo.niveis.indexOf(n) + 1];
  // O botão depende do estado do próximo nível (não só desta partida): quem já liberou antes continua vendo o atalho.
  const liberou = prox && ['aberto', 'feito'].includes(statusDoNivel(prox, catalogo.niveis, melhor));

  app.innerHTML = `<section class="band"><div class="jogo">
    <article class="painel resultado">
      <span class="mods">Nível ${n.id} · ${esc(n.nome)}</span>
      <div class="grandes" aria-label="${estrelas} de 3 estrelas">${'★'.repeat(estrelas)}<span class="apagada">${'★'.repeat(3 - estrelas)}</span></div>
      <h2>${estrelas === 3 ? 'Nível dominado!' : estrelas > 0 ? 'Nível concluído' : 'Quase lá'}</h2>
      <p>${estrelas > 0 ? 'O pacote seguiu viagem pela rede.' : 'Faça pelo menos 40% dos pontos para ganhar 1 estrela e liberar o próximo nível.'}</p>
      <div class="resumo">
        <div><small>Pontos</small><b>${run.pts} / ${maximo}</b></div>
        <div><small>Acertos</small><b>${run.acertos} de ${n.desafios.length}</b></div>
        <div><small>Melhor resultado</small><b>${melhor[n.id] ? melhor[n.id].pts : 0}</b></div>
      </div>
      ${r.recorde && r.anterior ? '<p><b>Novo recorde neste nível!</b></p>' : ''}
      ${cargoDepois !== cargoAntes ? `<p class="cargo-novo">Promoção! Seu novo cargo: ${cargoDepois}</p>` : ''}
      <div class="acoes">
        ${liberou ? `<button class="btn" data-acao="jogar" data-nivel="${prox.id}">Próximo nível</button>` : ''}
        <button class="${liberou ? 'btn-sec' : 'btn'}" data-acao="jogar" data-nivel="${n.id}">Jogar de novo</button>
        <button class="btn-sec" data-acao="mapa">Voltar ao mapa</button>
      </div>
    </article>
  </div></section>`;
  window.scrollTo({ top: 0 });
}

/** Revisão de erros: não vale pontos nem estrelas, só atualiza o histórico (feito a cada resposta). */
function telaResultadoRevisao(app, run) {
  const total = run.nivel.desafios.length;
  const perfeitas = run.perfeitas;
  app.innerHTML = `<section class="band"><div class="jogo">
    <article class="painel resultado">
      <span class="mods">${esc(run.nivel.nome)}</span>
      <h2>${perfeitas === total ? (run.nivel.treino ? 'Treino perfeito!' : 'Tudo certo agora!') : (run.nivel.treino ? 'Treino concluído' : 'Revisão concluída')}</h2>
      <p>Você acertou de primeira ${perfeitas} de ${total} desafios ${run.nivel.treino ? 'do treino' : 'revisados'}.</p>
      <p>${run.nivel.treino ? 'Os desafios com erro foram para a revisão de erros.' : perfeitas === total ? 'Nenhum deles volta para a lista de revisão.' : 'Os que ainda tiveram erro continuam na lista de revisão.'}</p>
      <div class="acoes">
        ${run.nivel.treino ? '<button class="btn" data-acao="treinar">Novo treino</button>' : ''}
        <button class="${run.nivel.treino ? 'btn-sec' : 'btn'}" data-acao="mapa">Voltar ao mapa</button>
      </div>
    </article>
  </div></section>`;
  window.scrollTo({ top: 0 });
}
