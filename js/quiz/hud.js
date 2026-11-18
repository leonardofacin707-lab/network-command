import { $ } from '../core/ui.js';
import { xpTotal, estrelasTotal, cargoDe, nivelDoJogador } from '../core/progression.js';

/** Placar global (topo da página): reage a qualquer mudança do estado. */
export function iniciarHud(store, catalogo) {
  const desenhar = estado => {
    const melhor = estado.quiz.melhor;
    const xp = xpTotal(melhor);
    $('#hud').innerHTML = `
      <div><small>Cargo</small><b>${cargoDe(xp)}</b></div>
      <div><small>XP</small><b>${xp.toLocaleString('pt-BR')}</b></div>
      <div><small>Estrelas</small><b>${estrelasTotal(melhor)} / ${catalogo.jogaveis.length * 3}</b></div>
      <div><small>Nível</small><b>${nivelDoJogador(xp).nivel}</b></div>`;
  };
  desenhar(store.obter());
  return store.ouvir(desenhar);
}
