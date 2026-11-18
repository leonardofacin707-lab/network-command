import { $, esc, tremer } from '../../core/ui.js';
import { pontosPorErros } from '../scoring.js';

export default {
  rotulo: 'Calcule',
  renderizar(q) {
    $('#area').innerHTML = `<form class="numero" id="form-num">
        <input id="resp-num" type="number" inputmode="decimal" step="any" aria-label="Sua resposta" required>
        <span>${esc(q.unidade || '')}</span>
        <button class="btn" type="submit">Verificar</button>
      </form><p class="erro-txt" id="msg-num" aria-live="polite"></p>`;
    $('#resp-num').focus();
  },
  clique() { /* a resposta numérica chega pelo envio do formulário (enviar) */ },
  enviar(q, sessao, api) {
    const valor = Number(String($('#resp-num').value).replace(',', '.'));
    if (valor === q.resposta) {
      $('#resp-num').disabled = true;
      api.finalizar(true, pontosPorErros(sessao.erros));
    } else if (sessao.erros === 0) {
      sessao.erros++;
      tremer($('#resp-num'));
      $('#msg-num').textContent = 'Ainda não. Dica: ' + q.dica;
    } else {
      $('#resp-num').disabled = true;
      $('#msg-num').textContent = `A resposta era ${q.resposta.toLocaleString('pt-BR')} ${q.unidade || ''}.`;
      api.finalizar(false, 0);
    }
  }
};
