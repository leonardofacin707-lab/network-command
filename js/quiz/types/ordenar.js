import { $, esc, embaralhar, tremer } from '../../core/ui.js';
import { pontosPorErros } from '../scoring.js';

export default {
  rotulo: 'Coloque em ordem',
  renderizar(q, sessao) {
    sessao.est.pos = 0;
    $('#area').innerHTML = `<p class="dica">Toque nos itens na ordem certa.</p>
      <ol class="fila" id="fila">${q.itens.map(() => '<li class="vazio">…</li>').join('')}</ol>
      <div class="chips">${embaralhar(q.itens).map(t => `<button class="chip" data-ord="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  },
  clique(alvo, q, sessao, api) {
    if (alvo.dataset.ord === undefined || alvo.disabled) return;
    if (alvo.dataset.ord === q.itens[sessao.est.pos]) {
      const li = $('#fila').children[sessao.est.pos];
      li.textContent = q.itens[sessao.est.pos];
      li.className = 'ok';
      alvo.disabled = true;
      alvo.classList.add('ok', 'sem');
      sessao.est.pos++;
      if (sessao.est.pos === q.itens.length) api.finalizar(true, pontosPorErros(sessao.erros));
    } else {
      sessao.erros++;
      tremer(alvo);
    }
  }
};
