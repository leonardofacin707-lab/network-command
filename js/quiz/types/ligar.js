import { $, esc, embaralhar, tremer } from '../../core/ui.js';
import { pontosPorErros } from '../scoring.js';

export default {
  rotulo: 'Ligue os pares',
  renderizar(q, sessao) {
    sessao.est.feitos = 0;
    sessao.est.esq = null;
    sessao.est.dir = null;
    const direita = embaralhar(q.pares.map((_, i) => i));
    $('#area').innerHTML = `<p class="dica">Toque em um item da esquerda e depois no par dele à direita.</p>
      <div class="colunas">
        <div class="ops">${q.pares.map((p, i) => `<button class="chip" data-esq="${i}">${esc(p.esquerda)}</button>`).join('')}</div>
        <div class="ops">${direita.map(i => `<button class="chip" data-dir="${i}">${esc(q.pares[i].direita)}</button>`).join('')}</div>
      </div>`;
  },
  clique(alvo, q, sessao, api) {
    if (alvo.dataset.esq === undefined && alvo.dataset.dir === undefined) return;
    if (alvo.classList.contains('ok')) return;
    const lado = alvo.dataset.esq !== undefined ? 'esq' : 'dir';
    document.querySelectorAll(`[data-${lado}]`).forEach(b => b.classList.remove('sel'));
    alvo.classList.add('sel');
    sessao.est[lado] = alvo;
    const { esq, dir } = sessao.est;
    if (!(esq && dir)) return;
    if (esq.dataset.esq === dir.dataset.dir) {
      [esq, dir].forEach(b => { b.classList.remove('sel'); b.classList.add('ok'); b.disabled = true; });
      sessao.est.feitos++;
      if (sessao.est.feitos === q.pares.length) api.finalizar(true, pontosPorErros(sessao.erros));
    } else {
      sessao.erros++;
      tremer(dir);
      dir.classList.remove('sel');
    }
    sessao.est.esq = sessao.est.esq && sessao.est.esq.classList.contains('ok') ? null : sessao.est.esq;
    sessao.est.dir = null;
  }
};
