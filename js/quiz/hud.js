import { $ } from '../core/ui.js';
import { xpTotal, estrelasTotal, cargoDe } from '../core/progression.js';

export function desenharHud(melhor, catalogo) {
  const xp = xpTotal(melhor);
  $('#hud').innerHTML = `
    <div><small>Cargo</small><b>${cargoDe(xp)}</b></div>
    <div><small>XP</small><b>${xp.toLocaleString('pt-BR')}</b></div>
    <div><small>Estrelas</small><b>${estrelasTotal(melhor)} / ${catalogo.jogaveis.length * 3}</b></div>`;
}
