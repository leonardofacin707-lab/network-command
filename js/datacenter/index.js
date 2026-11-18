// Módulo Data Center (protótipo): dimensionamento de redundância. Não simula tráfego nem falhas ao vivo:
// calcula a disponibilidade esperada a partir de valores fictícios do cenário. As regras estão em disponibilidade.js.
import { esc } from '../core/ui.js';
import { avaliarDesafio, minutosDeParada, textoParada, MAX_UNIDADES } from './disponibilidade.js';

const NIVEL = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' };
const num = n => n.toLocaleString('pt-BR');
const pctTxt = A => (A * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 }) + '%';
const vazio = () => ({ unidades: {}, concluida: false, em: null, xp: 0 });

export default {
  id: 'datacenter',
  montar(raiz, { datacenter, store }, params = []) {
    const desafio = params[0] ? datacenter.desafios.find(d => d.id === params[0]) : null;
    if (params[0] && !desafio) {
      raiz.innerHTML = `<section class="band"><div class="wrap"><div class="painel"><h2>Desafio não encontrado</h2><p><a class="btn" href="#/datacenter">Ver todos os desafios</a></p></div></div></section>`;
      return null;
    }
    return desafio ? montarDesafio(raiz, store, desafio, datacenter.camadas) : montarLista(raiz, store, datacenter.desafios);
  }
};

function montarLista(raiz, store, desafios) {
  const desenhar = estado => {
    const feitos = desafios.filter(d => estado.datacenter[d.id]?.concluida).length;
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Data Center <span class="selo proto">protótipo</span></h2>
      <p class="sub">Monte a redundância de um data center para cumprir uma meta de disponibilidade dentro do orçamento. É um exercício de <b>cálculo</b>:
        os valores de disponibilidade são fictícios, as falhas são tratadas como independentes e não há simulação de tráfego, falhas ao vivo, nem capacidade de banda.
        <b>${feitos}</b> de <b>${desafios.length}</b> desafios aprovados.</p>
      <ul class="lista-missoes">${desafios.map(d => {
        const s = estado.datacenter[d.id];
        const iniciado = s && Object.keys(s.unidades).length;
        const sit = s?.concluida ? `Aprovado · +${s.xp} XP` : iniciado ? 'Em andamento' : 'Não iniciado';
        return `<li class="missao ${s?.concluida ? 'feita' : iniciado ? 'andamento' : 'nova'}"><a href="#/datacenter/${d.id}" aria-label="${esc(d.titulo)}, ${NIVEL[d.dificuldade]}, ${sit}">
          <b>${esc(d.titulo)}</b><span class="meta">${NIVEL[d.dificuldade]} · ${d.xp} XP · meta ${pctTxt(d.sla)}</span><span class="situacao">${sit}</span></a></li>`;
      }).join('')}</ul></div></section>`;
  };
  desenhar(store.obter());
  return store.ouvir(desenhar);
}

function montarDesafio(raiz, store, desafio, camadas) {
  const atual = () => store.obter().datacenter[desafio.id] ?? vazio();
  const gravar = mudar => store.alterar(e => ({ ...e, datacenter: { ...e.datacenter, [desafio.id]: mudar(e.datacenter[desafio.id] ?? vazio()) } }));

  raiz.innerHTML = `<section class="band"><div class="wrap">
    <p><a href="#/datacenter">← Todos os desafios</a></p>
    <h2 class="titulo-pagina">${esc(desafio.titulo)} <span class="selo proto">protótipo</span></h2>
    <div class="painel missao-topo">
      <p>${esc(desafio.cenario)}</p>
      <p class="meta">${NIVEL[desafio.dificuldade]} · ${desafio.xp} XP · meta <b>${pctTxt(desafio.sla)}</b> (até ${textoParada(minutosDeParada(desafio.sla))} fora do ar) · <b>${desafio.servidores}</b> servidores · orçamento <b>${num(desafio.orcamento)}</b> <span id="d-situacao"></span></p>
      <p class="meta">Regras: as unidades de uma camada ficam em paralelo (basta uma funcionar) e as camadas ficam em série (todas precisam funcionar). Com 2 ou mais switches de acesso, cada servidor liga em 2 deles.</p>
    </div>
    <div class="painel"><h3>Camadas</h3>
      <table class="tabela"><caption class="sr-only">Camadas do data center</caption>
        <thead><tr><th scope="col">Camada</th><th scope="col">Disp. de 1 unidade</th><th scope="col">Preço</th><th scope="col">Unidades (0 a ${MAX_UNIDADES})</th><th scope="col">Disp. da camada</th></tr></thead>
        <tbody>${camadas.map(c => `<tr><th scope="row">${esc(c.nome)}<br><small class="motivo">${esc(c.descricao)}</small></th><td>${pctTxt(c.disp)}</td><td>${num(c.custo)}</td>
          <td><label class="sr-only" for="u-${c.id}">Unidades de ${esc(c.nome)}</label><input id="u-${c.id}" class="campo qtd" type="number" min="0" max="${MAX_UNIDADES}" step="1" inputmode="numeric" data-camada="${c.id}"></td>
          <td data-camada-disp="${c.id}">—</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="painel" style="margin-top:16px"><h3>Verificação</h3>
      <ul id="d-itens" class="objetivos"></ul>
      <div class="acoes"><button class="btn" id="d-aprovar" disabled>Aprovar projeto</button><span id="d-reiniciar"><button class="btn-sec" id="d-reiniciar-btn">Limpar plano</button></span></div>
      <p id="d-msg" role="status" class="m-msg"></p>
    </div>
  </div></section>`;
  const $ = s => raiz.querySelector(s);
  const msg = (t, erro = false) => { const el = $('#d-msg'); el.textContent = t; el.className = 'm-msg ' + (erro ? 'ruim-txt' : 'ok-txt'); };

  function preencher() {
    const s = atual();
    raiz.querySelectorAll('[data-camada]').forEach(i => { i.value = s.unidades[i.dataset.camada] ?? ''; });
  }
  function atualizar() {
    const s = atual();
    const r = avaliarDesafio(desafio, camadas, s);
    $('#d-itens').innerHTML = r.itens.map(i => `<li class="${i.ok ? 'ok' : 'falha'}"><span aria-hidden="true">${i.ok ? '✓' : '✗'}</span> ${esc(i.texto)}
      <span class="sr-only">${i.ok ? ' (ok)' : ' (pendente)'}</span> <small class="motivo">— ${esc(i.detalhe)}</small></li>`).join('');
    r.porCamada.forEach(c => { $(`[data-camada-disp="${c.id}"]`).textContent = c.unidades ? pctTxt(c.disp) : '—'; });
    $('#d-situacao').textContent = s.concluida ? `· Aprovado (+${s.xp} XP)` : '';
    $('#d-aprovar').disabled = !r.aprovado;
    $('#d-aprovar').textContent = s.concluida ? 'Aprovar de novo (sem XP extra)' : 'Aprovar projeto';
    return r;
  }

  const controle = new AbortController();
  const on = (el, tipo, fn) => el.addEventListener(tipo, fn, { signal: controle.signal });

  on(raiz, 'change', e => {
    const inp = e.target.closest('[data-camada]');
    if (!inp) return;
    const n = Math.max(0, Math.min(MAX_UNIDADES, Math.floor(Number(inp.value) || 0)));
    inp.value = inp.value === '' ? '' : String(n);
    gravar(p => { const u = { ...p.unidades }; if (inp.value === '') delete u[inp.dataset.camada]; else u[inp.dataset.camada] = n; return { ...p, unidades: u }; });
    msg('');
    atualizar();
  });

  on($('#d-aprovar'), 'click', () => {
    const r = atualizar();
    if (!r.aprovado) return msg('O projeto ainda tem pendências.', true);
    if (atual().concluida) return msg('Projeto aprovado de novo. O XP já tinha sido recebido.');
    gravar(p => ({ ...p, concluida: true, em: new Date().toISOString(), xp: desafio.xp }));
    msg(`Projeto aprovado! +${desafio.xp} XP.`);
    atualizar();
  });

  on($('#d-reiniciar'), 'click', e => {
    const id = e.target.id;
    if (id === 'd-reiniciar-btn') $('#d-reiniciar').innerHTML = '<span class="ruim-txt">Apagar o plano atual?</span> <button class="btn btn-perigo" id="d-reiniciar-sim">Sim</button> <button class="btn-sec" id="d-reiniciar-nao">Não</button>';
    else if (id === 'd-reiniciar-sim' || id === 'd-reiniciar-nao') {
      if (id === 'd-reiniciar-sim') { gravar(p => ({ ...p, unidades: {} })); preencher(); msg('Plano limpo.'); }
      $('#d-reiniciar').innerHTML = '<button class="btn-sec" id="d-reiniciar-btn">Limpar plano</button>';
      atualizar();
    }
  });

  preencher();
  atualizar();
  return () => controle.abort();
}
