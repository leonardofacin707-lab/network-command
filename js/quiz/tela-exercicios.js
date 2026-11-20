// Aba "Exercícios" do Conhecimento: sub-redes e IPv6 gerados sem fim, com resolução passo a passo. Não vale XP.
import { esc } from '../core/ui.js';
import { gerarExercicio, TIPOS_EXERCICIO } from './exercicios.js';

export function telaExercicios(app) {
  let tipoEscolhido = 'misto', atual = null, respondido = false, placar = { certos: 0, total: 0, seguidos: 0 };
  const tipos = Object.keys(TIPOS_EXERCICIO);

  app.innerHTML = `<section class="band"><div class="wrap painel exercicios">
    <h2>Exercícios sem fim</h2>
    <p>Sub-redes IPv4 e notação IPv6, gerados na hora. Responda, veja a resolução passo a passo e peça outro. Não vale pontos: é treino puro.</p>
    <label for="ex-tipo">Tipo de exercício</label>
    <select id="ex-tipo" class="campo"><option value="misto">Misturado</option>${tipos.map(t => `<option value="${t}">${esc(TIPOS_EXERCICIO[t])}</option>`).join('')}</select>
    <p class="placar" id="ex-placar" aria-live="polite"></p>
    <article class="card ex-card" id="ex-card"></article>
  </div></section>`;

  const card = app.querySelector('#ex-card');
  const atualizarPlacar = () => {
    app.querySelector('#ex-placar').textContent = placar.total ? `Nesta sessão: ${placar.certos} de ${placar.total} certos · sequência atual: ${placar.seguidos}` : '';
  };

  function novo() {
    const tipo = tipoEscolhido === 'misto' ? tipos[Math.floor(Math.random() * tipos.length)] : tipoEscolhido;
    atual = gerarExercicio(tipo);
    respondido = false;
    card.innerHTML = `<p class="tipo">${esc(TIPOS_EXERCICIO[atual.tipo])}</p>
      <h3 id="ex-enunciado">${esc(atual.enunciado)}</h3>
      <form id="ex-form" class="ex-form" autocomplete="off">
        <label for="ex-resp" class="sr-only">Sua resposta</label>
        <input id="ex-resp" class="campo" spellcheck="false" autocapitalize="off" aria-describedby="ex-enunciado">
        <button class="btn" type="submit">Verificar</button>
        <button class="btn-sec" type="button" id="ex-dica">Dica</button>
      </form>
      <div id="ex-feedback" aria-live="polite"></div>`;
  }

  card.addEventListener('submit', e => {
    e.preventDefault();
    e.stopPropagation();
    if (respondido) return;
    const valor = card.querySelector('#ex-resp').value;
    if (!valor.trim()) return;
    respondido = true;
    const certo = atual.confere(valor);
    placar = { certos: placar.certos + (certo ? 1 : 0), total: placar.total + 1, seguidos: certo ? placar.seguidos + 1 : 0 };
    atualizarPlacar();
    card.querySelector('#ex-resp').readOnly = true;
    card.querySelector('#ex-feedback').innerHTML = `<div class="fb ${certo ? 'bom' : 'ruim'}">
      <b>${certo ? 'Certo!' : 'Não foi dessa vez'}</b>${certo ? '' : ` <span>Resposta: <code>${esc(atual.resposta)}</code></span>`}
      <ol class="passos">${atual.passos.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
      <div class="acoes"><button class="btn" type="button" id="ex-proximo">Outro exercício</button></div></div>`;
    card.querySelector('#ex-proximo').focus({ preventScroll: true });
  });
  card.addEventListener('click', e => {
    if (e.target.id === 'ex-proximo') { novo(); card.querySelector('#ex-resp').focus(); }
    if (e.target.id === 'ex-dica' && !respondido) card.querySelector('#ex-feedback').innerHTML = `<p class="motivo">Dica: ${esc(atual.dica)}</p>`;
  });
  app.querySelector('#ex-tipo').addEventListener('change', e => { tipoEscolhido = e.target.value; novo(); });
  novo();
}
