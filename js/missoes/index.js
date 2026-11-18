// Módulo Missões (protótipo): cenários de troubleshooting no laboratório. A interface só apresenta;
// a verificação e o cálculo de XP ficam em verificar.js e o simulador decide se a rede funciona.
import { esc } from '../core/ui.js';
import { criarEditor } from '../lab/editor.js';
import { verificarMissao, calcularXp, PENALIDADE_DICA } from './verificar.js';

const NIVEL = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' };
const estadoVazio = () => ({ topologia: { dispositivos: [], cabos: [] }, concluida: false, em: null, xp: 0, dicas: 0 });

/** Cria um módulo de missões (troubleshooting no laboratório). Usado por Missões e por Campus de Redes. */
export function criarModuloMissoes(cfg) {
  return {
    id: cfg.id,
    montar(raiz, { missoes: todas, store }, params = []) {
      const missoes = todas.filter(m => m.modulo === cfg.id);
      const missao = params[0] ? missoes.find(m => m.id === params[0]) : null;
      if (params[0] && !missao) {
        raiz.innerHTML = `<section class="band"><div class="wrap"><div class="painel"><h2>Missão não encontrada</h2><p><a class="btn" href="#/${cfg.id}">Ver todas as missões</a></p></div></div></section>`;
        return null;
      }
      return missao ? montarMissao(raiz, store, missao, cfg) : montarLista(raiz, store, missoes, cfg);
    }
  };
}

export default criarModuloMissoes({ id: 'missoes', titulo: 'Missões', intro: 'Cada missão traz uma rede com defeito. Descubra o problema com o terminal e corrija a configuração.' });

function montarLista(raiz, store, missoes, cfg) {
  const desenhar = estado => {
    const feitas = missoes.filter(m => estado.missoes[m.id]?.concluida).length;
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">${esc(cfg.titulo)} <span class="selo proto">protótipo</span></h2>
      <p class="sub">${esc(cfg.intro)} O objetivo só é cumprido quando o ping funciona de verdade no simulador.
        <b>${feitas}</b> de <b>${missoes.length}</b> concluídas.</p>
      <ul class="lista-missoes">${missoes.map(m => {
        const s = estado.missoes[m.id];
        const estado_ = s?.concluida ? 'feita' : s && JSON.stringify(s.topologia) !== JSON.stringify(m.topologia) ? 'andamento' : 'nova';
        return `<li class="missao ${estado_}"><a href="#/${cfg.id}/${m.id}">
          <b>${esc(m.titulo)}</b>
          <span class="meta">${NIVEL[m.dificuldade]} · ${m.xp} XP</span>
          <span class="situacao">${s?.concluida ? `Concluída · +${s.xp} XP` : estado_ === 'andamento' ? 'Em andamento' : 'Não iniciada'}</span>
        </a></li>`;
      }).join('')}</ul>
    </div></section>`;
  };
  desenhar(store.obter());
  return store.ouvir(desenhar);
}

function montarMissao(raiz, store, missao, cfg) {
  const atual = () => store.obter().missoes[missao.id] ?? estadoVazio();
  const gravar = mudar => store.alterar(e => ({ ...e, missoes: { ...e.missoes, [missao.id]: mudar(e.missoes[missao.id] ?? estadoVazio()) } }));
  const salva = atual();
  const inicial = salva.topologia.dispositivos.length ? salva.topologia : missao.topologia;
  if (!salva.topologia.dispositivos.length) gravar(m => ({ ...m, topologia: missao.topologia }));

  raiz.innerHTML = `<section class="band"><div class="wrap">
    <p><a href="#/${cfg.id}">← Todas as missões</a></p>
    <h2 class="titulo-pagina">${esc(missao.titulo)} <span class="selo proto">protótipo</span></h2>
    <div class="painel missao-topo">
      <p>${esc(missao.cenario)}</p>
      <p class="meta">${NIVEL[missao.dificuldade]} · ${missao.xp} XP <span id="m-situacao"></span></p>
      <h3>Objetivos</h3>
      <ul id="m-objetivos" class="objetivos"></ul>
      <div class="acoes">
        <button class="btn" id="m-verificar">Verificar a rede</button>
        <button class="btn-sec" id="m-dica">Pedir dica</button>
        <span id="m-reiniciar"><button class="btn-sec" id="m-reiniciar-btn">Reiniciar cenário</button></span>
      </div>
      <p id="m-msg" role="status" class="m-msg"></p>
      <ol id="m-dicas" class="dicas" aria-label="Dicas reveladas"></ol>
    </div>
    <div id="editor"></div>
  </div></section>`;
  const $ = s => raiz.querySelector(s);
  let ultimo = null; // resultado da última verificação

  function desenharPainel() {
    const s = atual();
    const lista = ultimo?.objetivos ?? verificarMissao(missao, missao.topologia).objetivos.map(o => ({ ...o, ok: null, motivo: '' }));
    $('#m-objetivos').innerHTML = lista.map(o => `<li class="${o.ok === null ? 'pend' : o.ok ? 'ok' : 'falha'}">
      <span aria-hidden="true">${o.ok === null ? '○' : o.ok ? '✓' : '✗'}</span> ${esc(o.texto)}
      <span class="sr-only">${o.ok === null ? ' (ainda não verificado)' : o.ok ? ' (cumprido)' : ' (não cumprido)'}</span>
      ${o.ok === false ? `<small class="motivo">— ${esc(o.motivo)}</small>` : ''}</li>`).join('');
    $('#m-situacao').textContent = s.concluida ? `· Concluída (+${s.xp} XP)` : '';
    const reveladas = missao.dicas.slice(0, s.dicas);
    $('#m-dicas').innerHTML = reveladas.map(d => `<li>${esc(d)}</li>`).join('');
    const botao = $('#m-dica');
    const restam = missao.dicas.length - s.dicas;
    botao.disabled = restam <= 0;
    botao.textContent = restam <= 0 ? 'Sem mais dicas' : s.concluida ? 'Ver próxima dica' : `Pedir dica (−${PENALIDADE_DICA * 100}% de XP)`;
  }
  const msg = (t, erro = false) => { const el = $('#m-msg'); el.textContent = t; el.className = 'm-msg ' + (erro ? 'ruim-txt' : 'ok-txt'); };

  const editor = criarEditor($('#editor'), {
    topologia: inicial,
    restricoes: { dispositivos: false, exemplos: false },
    aoMudar: t => { ultimo = null; gravar(m => ({ ...m, topologia: t })); desenharPainel(); msg(''); }
  });

  const controle = new AbortController();
  const on = (el, tipo, fn) => el.addEventListener(tipo, fn, { signal: controle.signal });

  on($('#m-verificar'), 'click', () => {
    ultimo = verificarMissao(missao, store.obter().missoes[missao.id].topologia);
    const s = atual();
    if (ultimo.todosOk) {
      if (!s.concluida) {
        const xp = calcularXp(missao.xp, s.dicas);
        gravar(m => ({ ...m, concluida: true, em: new Date().toISOString(), xp }));
        msg(`Missão concluída! +${xp} XP${s.dicas ? ` (${s.dicas} dica${s.dicas > 1 ? 's' : ''} usada${s.dicas > 1 ? 's' : ''})` : ''}.`);
      } else msg('Todos os objetivos cumpridos de novo. O XP desta missão já foi recebido.');
    } else msg('Ainda há objetivos sem cumprir. Use o terminal dos computadores para investigar.', true);
    desenharPainel();
  }, false);

  on($('#m-dica'), 'click', () => {
    const s = atual();
    if (s.dicas >= missao.dicas.length) return;
    gravar(m => ({ ...m, dicas: m.dicas + 1 }));
    desenharPainel();
    msg(s.concluida ? '' : `Dica ${s.dicas + 1} revelada.`);
  });

  on($('#m-reiniciar'), 'click', e => {
    const id = e.target.id;
    if (id === 'm-reiniciar-btn') $('#m-reiniciar').innerHTML = '<span class="ruim-txt">Voltar ao estado inicial?</span> <button class="btn btn-perigo" id="m-reiniciar-sim">Sim</button> <button class="btn-sec" id="m-reiniciar-nao">Não</button>';
    else if (id === 'm-reiniciar-sim' || id === 'm-reiniciar-nao') {
      if (id === 'm-reiniciar-sim') { ultimo = null; gravar(m => ({ ...m, topologia: missao.topologia })); editor.atualizar(missao.topologia); msg('Cenário reiniciado.'); }
      $('#m-reiniciar').innerHTML = '<button class="btn-sec" id="m-reiniciar-btn">Reiniciar cenário</button>';
      desenharPainel();
    }
  });

  desenharPainel();
  return () => { controle.abort(); editor.destruir(); };
}
