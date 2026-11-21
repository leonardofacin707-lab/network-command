// Editor visual da topologia + painel de configuração + terminal. A lógica de rede está em js/sim (sem DOM);
// aqui só há interface: desenha o estado recebido e devolve cada mudança por aoMudar(novaTopologia).
import { esc, reduzMovimento } from '../core/ui.js';
import { LARGURA, ALTURA, adicionarDispositivo, moverDispositivo, conectar, removerCabo, removerDispositivo, dispositivo, vizinhos, rotuloDaPorta, topologiaVazia, removerRotaEstatica, removerFiltro, moverFiltro, removerRegistroDns, removerRota6, removerNetworkOspf } from '../sim/topologia.js';
import { criarSimulacao, caminhoFisico } from '../sim/motor.js';
import { executar } from '../sim/terminal.js';
import { executarIos, sessaoInicial, prompt as promptIos } from '../sim/cli-ios.js';
import { diagnosticar } from '../sim/diagnostico.js';
import { exemploLan, exemploDuasRedes } from './exemplos.js';
import { desenharRede, centroDe } from './desenho.js';
import { htmlPainel } from './paineis.js';
import { passosDoFormulario } from './formulario.js';



/**
 * opcoes: { topologia, aoMudar(t), restricoes: { dispositivos: bool, exemplos: bool }, aoSimular? }
 * Devolve { atualizar(t), destruir(), simulacao() }.
 */
export function criarEditor(raiz, opcoes) {
  const { aoMudar } = opcoes;
  const livre = opcoes.restricoes?.dispositivos !== false; // pode adicionar/remover dispositivos
  const exemplos = opcoes.restricoes?.exemplos !== false;
  let topo = opcoes.topologia;
  let sim = criarSimulacao(topo);
  let capturaLigada = false, ultimaCaptura = null; // captura de pacotes do terminal (último comando)
  let sel = null, modo = 'mover', origemCabo = null, confirmaLimpar = false;
  const saidas = new Map(), historicos = new Map(), posHist = new Map();
  const controle = new AbortController();
  const { signal } = controle;

  raiz.innerHTML = `<div class="lab">
    <div class="lab-barra" role="toolbar" aria-label="Ferramentas do laboratório">
      ${livre ? `<span class="lab-grupo"><button class="btn-sec" data-add="pc">+ Computador</button><button class="btn-sec" data-add="switch">+ Switch</button><button class="btn-sec" data-add="roteador">+ Roteador</button><button class="btn-sec" data-add="ap">+ Ponto de acesso</button></span>` : ''}
      <span class="lab-grupo" role="group" aria-label="Modo">
        <button class="btn-sec" data-modo="mover" aria-pressed="true">Mover</button>
        <button class="btn-sec" data-modo="conectar" aria-pressed="false">Conectar cabo</button>
      </span>
      ${exemplos ? `<span class="lab-grupo"><button class="btn-sec" data-acao="ex-lan">Exemplo: 3 PCs + switch</button><button class="btn-sec" data-acao="ex-redes">Exemplo: 2 redes + roteador</button><span id="lab-limpar"><button class="btn-sec" data-acao="limpar">Limpar tudo</button></span></span>` : ''}
    </div>
    <div class="lab-corpo">
      <div class="lab-tela">
        <div class="lab-rolagem"><svg id="lab-svg" viewBox="0 0 ${LARGURA} ${ALTURA}" role="group" aria-label="Área de trabalho do laboratório"></svg></div>
        <p id="lab-estado" role="status"></p>
        <ul id="lab-avisos" class="lab-avisos" aria-label="Avisos da topologia"></ul>
      </div>
      <aside class="lab-lateral" aria-label="Detalhes do dispositivo">
        <div id="lab-cfg"></div>
        <div id="lab-term"></div>
      </aside>
    </div>
  </div>`;
  const $ = s => raiz.querySelector(s);
  const svg = $('#lab-svg');

  const dizer = (texto, erro = false) => { const el = $('#lab-estado'); el.textContent = texto; el.className = erro ? 'ruim-txt' : 'ok-txt'; };

  function aplicar(r, mensagem) {
    if (r.erro) { dizer(r.erro, true); return false; }
    topo = r.topologia;
    sim = criarSimulacao(topo);   // qualquer mudança limpa os caches ARP, como reiniciar a rede
    if (sel && !dispositivo(topo, sel)) { sel = null; renderTerm(); }
    if (mensagem) dizer(mensagem);
    desenhar();
    aoMudar(topo);
    return true;
  }

  // ---------- desenho ----------
  const centro = id => centroDe(topo, id);

  function desenhar() {
    svg.innerHTML = desenharRede({ topo, sim, sel, origemCabo });
    $('#lab-avisos').innerHTML = diagnosticar(sim.topologia).map(a => `<li>${esc(a.texto)}</li>`).join('');
    renderCfg();
  }

  // ---------- painel de configuração ----------
  function renderCfg() { $('#lab-cfg').innerHTML = htmlPainel({ topo, sim, sel, livre }); }

  // ---------- terminal ----------
  function renderTerm() {
    const alvo = $('#lab-term');
    const d = sel ? dispositivo(topo, sel) : null;
    if (!d) { alvo.innerHTML = ''; return; }
    if (d.tipo === 'ap') { alvo.innerHTML = ''; return; }
    if (d.tipo !== 'pc') { renderConsole(alvo, d); return; }
    if (!saidas.has(d.id)) saidas.set(d.id, ['Terminal simulado. Digite help para ver os comandos.']);
    alvo.innerHTML = `<div class="painel terminal">
      <h3>Terminal de ${esc(d.nome)}</h3>
      <div class="term-saida" id="term-saida" role="log" aria-live="polite" tabindex="0" aria-label="Saída do terminal"><pre>${esc(saidas.get(d.id).join('\n'))}</pre></div>
      <form id="form-term" class="term-linha" autocomplete="off"><label for="term-entrada" class="term-prompt">C:\\&gt;</label>
        <input id="term-entrada" class="campo term-entrada" spellcheck="false" autocapitalize="off" aria-label="Comando"></form>
      <label class="captura-liga"><input type="checkbox" id="captura-ligada"${capturaLigada ? ' checked' : ''}> Capturar pacotes (estilo Wireshark) a cada comando</label>
      <div id="captura" aria-live="polite">${tabelaCaptura()}</div>
    </div>`;
  }

  // Console estilo Cisco IOS de roteadores e switches: cada dispositivo guarda o próprio modo (>, #, (config)#...).
  const sessoesIos = new Map();
  function renderConsole(alvo, d) {
    if (!saidas.has(d.id)) saidas.set(d.id, [`Console de ${d.nome} (estilo Cisco IOS, simplificado). Digite ? para ver os comandos.`, '']);
    const sessao = sessoesIos.get(d.id) ?? sessaoInicial();
    alvo.innerHTML = `<div class="painel terminal">
      <h3>Console de ${esc(d.nome)}</h3>
      <div class="term-saida" id="term-saida" role="log" aria-live="polite" tabindex="0" aria-label="Saída do console"><pre>${esc(saidas.get(d.id).join('\n'))}</pre></div>
      <form id="form-term" class="term-linha" autocomplete="off"><label for="term-entrada" class="term-prompt" id="term-prompt">${esc(promptIos(d, sessao))}</label>
        <input id="term-entrada" class="campo term-entrada" spellcheck="false" autocapitalize="off" aria-label="Comando do console"></form>
      <p class="motivo">Aceita abreviações (en, conf t, int g0/0, sh ip int br). O que você configura aqui aparece no painel e vale para a simulação.</p>
    </div>`;
  }

  function rodarIos(d, linha) {
    const sessao = sessoesIos.get(d.id) ?? sessaoInicial();
    const antes = promptIos(d, sessao);
    const r = executarIos(topo, sim, d.id, linha, sessao);
    sessoesIos.set(d.id, r.sessao);
    if (linha.trim()) historicos.set(d.id, [...(historicos.get(d.id) ?? []), linha].slice(-50));
    posHist.set(d.id, null);
    if (r.topologia) aplicar({ topologia: r.topologia });
    const atual = dispositivo(topo, d.id);
    saidas.set(d.id, [...(saidas.get(d.id) ?? []), `${antes}${linha}`, ...r.linhas].slice(-400));
    $('#term-saida pre').textContent = saidas.get(d.id).join('\n');
    $('#term-prompt').textContent = promptIos(atual, r.sessao);
    if (r.topologia) $('#lab-term h3').textContent = `Console de ${atual.nome}`;
    const caixa = $('#term-saida'); caixa.scrollTop = caixa.scrollHeight;
    opcoes.aoSimular?.({ dispositivo: d.id, comando: linha, linhas: r.linhas });
  }

  function tabelaCaptura() {
    if (!capturaLigada) return '';
    if (!ultimaCaptura) return '<p class="motivo">Rode um comando (ping, tracert, nslookup, tnc) para ver os pacotes que passaram pela rede.</p>';
    const { comando, origem, pacotes } = ultimaCaptura;
    if (!pacotes.length) return `<p class="motivo">Nenhum pacote saiu na rede com <code>${esc(comando)}</code> em ${esc(origem)}.</p>`;
    return `<h4>Captura de <code>${esc(comando)}</code> em ${esc(origem)} (${pacotes.length} ${pacotes.length === 1 ? 'pacote' : 'pacotes'})</h4>
      <div class="captura-rolagem" tabindex="0" role="region" aria-label="Pacotes capturados"><table class="tabela captura"><thead><tr><th scope="col">Nº</th><th scope="col">Trecho</th><th scope="col">Protocolo</th><th scope="col">Informação</th></tr></thead><tbody>
      ${pacotes.map(p => `<tr class="proto-${esc(p.protocolo.toLowerCase())}"><td>${p.no}</td><td>${esc(p.de)} → ${esc(p.para)}</td><td>${esc(p.protocolo)}</td>
        <td>${esc(p.info)}<br><small>MAC ${esc(p.macOrigem)} → ${esc(p.macDestino)}${p.ipOrigem ? ` · IP ${esc(p.ipOrigem)} → ${esc(p.ipDestino)} · TTL ${p.ttl}` : ''}</small></td></tr>`).join('')}
      </tbody></table></div>
      <p class="motivo">Simplificação: um pacote por trecho entre vizinhos (sem tempos, tamanhos nem quadros repetidos pelos switches).</p>`;
  }

  function rodarComando(linha) {
    const d = dispositivo(topo, sel);
    if (d.tipo !== 'pc') { rodarIos(d, linha); return; }
    const saida = saidas.get(d.id) ?? [];
    const { resultado: r, pacotes } = sim.capturar(() => executar(sim, d.id, linha));
    if (linha.trim() && !r.limpar) ultimaCaptura = { comando: linha.trim(), origem: d.nome, pacotes };
    const novas = r.limpar ? [] : [...saida, `C:\\>${linha}`, ...r.linhas, ''];
    saidas.set(d.id, r.limpar ? [] : novas.slice(-400));
    const hist = historicos.get(d.id) ?? [];
    if (linha.trim()) historicos.set(d.id, [...hist, linha].slice(-50));
    posHist.set(d.id, null);
    opcoes.aoSimular?.({ dispositivo: d.id, comando: linha, linhas: r.linhas });
    const pre = $('#term-saida pre');
    pre.textContent = saidas.get(d.id).join('\n');
    const caixa = $('#term-saida'); caixa.scrollTop = caixa.scrollHeight;
    $('#captura').innerHTML = tabelaCaptura();
    animarPacotes(pacotes);
  }

  /**
   * Anima os pacotes IP do último comando no desenho: um ponto percorre os cabos, trecho a trecho, com a cor do protocolo.
   * Com "reduzir movimento" ligado no sistema, nada se move (a tabela da captura continua disponível).
   */
  let animacao = null;
  function animarPacotes(pacotes) {
    if (animacao) { cancelAnimationFrame(animacao.quadro); animacao.ponto.remove(); animacao = null; }
    if (reduzMovimento()) return;
    const trechos = pacotes.filter(p => p.trecho).slice(0, 40).map(p => ({ cls: p.protocolo.toLowerCase(), pontos: (caminhoFisico(sim.topologia, p.trecho) ?? []).map(centro) }))
      .filter(x => x.pontos.length > 1);
    if (!trechos.length) return;
    const svg = $('#lab-svg');
    const ponto = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ponto.setAttribute('r', '9'); ponto.setAttribute('aria-hidden', 'true');
    svg.appendChild(ponto);
    const POR_CABO = 320; // ms por cabo
    let i = 0, seg = 0, t0 = performance.now();
    animacao = { ponto, quadro: 0 };
    const passo = agora => {
      if (!ponto.isConnected) $('#lab-svg')?.appendChild(ponto); // o desenho foi refeito (ex.: outro dispositivo selecionado)
      const tr = trechos[i];
      ponto.setAttribute('class', `pacote-anim proto-${tr.cls}`);
      const f = Math.min(1, (agora - t0) / POR_CABO), [x1, y1] = tr.pontos[seg], [x2, y2] = tr.pontos[seg + 1];
      ponto.setAttribute('cx', x1 + (x2 - x1) * f); ponto.setAttribute('cy', y1 + (y2 - y1) * f);
      if (f >= 1) {
        t0 = agora; seg++;
        if (seg >= tr.pontos.length - 1) { seg = 0; i++; }
        if (i >= trechos.length) { ponto.remove(); animacao = null; return; }
      }
      animacao.quadro = requestAnimationFrame(passo);
    };
    animacao.quadro = requestAnimationFrame(passo);
  }

  // ---------- interação ----------
  function selecionar(id) {
    if (modo === 'conectar' && id) {
      if (!origemCabo) { origemCabo = id; dizer(`Clique no dispositivo de destino para ligar ${dispositivo(topo, id).nome}.`); desenhar(); return; }
      if (origemCabo === id) { origemCabo = null; dizer('Ligação cancelada.'); desenhar(); return; }
      const a = dispositivo(topo, origemCabo), b = dispositivo(topo, id);
      const r = conectar(topo, a.id, b.id);
      origemCabo = null;
      sel = id;
      if (r.cabo) aplicar(r, `Ligado: ${a.nome} (${rotuloDaPorta(a, r.cabo.a.p)}) ↔ ${b.nome} (${rotuloDaPorta(b, r.cabo.b.p)}).`);
      else { dizer(r.erro, true); desenhar(); }
      renderTerm();
      return;
    }
    sel = id;
    desenhar();
    renderTerm();
  }

  const pontoSvg = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  let arrasto = null;

  svg.addEventListener('pointerdown', e => {
    const g = e.target.closest('.disp');
    if (!g) { if (modo === 'mover' && sel) { sel = null; desenhar(); renderTerm(); } return; }
    const d = dispositivo(topo, g.dataset.id);
    const p = pontoSvg(e);
    arrasto = { id: d.id, g, dx: p.x - d.x, dy: p.y - d.y, x0: d.x, y0: d.y, moveu: false, pid: e.pointerId };
    if (modo === 'mover') g.setPointerCapture?.(e.pointerId);
  }, { signal });

  svg.addEventListener('pointermove', e => {
    if (!arrasto || modo !== 'mover') return;
    const p = pontoSvg(e);
    const x = Math.min(LARGURA - 40, Math.max(40, p.x - arrasto.dx)), y = Math.min(ALTURA - 40, Math.max(40, p.y - arrasto.dy));
    if (!arrasto.moveu && Math.hypot(x - arrasto.x0, y - arrasto.y0) < 4) return;
    arrasto.moveu = true; arrasto.x = x; arrasto.y = y;
    arrasto.g.setAttribute('transform', `translate(${x} ${y})`);
    svg.querySelectorAll('.cabo-lab').forEach(l => {
      const c = topo.cabos.find(k => k.id === l.dataset.cabo);
      for (const [lado, n] of [['a', 1], ['b', 2]]) if (c[lado].d === arrasto.id) { l.setAttribute(`x${n}`, x); l.setAttribute(`y${n}`, y); }
    });
  }, { signal });

  svg.addEventListener('pointerup', () => {
    if (!arrasto) return;
    const a = arrasto; arrasto = null;
    if (a.moveu) { sel = a.id; aplicar(moverDispositivo(topo, a.id, a.x, a.y)); renderTerm(); }
    else selecionar(a.id);
  }, { signal });
  svg.addEventListener('pointercancel', () => { arrasto = null; desenhar(); }, { signal });

  svg.addEventListener('keydown', e => {
    const g = e.target.closest('.disp');
    if (!g) return;
    const id = g.dataset.id;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionar(id); svg.querySelector(`.disp[data-id="${id}"]`)?.focus(); return; }
    const passo = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (passo && modo === 'mover') {
      e.preventDefault();
      const d = dispositivo(topo, id);
      sel = id;
      aplicar(moverDispositivo(topo, id, d.x + passo[0], d.y + passo[1]));
      svg.querySelector(`.disp[data-id="${id}"]`)?.focus();
    }
  }, { signal });

  raiz.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.add) {
      const r = adicionarDispositivo(topo, b.dataset.add);
      if (r.id) { sel = r.id; aplicar(r, `${dispositivo(r.topologia, r.id).nome} adicionado.`); renderTerm(); } else dizer(r.erro, true);
    } else if (b.dataset.modo) {
      modo = b.dataset.modo; origemCabo = null;
      raiz.querySelectorAll('[data-modo]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.modo === modo)));
      dizer(modo === 'conectar' ? 'Modo conectar: clique no primeiro e depois no segundo dispositivo.' : 'Modo mover: arraste os dispositivos.');
      desenhar();
    } else if (b.dataset.acao === 'ex-lan' || b.dataset.acao === 'ex-redes') {
      sel = null; saidas.clear();
      aplicar({ topologia: b.dataset.acao === 'ex-lan' ? exemploLan() : exemploDuasRedes() }, 'Exemplo carregado. Abra o terminal de um computador e teste com ping.');
      renderTerm();
    } else if (b.dataset.acao === 'limpar') {
      $('#lab-limpar').innerHTML = '<span class="ruim-txt">Apagar toda a topologia?</span> <button class="btn btn-perigo" data-acao="limpar-sim">Sim</button> <button class="btn-sec" data-acao="limpar-nao">Não</button>';
    } else if (b.dataset.acao === 'limpar-nao') {
      $('#lab-limpar').innerHTML = '<button class="btn-sec" data-acao="limpar">Limpar tudo</button>';
    } else if (b.dataset.acao === 'limpar-sim') {
      sel = null; saidas.clear();
      aplicar({ topologia: topologiaVazia() }, 'Área de trabalho limpa.');
      $('#lab-limpar').innerHTML = '<button class="btn-sec" data-acao="limpar">Limpar tudo</button>';
      renderTerm();
    } else if (b.dataset.removerRegistro !== undefined) {
      aplicar(removerRegistroDns(topo, sel, Number(b.dataset.removerRegistro)), 'Registro removido.');
    } else if (b.dataset.removerFiltro !== undefined) {
      aplicar(removerFiltro(topo, sel, Number(b.dataset.removerFiltro)), 'Regra removida.');
    } else if (b.dataset.moverFiltro !== undefined) {
      aplicar(moverFiltro(topo, sel, Number(b.dataset.moverFiltro), Number(b.dataset.delta)), 'Regra movida.');
    } else if (b.dataset.removerOspf !== undefined) {
      aplicar(removerNetworkOspf(topo, sel, Number(b.dataset.removerOspf)), 'Comando network removido.');
    } else if (b.dataset.removerRota6 !== undefined) {
      aplicar(removerRota6(topo, sel, Number(b.dataset.removerRota6)), 'Rota IPv6 removida.');
    } else if (b.dataset.removerRota !== undefined) {
      aplicar(removerRotaEstatica(topo, sel, Number(b.dataset.removerRota)), 'Rota removida.');
    } else if (b.dataset.removerCabo) {
      aplicar(removerCabo(topo, b.dataset.removerCabo), 'Cabo removido.');
    } else if (b.dataset.removerDisp) {
      const nome = dispositivo(topo, b.dataset.removerDisp).nome;
      saidas.delete(b.dataset.removerDisp);
      aplicar(removerDispositivo(topo, b.dataset.removerDisp), `${nome} removido.`);
    }
  }, { signal });

  raiz.addEventListener('change', e => {
    if (e.target.id === 'cfg-modo6') { const bloco = raiz.querySelector('[data-fixo6]'); if (bloco) bloco.hidden = e.target.value !== 'manual'; return; }
    if (e.target.id === 'captura-ligada') { capturaLigada = e.target.checked; $('#captura').innerHTML = tabelaCaptura(); return; }
    if (e.target.id !== 'cfg-dhcp') return;
    for (const fs of raiz.querySelectorAll('#form-cfg fieldset[data-fixo]')) fs.disabled = e.target.checked;
  }, { signal });

  raiz.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'form-cfg') {
      const f = new FormData(e.target);
      let r = { topologia: topo };
      const passos = passosDoFormulario(f, topo, sel);
      for (const passo of passos) { r = passo(r.topologia); if (r.erro) break; }
      aplicar(r, 'Configuração aplicada.');
    } else if (e.target.id === 'form-term') {
      const campo = $('#term-entrada');
      const linha = campo.value;
      campo.value = '';
      rodarComando(linha);
    }
  }, { signal });

  raiz.addEventListener('keydown', e => {
    if (e.target.id !== 'term-entrada' || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const hist = historicos.get(sel) ?? [];
    if (!hist.length) return;
    let p = posHist.get(sel);
    p = e.key === 'ArrowUp' ? (p === null || p === undefined ? hist.length - 1 : Math.max(0, p - 1)) : (p === null || p === undefined ? null : p + 1);
    if (p !== null && p >= hist.length) p = null;
    posHist.set(sel, p);
    e.target.value = p === null ? '' : hist[p];
  }, { signal });

  desenhar();
  renderTerm();
  dizer(livre ? 'Adicione dispositivos, ligue com cabos e configure os endereços.' : 'Corrija a rede usando as ferramentas e o terminal.');

  return {
    simulacao: () => sim,
    /** Troca a topologia vinda de fora (ex.: reiniciar o cenário). */
    atualizar(t) { topo = t; sim = criarSimulacao(topo); if (sel && !dispositivo(topo, sel)) sel = null; origemCabo = null; desenhar(); renderTerm(); },
    selecionado: () => sel,
    destruir: () => controle.abort()
  };
}
