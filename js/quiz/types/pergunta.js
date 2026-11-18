import { $, esc, embaralhar } from '../../core/ui.js';

export default {
  rotulo: 'Pergunta',
  renderizar(q, sessao) {
    sessao.est.ordem = embaralhar(q.alternativas.map((_, i) => i));
    $('#area').innerHTML = `<div class="ops">${sessao.est.ordem.map(i =>
      `<button class="op" data-op="${i}">${esc(q.alternativas[i])}</button>`).join('')}</div>`;
  },
  clique(alvo, q, sessao, api) {
    if (alvo.dataset.op === undefined) return;
    const escolhida = Number(alvo.dataset.op);
    document.querySelectorAll('.op').forEach(b => {
      b.disabled = true;
      if (Number(b.dataset.op) === q.correta) b.classList.add('certa');
    });
    if (escolhida === q.correta) api.finalizar(true, 100);
    else { alvo.classList.add('errada'); api.finalizar(false, 0); }
  }
};
