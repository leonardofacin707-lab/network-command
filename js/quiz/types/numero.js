import { $, esc, tremer } from '../../core/ui.js';
import { pontosPorErros } from '../scoring.js';
import { lerNumero } from '../numero-parser.js';

export default {
  rotulo: 'Calcule',
  renderizar(q) {
    $('#area').innerHTML = `<form class="numero" id="form-num">
        <input id="resp-num" type="text" inputmode="decimal" autocomplete="off" aria-label="Sua resposta" required>
        <span>${esc(q.unidade || '')}</span>
        <button class="btn" type="submit">Verificar</button>
      </form><p class="erro-txt" id="msg-num" aria-live="polite"></p>`;
    $('#resp-num').focus();
  },
  clique() { /* a resposta numérica chega pelo envio do formulário (enviar) */ },
  enviar(q, sessao, api) {
    const valor = lerNumero($('#resp-num').value);
    if (Number.isNaN(valor)) { // texto que não é número não conta como erro
      $('#msg-num').textContent = 'Digite só o número (por exemplo 1000 ou 1,5).';
      return;
    }
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
