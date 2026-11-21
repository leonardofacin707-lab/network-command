// Tutorial guiado: um laboratório pequeno com passos que se marcam sozinhos quando o simulador confirma.
import { esc } from '../core/ui.js';
import { criarEditor } from '../lab/editor.js';
import { cenarioTutorial, situacaoTutorial, comandoEhPing } from './passos.js';
import { tutorialVazio } from '../core/storage.js';

export default {
  id: 'tutorial',
  montar(raiz, { store }) {
    const tut = () => store.obter().tutorial ?? tutorialVazio();
    const gravar = mudar => store.alterar(e => ({ ...e, tutorial: mudar(e.tutorial ?? tutorialVazio()) }));
    if (!tut().topologia.dispositivos.length) gravar(t => ({ ...t, topologia: cenarioTutorial() }));
    let pingou = false;

    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Tutorial: sua primeira rede</h2>
      <p class="sub">Ligue dois computadores a um switch, dê endereços IP e teste com ping. Cada passo é marcado sozinho quando o simulador confirma.</p>
      <div class="painel tutorial-passos">
        <ol id="tut-passos" class="objetivos"></ol>
        <div id="tut-atual" class="tut-atual" role="status" aria-live="polite"></div>
        <div class="acoes"><span id="tut-reiniciar"><button class="btn-sec" id="tut-reiniciar-btn" type="button">Recomeçar o tutorial</button></span></div>
      </div>
      <div id="editor"></div>
    </div></section>`;
    const $ = s => raiz.querySelector(s);
    let ultimoAtual;

    function desenharPassos() {
      const s = situacaoTutorial(tut().topologia, { pingou: pingou || tut().concluido });
      $('#tut-passos').innerHTML = s.passos.map((p, i) => `<li class="${p.ok ? 'ok' : p.id === s.atual ? 'atual' : 'pend'}">
        <span aria-hidden="true">${p.ok ? '✓' : i + 1 + '.'}</span> ${esc(p.titulo)}
        <span class="sr-only">${p.ok ? ' (feito)' : p.id === s.atual ? ' (passo atual)' : ' (depois)'}</span></li>`).join('');
      if (s.atual === ultimoAtual) return;
      ultimoAtual = s.atual;
      if (s.concluido) {
        if (!tut().concluido) gravar(t => ({ ...t, concluido: true, em: new Date().toISOString() }));
        $('#tut-atual').innerHTML = `<h3 class="ok-txt">Tutorial concluído!</h3>
          <p>Os dois computadores se comunicam. Você usou as camadas física (cabo), de enlace (switch e ARP) e de rede (IP e ICMP).</p>
          <div class="acoes"><a class="btn" href="#/missoes">Ir para as missões</a> <a class="btn-sec" href="#/laboratorio">Laboratório livre</a> <a class="btn-sec" href="#/inicio">Tela inicial</a></div>`;
      } else {
        const p = s.passos.find(x => x.id === s.atual);
        $('#tut-atual').innerHTML = `<h3>${esc(p.titulo)}</h3><p>${esc(p.como)}</p><p class="motivo">Por quê: ${esc(p.porque)}</p>`;
      }
    }

    const editor = criarEditor($('#editor'), {
      topologia: tut().topologia,
      restricoes: { dispositivos: false, exemplos: false },
      aoMudar: t => { pingou = false; gravar(x => ({ ...x, topologia: t })); desenharPassos(); },
      aoSimular: ({ comando }) => { if (comandoEhPing(comando)) { pingou = true; desenharPassos(); } }
    });

    const controle = new AbortController();
    $('#tut-reiniciar').addEventListener('click', e => {
      const id = e.target.id;
      if (id === 'tut-reiniciar-btn') $('#tut-reiniciar').innerHTML = '<span class="ruim-txt">Apagar o que você fez no tutorial?</span> <button class="btn btn-perigo" id="tut-reiniciar-sim" type="button">Sim</button> <button class="btn-sec" id="tut-reiniciar-nao" type="button">Não</button>';
      else if (id === 'tut-reiniciar-sim' || id === 'tut-reiniciar-nao') {
        if (id === 'tut-reiniciar-sim') { pingou = false; const t = cenarioTutorial(); gravar(x => ({ ...x, topologia: t })); editor.atualizar(t); desenharPassos(); }
        $('#tut-reiniciar').innerHTML = '<button class="btn-sec" id="tut-reiniciar-btn" type="button">Recomeçar o tutorial</button>';
      }
    }, { signal: controle.signal });

    desenharPassos();
    return () => { controle.abort(); editor.destruir(); };
  }
};
