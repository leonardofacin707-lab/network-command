import { $, esc, embaralhar, tremer } from '../../core/ui.js';
import { pontosPorErros } from '../scoring.js';

export default {
  rotulo: 'Classifique',
  renderizar(q, sessao) {
    sessao.est.sel = null;
    sessao.est.feitos = 0;
    const ordem = embaralhar(q.itens.map((_, i) => i));
    $('#area').innerHTML = `<p class="dica">Toque em um item e depois no grupo certo.</p>
      <div class="chips" id="pool">${ordem.map(i => `<button class="chip" data-item="${i}">${esc(q.itens[i].texto)}</button>`).join('')}</div>
      <div class="grupos">${q.grupos.map((g, gi) => `<div class="grupo"><button class="grupo-cab" data-grupo="${gi}"><b>${esc(g)}</b></button><div class="grupo-itens"></div></div>`).join('')}</div>`;
  },
  clique(alvo, q, sessao, api) {
    if (alvo.dataset.item !== undefined && !alvo.classList.contains('ok')) {
      document.querySelectorAll('#pool .chip').forEach(b => b.classList.remove('sel'));
      alvo.classList.add('sel');
      sessao.est.sel = alvo;
    } else if (alvo.dataset.grupo !== undefined && sessao.est.sel) {
      const item = q.itens[Number(sessao.est.sel.dataset.item)];
      if (item.grupo === Number(alvo.dataset.grupo)) {
        sessao.est.sel.classList.remove('sel');
        sessao.est.sel.classList.add('ok');
        sessao.est.sel.disabled = true;
        alvo.closest('.grupo').querySelector('.grupo-itens').appendChild(sessao.est.sel);
        sessao.est.sel = null;
        sessao.est.feitos++;
        if (sessao.est.feitos === q.itens.length) {
          $('#area').classList.add('pronto');
          api.finalizar(true, pontosPorErros(sessao.erros));
        }
      } else {
        sessao.erros++;
        tremer(alvo);
      }
    }
  }
};
