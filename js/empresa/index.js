// Módulo Empresa (protótipo): planejamento da rede de uma empresa (sub-redes e equipamentos dentro de um orçamento).
// Não simula tráfego: só dimensiona. As regras estão em planejamento.js; aqui há apenas interface.
import { esc } from '../core/ui.js';
import { avaliarProjeto, capacidade, enderecosNecessarios, calcularXpProjeto, PREFIXO_MIN, PREFIXO_MAX, MAX_QTD } from './planejamento.js';

const NIVEL = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' };
const brl = n => n.toLocaleString('pt-BR');
const vazio = () => ({ prefixos: {}, equip: {}, concluida: false, em: null, xp: 0 });

export default {
  id: 'empresa',
  montar(raiz, { empresa, store }, params = []) {
    const projeto = params[0] ? empresa.projetos.find(p => p.id === params[0]) : null;
    if (params[0] && !projeto) {
      raiz.innerHTML = `<section class="band"><div class="wrap"><div class="painel"><h2>Projeto não encontrado</h2><p><a class="btn" href="#/empresa">Ver todos os projetos</a></p></div></div></section>`;
      return null;
    }
    return projeto ? montarProjeto(raiz, store, projeto, empresa.equipamentos) : montarLista(raiz, store, empresa.projetos);
  }
};

function montarLista(raiz, store, projetos) {
  const desenhar = estado => {
    const feitos = projetos.filter(p => estado.empresa[p.id]?.concluida).length;
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Empresa <span class="selo proto">protótipo</span></h2>
      <p class="sub">Planeje a rede de uma empresa: dimensione as sub-redes de cada setor dentro do bloco recebido e escolha os equipamentos dentro do orçamento.
        É um exercício de <b>planejamento</b>: o simulador de tráfego não participa e ainda não há falhas, crescimento ao longo do tempo nem moeda do jogo.
        <b>${feitos}</b> de <b>${projetos.length}</b> projetos aprovados.</p>
      <ul class="lista-missoes">${projetos.map(p => {
        const s = estado.empresa[p.id];
        const iniciado = s && (Object.keys(s.prefixos).length || Object.keys(s.equip).length);
        const sit = s?.concluida ? `Aprovado · +${s.xp} XP` : iniciado ? 'Em andamento' : 'Não iniciado';
        return `<li class="missao ${s?.concluida ? 'feita' : iniciado ? 'andamento' : 'nova'}"><a href="#/empresa/${p.id}" aria-label="${esc(p.titulo)}, ${NIVEL[p.dificuldade]}, ${sit}">
          <b>${esc(p.titulo)}</b><span class="meta">${NIVEL[p.dificuldade]} · ${p.xp} XP · orçamento R$ ${brl(p.orcamento)}</span><span class="situacao">${sit}</span></a></li>`;
      }).join('')}</ul></div></section>`;
  };
  desenhar(store.obter());
  return store.ouvir(desenhar);
}

function montarProjeto(raiz, store, projeto, equipamentos) {
  const atual = () => store.obter().empresa[projeto.id] ?? vazio();
  const gravar = mudar => store.alterar(e => ({ ...e, empresa: { ...e.empresa, [projeto.id]: mudar(e.empresa[projeto.id] ?? vazio()) } }));
  const prefixos = Array.from({ length: PREFIXO_MAX - PREFIXO_MIN + 1 }, (_, i) => PREFIXO_MIN + i);

  const hosts = projeto.setores.reduce((s, x) => s + x.hosts, 0);
  raiz.innerHTML = `<section class="band"><div class="wrap">
    <p><a href="#/empresa">← Todos os projetos</a></p>
    <h2 class="titulo-pagina">${esc(projeto.titulo)} <span class="selo proto">protótipo</span></h2>
    <div class="painel missao-topo">
      <p>${esc(projeto.cenario)}</p>
      <p class="meta">${NIVEL[projeto.dificuldade]} · ${projeto.xp} XP · bloco recebido <b>${esc(projeto.bloco)}</b> · orçamento <b>R$ ${brl(projeto.orcamento)}</b> · crescimento previsto <b>${projeto.crescimento}%</b> · <b>${hosts}</b> dispositivos <span id="e-situacao"></span></p>
      <p class="meta">Regras: cada sub-rede precisa de hosts + crescimento + 1 endereço para o gateway; cada switch gasta 1 porta com o enlace para o roteador.</p>
    </div>
    <div class="empresa-grade">
      <div class="painel"><h3>Sub-redes</h3>
        <table class="tabela"><caption class="sr-only">Sub-redes por setor</caption>
          <thead><tr><th scope="col">Setor</th><th scope="col">Hosts</th><th scope="col">Precisa</th><th scope="col">Prefixo</th><th scope="col">Faixa alocada</th></tr></thead>
          <tbody>${projeto.setores.map(s => `<tr data-setor="${s.id}"><th scope="row">${esc(s.nome)}</th><td>${s.hosts}</td><td>${enderecosNecessarios(s.hosts, projeto.crescimento)}</td>
            <td><label class="sr-only" for="p-${s.id}">Prefixo de ${esc(s.nome)}</label><select id="p-${s.id}" class="campo" data-prefixo="${s.id}"><option value="">—</option>
            ${prefixos.map(p => `<option value="${p}">/${p} (${capacidade(p)} hosts)</option>`).join('')}</select></td>
            <td class="faixa" data-faixa="${s.id}">—</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="painel"><h3>Equipamentos</h3>
        <table class="tabela"><caption class="sr-only">Equipamentos</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">Preço</th><th scope="col">Quantidade</th></tr></thead>
          <tbody>${equipamentos.map(e => `<tr><th scope="row">${esc(e.nome)}</th><td>R$ ${brl(e.custo)}</td>
            <td><label class="sr-only" for="q-${e.id}">Quantidade de ${esc(e.nome)}</label><input id="q-${e.id}" class="campo qtd" type="number" min="0" max="${MAX_QTD}" step="1" inputmode="numeric" data-equip="${e.id}"></td></tr>`).join('')}</tbody></table>
      </div>
    </div>
    <div class="painel"><h3>Verificação</h3>
      <ul id="e-itens" class="objetivos"></ul>
      <ul id="e-avisos" class="lab-avisos" aria-label="Avisos do projeto"></ul>
      <div class="acoes"><button class="btn" id="e-aprovar" disabled>Aprovar projeto</button><span id="e-reiniciar"><button class="btn-sec" id="e-reiniciar-btn">Limpar plano</button></span></div>
      <p id="e-msg" role="status" class="m-msg"></p>
    </div>
  </div></section>`;
  const $ = s => raiz.querySelector(s);
  const msg = (t, erro = false) => { const el = $('#e-msg'); el.textContent = t; el.className = 'm-msg ' + (erro ? 'ruim-txt' : 'ok-txt'); };

  function preencherCampos() {
    const s = atual();
    raiz.querySelectorAll('[data-prefixo]').forEach(sel => { sel.value = s.prefixos[sel.dataset.prefixo] ?? ''; });
    raiz.querySelectorAll('[data-equip]').forEach(inp => { if (document.activeElement !== inp) inp.value = s.equip[inp.dataset.equip] ?? ''; });
  }

  function atualizar() {
    const s = atual();
    const r = avaliarProjeto(projeto, equipamentos, s);
    $('#e-itens').innerHTML = r.itens.map(i => `<li class="${i.ok ? 'ok' : 'falha'}"><span aria-hidden="true">${i.ok ? '✓' : '✗'}</span> ${esc(i.texto)}
      <span class="sr-only">${i.ok ? ' (ok)' : ' (pendente)'}</span> <small class="motivo">— ${esc(i.detalhe)}</small></li>`).join('');
    $('#e-avisos').innerHTML = r.avisos.map(a => `<li>${esc(a)}</li>`).join('');
    projeto.setores.forEach((setor, i) => { const b = r.blocos.find(x => x.id === setor.id); $(`[data-faixa="${setor.id}"]`).textContent = b ? `${b.rede}/${b.prefixo} · ${b.primeiro} – ${b.ultimo}` : '—'; });
    $('#e-situacao').textContent = s.concluida ? `· Aprovado (+${s.xp} XP)` : '';
    $('#e-aprovar').disabled = !r.aprovado;
    $('#e-aprovar').textContent = s.concluida ? 'Aprovar de novo (sem XP extra)' : 'Aprovar projeto';
    return r;
  }

  const controle = new AbortController();
  const on = (el, tipo, fn) => el.addEventListener(tipo, fn, { signal: controle.signal });

  on(raiz, 'change', e => {
    const sel = e.target.closest('[data-prefixo]'), inp = e.target.closest('[data-equip]');
    if (sel) {
      const v = sel.value === '' ? null : Number(sel.value);
      gravar(p => { const pf = { ...p.prefixos }; if (v === null) delete pf[sel.dataset.prefixo]; else pf[sel.dataset.prefixo] = v; return { ...p, prefixos: pf }; });
    } else if (inp) {
      const n = Math.max(0, Math.min(MAX_QTD, Math.floor(Number(inp.value) || 0)));
      inp.value = n || '';
      gravar(p => { const eq = { ...p.equip }; if (n === 0) delete eq[inp.dataset.equip]; else eq[inp.dataset.equip] = n; return { ...p, equip: eq }; });
    } else return;
    msg('');
    atualizar();
  });

  on($('#e-aprovar'), 'click', () => {
    const r = atualizar();
    if (!r.aprovado) return msg('O projeto ainda tem pendências.', true);
    const s = atual();
    if (s.concluida) return msg('Projeto aprovado de novo. O XP já tinha sido recebido.');
    const xp = calcularXpProjeto(projeto);
    gravar(p => ({ ...p, concluida: true, em: new Date().toISOString(), xp }));
    msg(`Projeto aprovado! +${xp} XP.`);
    atualizar();
  });

  on($('#e-reiniciar'), 'click', e => {
    const id = e.target.id;
    if (id === 'e-reiniciar-btn') $('#e-reiniciar').innerHTML = '<span class="ruim-txt">Apagar o plano atual?</span> <button class="btn btn-perigo" id="e-reiniciar-sim">Sim</button> <button class="btn-sec" id="e-reiniciar-nao">Não</button>';
    else if (id === 'e-reiniciar-sim' || id === 'e-reiniciar-nao') {
      if (id === 'e-reiniciar-sim') { gravar(p => ({ ...p, prefixos: {}, equip: {} })); preencherCampos(); msg('Plano limpo.'); }
      $('#e-reiniciar').innerHTML = '<button class="btn-sec" id="e-reiniciar-btn">Limpar plano</button>';
      atualizar();
    }
  });

  preencherCampos();
  atualizar();
  return () => controle.abort();
}
