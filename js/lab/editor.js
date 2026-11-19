// Editor visual da topologia + painel de configuração + terminal. A lógica de rede está em js/sim (sem DOM);
// aqui só há interface: desenha o estado recebido e devolve cada mudança por aoMudar(novaTopologia).
import { esc } from '../core/ui.js';
import { LARGURA, ALTURA, TIPOS, adicionarDispositivo, moverDispositivo, renomear, configurarInterface, configurarGateway, conectar,
  removerCabo, removerDispositivo, dispositivo, vizinhos, rotuloDaPorta, topologiaVazia, configurarPortaSwitch, configDaPortaSwitch, vlansDoSwitch, adicionarRotaEstatica, removerRotaEstatica, configurarPoolDhcp, configurarDhcpPc, adicionarFiltro, removerFiltro, moverFiltro, configurarDnsPc, adicionarRegistroDns, removerRegistroDns, configurarNat, removerNat } from '../sim/topologia.js';
import { criarSimulacao } from '../sim/motor.js';
import { formatarIPv4, lerMascara, prefixoDeMascara } from '../sim/ipv4.js';
import { executar, MOTIVO_DHCP } from '../sim/terminal.js';
import { diagnosticar } from '../sim/diagnostico.js';
import { exemploLan, exemploDuasRedes } from './exemplos.js';

const ICONE = {
  pc: '<rect x="-26" y="-22" width="52" height="34" rx="4"/><path d="M-12 22h24M0 12v10"/>',
  switch: '<rect x="-36" y="-12" width="72" height="24" rx="4"/><path d="M-24 0h.01M-12 0h.01M0 0h.01M12 0h.01M24 0h.01"/>',
  roteador: '<circle r="26"/><path d="M0-14v28M-14 0h28M-5-9l5-5 5 5M-5 9l5 5 5-5M-9-5l-5 5 5 5M9-5l5 5-5 5"/>'
};
const TIPO_ROTULO = { pc: 'computador', switch: 'switch', roteador: 'roteador' };

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
  let sel = null, modo = 'mover', origemCabo = null, confirmaLimpar = false;
  const saidas = new Map(), historicos = new Map(), posHist = new Map();
  const controle = new AbortController();
  const { signal } = controle;

  raiz.innerHTML = `<div class="lab">
    <div class="lab-barra" role="toolbar" aria-label="Ferramentas do laboratório">
      ${livre ? `<span class="lab-grupo"><button class="btn-sec" data-add="pc">+ Computador</button><button class="btn-sec" data-add="switch">+ Switch</button><button class="btn-sec" data-add="roteador">+ Roteador</button></span>` : ''}
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
  const centro = id => { const d = dispositivo(topo, id); return [d.x, d.y]; };

  function desenharCabos() {
    // Vários cabos entre o mesmo par de dispositivos são desenhados lado a lado.
    const grupos = new Map();
    for (const c of topo.cabos) { const k = [c.a.d, c.b.d].sort().join('|'); grupos.set(k, [...(grupos.get(k) ?? []), c.id]); }
    return topo.cabos.map(c => {
      let [x1, y1] = centro(c.a.d), [x2, y2] = centro(c.b.d);
      const g = grupos.get([c.a.d, c.b.d].sort().join('|'));
      if (g.length > 1) {
        const dist = Math.hypot(x2 - x1, y2 - y1) || 1, off = (g.indexOf(c.id) - (g.length - 1) / 2) * 12;
        const ox = (-(y2 - y1) / dist) * off, oy = ((x2 - x1) / dist) * off;
        x1 += ox; y1 += oy; x2 += ox; y2 += oy;
      }
      const destaque = sel && (c.a.d === sel || c.b.d === sel);
      const rot = destaque ? `<text class="cabo-rot" x="${x1 + (x2 - x1) * .22}" y="${y1 + (y2 - y1) * .22 - 4}">${esc(rotuloDaPorta(dispositivo(topo, c.a.d), c.a.p))}</text>
        <text class="cabo-rot" x="${x1 + (x2 - x1) * .78}" y="${y1 + (y2 - y1) * .78 - 4}">${esc(rotuloDaPorta(dispositivo(topo, c.b.d), c.b.p))}</text>` : '';
      return `<g><line class="cabo-lab${destaque ? ' destaque' : ''}" data-cabo="${c.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${rot}</g>`;
    }).join('');
  }

  function desenharDispositivo(d) {
    const efetivo = dispositivo(sim.topologia, d.id) ?? d; // com as concessões DHCP aplicadas
    const ips = efetivo.interfaces.filter(i => i.ip).map(i => i.ip);
    let vlanTxt = '';
    if (d.tipo === 'switch') {
      const vl = vlansDoSwitch(topo, d.id);
      const trunks = vizinhos(topo, d.id).filter(v => configDaPortaSwitch(d, v.minhaPorta).modo === 'trunk').length;
      if (vl.some(v => v !== 1) || trunks) vlanTxt = [vl.length ? `VLAN ${vl.join(',')}` : '', trunks ? `trunk×${trunks}` : ''].filter(Boolean).join(' · ');
      if (vlanTxt) ips.push(vlanTxt);
    }
    const ligado = vizinhos(topo, d.id).length > 0;
    return `<g class="disp tipo-${d.tipo}${sel === d.id ? ' sel' : ''}${origemCabo === d.id ? ' origem' : ''}" data-id="${d.id}" transform="translate(${d.x} ${d.y})"
        role="button" tabindex="0" aria-label="${esc(d.nome)}${ips.length ? ' ' + ips.join(' ') : ''}, ${TIPO_ROTULO[d.tipo]}${ips.length ? '' : ', sem IP'}${ligado ? '' : ', sem cabo'}">
      <rect class="area" x="-48" y="-40" width="96" height="104" rx="10"/>
      <g class="icone">${ICONE[d.tipo]}</g>
      <text class="nome" y="${d.tipo === 'roteador' ? 46 : 42}">${esc(d.nome)}</text>
      ${ips.map((ip, i) => `<text class="ip" y="${(d.tipo === 'roteador' ? 60 : 56) + i * 13}">${esc(ip)}</text>`).join('\n      ')}
    </g>`;
  }

  function desenhar() {
    svg.innerHTML = `<g class="cabos">${desenharCabos()}</g>${topo.dispositivos.map(desenharDispositivo).join('')}`;
    $('#lab-avisos').innerHTML = diagnosticar(sim.topologia).map(a => `<li>${esc(a.texto)}</li>`).join('');
    renderCfg();
  }

  // ---------- painel de configuração ----------
  const redePrefixo = (rede, mascara) => `${rede}/${prefixoDeMascara(lerMascara(mascara))}`;
  const alvoFiltro = (rede, mascara) => (rede === '0.0.0.0' && mascara === '0.0.0.0' ? 'qualquer' : redePrefixo(rede, mascara));
  const poolDe = (d, porta) => (d.pools ?? []).find(q => q.porta === porta);
  function infoConcessao(d) {
    const c = sim.concessoes.get(d.id);
    if (!c) return '';
    if (!c.ok) return `<p class="motivo" role="status">${esc(MOTIVO_DHCP[c.motivo] ?? 'Sem concessão.')}</p>`;
    return `<p class="motivo" role="status">Concessão: ${esc(formatarIPv4(c.ip))} / ${esc(formatarIPv4(c.mascara))}, gateway ${esc(formatarIPv4(c.gateway))}, servidor ${esc(formatarIPv4(c.servidor.ip))}.</p>`;
  }

  function renderCfg() {
    const alvo = $('#lab-cfg');
    const d = sel ? dispositivo(topo, sel) : null;
    if (!d) {
      alvo.innerHTML = `<div class="painel"><h3>Nenhum dispositivo selecionado</h3>
        <p>${topo.dispositivos.length ? 'Clique em um dispositivo para configurar IP, máscara e gateway, ver os cabos e (nos computadores) abrir o terminal.' : (livre ? 'A área de trabalho está vazia. Adicione dispositivos pela barra de ferramentas ou carregue um exemplo.' : 'Não há dispositivos neste cenário.')}</p></div>`;
      return;
    }
    const cabos = vizinhos(topo, d.id);
    alvo.innerHTML = `<form class="painel" id="form-cfg" novalidate>
      <h3>${esc(d.nome)} <small>(${TIPO_ROTULO[d.tipo]})</small></h3>
      <label for="cfg-nome">Nome</label><input id="cfg-nome" class="campo" name="nome" maxlength="15" value="${esc(d.nome)}" autocomplete="off">
      ${d.tipo === 'pc' ? `<div class="iface-dhcp"><label class="opcao"><input type="checkbox" id="cfg-dhcp" name="dhcp"${d.dhcp ? ' checked' : ''}> Obter endereço automaticamente (DHCP)</label>
        ${d.dhcp ? infoConcessao(d) : '<p class="motivo">Desmarcado: use os endereços fixos abaixo.</p>'}</div>` : ''}
      ${d.interfaces.map(i => `<fieldset class="iface"${d.tipo === 'pc' ? ' data-fixo' : ''}${d.dhcp ? ' disabled' : ''}><legend>${esc(rotuloDaPorta(d, i.id))}</legend>
        <label for="cfg-ip-${i.id}">Endereço IPv4</label><input id="cfg-ip-${i.id}" class="campo" name="ip-${i.id}" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.10" value="${esc(i.ip)}">
        <label for="cfg-m-${i.id}">Máscara</label><input id="cfg-m-${i.id}" class="campo" name="m-${i.id}" autocomplete="off" placeholder="ex.: 255.255.255.0 ou /24" value="${esc(i.mascara)}">
        ${d.tipo === 'roteador' ? `<label for="cfg-pool-ini-${i.id}">Pool DHCP: primeiro endereço</label><input id="cfg-pool-ini-${i.id}" class="campo" name="pool-ini-${i.id}" inputmode="decimal" autocomplete="off" placeholder="vazio = sem DHCP nesta interface" value="${esc(poolDe(d, i.id)?.inicio ?? '')}">
        <label for="cfg-pool-fim-${i.id}">Pool DHCP: último endereço</label><input id="cfg-pool-fim-${i.id}" class="campo" name="pool-fim-${i.id}" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.200" value="${esc(poolDe(d, i.id)?.fim ?? '')}">` : ''}
      </fieldset>`).join('')}
      ${d.tipo === 'pc' ? `<fieldset class="iface" data-fixo${d.dhcp ? ' disabled' : ''}><legend>Gateway</legend><label for="cfg-gw">Gateway padrão</label><input id="cfg-gw" class="campo" name="gw" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.1" value="${esc(d.gateway)}"></fieldset>` : ''}
      ${d.tipo === 'pc' ? `<fieldset class="iface" id="dns-pc"><legend>DNS</legend>
        <label for="cfg-dns">Servidor DNS (IP)</label><input id="cfg-dns" class="campo" name="dns" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.50" value="${esc(d.dns ?? '')}">
        <p class="motivo">O DHCP simplificado não entrega o servidor DNS: informe-o aqui, mesmo com DHCP ligado.</p>
        <h4>Este computador como servidor DNS</h4>
        ${(d.registros ?? []).length ? `<ol class="regras" aria-label="Registros DNS de ${esc(d.nome)}">${d.registros.map((r, i) => `<li class="regra"><span class="regra-txt">${esc(r.nome)} <b>→</b> ${esc(r.ip)}</span>
          <span class="acoes-regra"><button class="btn-sec" type="button" data-remover-registro="${i}" aria-label="Remover o registro ${esc(r.nome)}">Remover</button></span></li>`).join('')}</ol>` : '<p>Sem registros: este computador não responde consultas DNS.</p>'}
        <label for="cfg-reg-nome">Novo registro: nome</label><input id="cfg-reg-nome" class="campo" name="reg-nome" autocomplete="off" spellcheck="false" placeholder="ex.: www.loja.local">
        <label for="cfg-reg-ip">Novo registro: endereço IP</label><input id="cfg-reg-ip" class="campo" name="reg-ip" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.60"></fieldset>` : ''}
      ${d.tipo === 'roteador' ? `<fieldset class="iface" id="rotas-estaticas"><legend>Rotas estáticas</legend>
        ${(d.rotas ?? []).length ? `<ol class="regras" aria-label="Rotas estáticas de ${esc(d.nome)}">${d.rotas.map((r, i) => `<li class="regra"><span class="regra-txt">${esc(redePrefixo(r.rede, r.mascara))} <b>via</b> ${esc(r.via)}</span>
          <span class="acoes-regra"><button class="btn-sec" type="button" data-remover-rota="${i}" aria-label="Remover a rota para ${esc(r.rede)}">Remover</button></span></li>`).join('')}</ol>` : '<p>Nenhuma rota estática. O roteador só conhece as redes ligadas diretamente a ele.</p>'}
        <label for="cfg-rota-rede">Rede de destino</label><input id="cfg-rota-rede" class="campo" name="rota-rede" inputmode="decimal" autocomplete="off" placeholder="ex.: 172.16.0.0 (0.0.0.0 = rota padrão)">
        <label for="cfg-rota-m">Máscara da rede</label><input id="cfg-rota-m" class="campo" name="rota-m" autocomplete="off" placeholder="ex.: 255.255.255.0 ou /24 (/0 = rota padrão)">
        <label for="cfg-rota-via">Próximo salto</label><input id="cfg-rota-via" class="campo" name="rota-via" inputmode="decimal" autocomplete="off" placeholder="ex.: 10.0.0.2 (o roteador vizinho)">
        <p class="motivo">Preencha os três campos e use Aplicar para acrescentar a rota.</p></fieldset>` : ''}
      ${d.tipo === 'roteador' ? `<fieldset class="iface" id="nat-roteador"><legend>NAT</legend>
        <label for="cfg-nat-dentro">Interface de dentro (rede privada)</label><select id="cfg-nat-dentro" class="campo" name="nat-dentro"><option value="">(NAT desligado)</option>${d.interfaces.map(i => `<option value="${i.id}"${d.nat?.dentro === i.id ? ' selected' : ''}>${esc(rotuloDaPorta(d, i.id))}</option>`).join('')}</select>
        <label for="cfg-nat-fora">Interface de fora (lado do provedor)</label><select id="cfg-nat-fora" class="campo" name="nat-fora"><option value="">(NAT desligado)</option>${d.interfaces.map(i => `<option value="${i.id}"${d.nat?.fora === i.id ? ' selected' : ''}>${esc(rotuloDaPorta(d, i.id))}</option>`).join('')}</select>
        <p class="motivo">NAT simplificado (tipo PAT): o que sai de dentro para fora ganha o IP da interface de fora, e a resposta volta sozinha. Quem vem de fora rumo à rede de dentro é bloqueado; não há redirecionamento de portas, tabela de traduções nem tempo de expiração.</p></fieldset>` : ''}
      ${d.tipo === 'roteador' ? `<fieldset class="iface" id="filtros-pacotes"><legend>Filtro de pacotes</legend>
        ${(d.filtros ?? []).length ? `<ol class="regras" aria-label="Regras de filtro de ${esc(d.nome)}, lidas de cima para baixo">${d.filtros.map((f, i) => `<li class="regra"><span class="regra-txt"><b>${f.acao === 'negar' ? 'negar' : 'permitir'}</b> de ${esc(alvoFiltro(f.origem, f.origemM))} <b>para</b> ${esc(alvoFiltro(f.destino, f.destinoM))}</span>
          <span class="acoes-regra"><button class="btn-sec" type="button" data-mover-filtro="${i}" data-delta="-1" aria-label="Subir a regra ${i + 1}"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="btn-sec" type="button" data-mover-filtro="${i}" data-delta="1" aria-label="Descer a regra ${i + 1}"${i === d.filtros.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="btn-sec" type="button" data-remover-filtro="${i}" aria-label="Remover a regra ${i + 1}">Remover</button></span></li>`).join('')}</ol>` : '<p>Nenhuma regra: o roteador encaminha tudo.</p>'}
        <label for="cfg-filtro-acao">Nova regra: ação</label><select id="cfg-filtro-acao" class="campo" name="filtro-acao"><option value="">(não acrescentar)</option><option value="negar">negar</option><option value="permitir">permitir</option></select>
        <label for="cfg-filtro-o">Origem: rede</label><input id="cfg-filtro-o" class="campo" name="filtro-o" inputmode="decimal" autocomplete="off" placeholder="vazio = qualquer origem">
        <label for="cfg-filtro-om">Origem: máscara</label><input id="cfg-filtro-om" class="campo" name="filtro-om" autocomplete="off" placeholder="ex.: /24 ou /32 para um só PC">
        <label for="cfg-filtro-d">Destino: rede</label><input id="cfg-filtro-d" class="campo" name="filtro-d" inputmode="decimal" autocomplete="off" placeholder="vazio = qualquer destino">
        <label for="cfg-filtro-dm">Destino: máscara</label><input id="cfg-filtro-dm" class="campo" name="filtro-dm" autocomplete="off" placeholder="ex.: 255.255.255.0">
        <p class="motivo">As regras valem de cima para baixo; vale a primeira que casa. O que não casa com nenhuma é <b>permitido</b> (numa ACL Cisco seria negado). O filtro não guarda estado: a resposta de um ping também passa por ele, com origem e destino trocados.</p></fieldset>` : ''}
      ${d.tipo === 'switch' ? `<p>O switch não tem IP nesta simulação. Configure o modo de cada porta: <b>access</b> (uma VLAN, sem marca) ou <b>trunk</b> (leva todas as VLANs entre switches; a VLAN nativa é a 1).</p>
        <table class="tabela portas-sw"><caption class="sr-only">Portas do switch</caption>
          <thead><tr><th scope="col">Porta</th><th scope="col">Modo</th><th scope="col">VLAN</th></tr></thead>
          <tbody>${TIPOS.switch.portas.map(p => {
            const c = configDaPortaSwitch(d, p.id), v = cabos.find(x => x.minhaPorta === p.id);
            return `<tr><th scope="row">${esc(p.rotulo)}<br><small class="motivo">${v ? '→ ' + esc(dispositivo(topo, v.outro.d).nome) : 'livre'}</small></th>
              <td><label class="sr-only" for="cfg-modo-${p.id}">Modo da porta ${esc(p.rotulo)}</label><select id="cfg-modo-${p.id}" class="campo" name="modo-${p.id}"><option value="access"${c.modo === 'access' ? ' selected' : ''}>access</option><option value="trunk"${c.modo === 'trunk' ? ' selected' : ''}>trunk</option></select></td>
              <td><label class="sr-only" for="cfg-vlan-${p.id}">VLAN da porta ${esc(p.rotulo)}</label><input id="cfg-vlan-${p.id}" class="campo qtd" name="vlan-${p.id}" inputmode="numeric" autocomplete="off" value="${c.modo === 'trunk' ? '' : c.vlan}" ${c.modo === 'trunk' ? 'placeholder="todas"' : ''}></td></tr>`;
          }).join('')}</tbody></table>` : ''}
      <div class="acoes"><button class="btn" type="submit">Aplicar</button>${livre ? `<button class="btn-sec btn-perigo" type="button" data-remover-disp="${d.id}">Remover dispositivo</button>` : ''}</div>
      <h4>Cabos</h4>
      ${cabos.length ? `<ul class="cabos-lista">${cabos.map(v => `<li>${esc(rotuloDaPorta(d, v.minhaPorta))} ↔ ${esc(dispositivo(topo, v.outro.d).nome)} (${esc(rotuloDaPorta(dispositivo(topo, v.outro.d), v.outro.p))})
        <button class="btn-sec" type="button" data-remover-cabo="${v.cabo.id}" aria-label="Remover cabo para ${esc(dispositivo(topo, v.outro.d).nome)}">Remover</button></li>`).join('')}</ul>` : '<p>Nenhum cabo ligado.</p>'}
    </form>`;
  }

  // ---------- terminal ----------
  function renderTerm() {
    const alvo = $('#lab-term');
    const d = sel ? dispositivo(topo, sel) : null;
    if (!d || d.tipo !== 'pc') { alvo.innerHTML = ''; return; }
    if (!saidas.has(d.id)) saidas.set(d.id, ['Terminal simulado. Digite help para ver os comandos.']);
    alvo.innerHTML = `<div class="painel terminal">
      <h3>Terminal de ${esc(d.nome)}</h3>
      <div class="term-saida" id="term-saida" role="log" aria-live="polite" tabindex="0" aria-label="Saída do terminal"><pre>${esc(saidas.get(d.id).join('\n'))}</pre></div>
      <form id="form-term" class="term-linha" autocomplete="off"><label for="term-entrada" class="term-prompt">C:\\&gt;</label>
        <input id="term-entrada" class="campo term-entrada" spellcheck="false" autocapitalize="off" aria-label="Comando"></form>
    </div>`;
  }

  function rodarComando(linha) {
    const d = dispositivo(topo, sel);
    const saida = saidas.get(d.id) ?? [];
    const r = executar(sim, d.id, linha);
    const novas = r.limpar ? [] : [...saida, `C:\\>${linha}`, ...r.linhas, ''];
    saidas.set(d.id, r.limpar ? [] : novas.slice(-400));
    const hist = historicos.get(d.id) ?? [];
    if (linha.trim()) historicos.set(d.id, [...hist, linha].slice(-50));
    posHist.set(d.id, null);
    opcoes.aoSimular?.({ dispositivo: d.id, comando: linha, linhas: r.linhas });
    const pre = $('#term-saida pre');
    pre.textContent = saidas.get(d.id).join('\n');
    const caixa = $('#term-saida'); caixa.scrollTop = caixa.scrollHeight;
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
    if (e.target.id !== 'cfg-dhcp') return;
    for (const fs of raiz.querySelectorAll('#form-cfg fieldset[data-fixo]')) fs.disabled = e.target.checked;
  }, { signal });

  raiz.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'form-cfg') {
      const f = new FormData(e.target);
      let r = { topologia: topo };
      const passos = [t => renomear(t, sel, f.get('nome'))];
      const alvoCfg = dispositivo(topo, sel), usaDhcp = alvoCfg.tipo === 'pc' && f.get('dhcp') === 'on';
      if (alvoCfg.tipo === 'pc') passos.push(t => configurarDhcpPc(t, sel, usaDhcp));
      if (!usaDhcp) {
        for (const i of alvoCfg.interfaces) passos.push(t => configurarInterface(t, sel, i.id, { ip: f.get(`ip-${i.id}`), mascara: f.get(`m-${i.id}`) }));
        if (alvoCfg.tipo === 'pc') passos.push(t => configurarGateway(t, sel, f.get('gw')));
      }
      if (alvoCfg.tipo === 'roteador' && f.get('filtro-acao')) {
        passos.push(t => adicionarFiltro(t, sel, { acao: f.get('filtro-acao'), origem: f.get('filtro-o'), origemM: f.get('filtro-om'), destino: f.get('filtro-d'), destinoM: f.get('filtro-dm') }));
      }
      if (alvoCfg.tipo === 'pc') {
        passos.push(t => configurarDnsPc(t, sel, f.get('dns')));
        const nomeReg = String(f.get('reg-nome') ?? '').trim(), ipReg = String(f.get('reg-ip') ?? '').trim();
        if (nomeReg || ipReg) passos.push(t => adicionarRegistroDns(t, sel, { nome: nomeReg, ip: ipReg }));
      }
      if (alvoCfg.tipo === 'roteador') {
        const dentro = String(f.get('nat-dentro') ?? ''), fora = String(f.get('nat-fora') ?? '');
        if (dentro && fora) passos.push(t => configurarNat(t, sel, { dentro, fora }));
        else if (!dentro && !fora) passos.push(t => removerNat(t, sel));
        else passos.push(() => ({ erro: 'Para ligar o NAT, escolha a interface de dentro e a de fora (ou deixe as duas em "NAT desligado").' }));
      }
      if (alvoCfg.tipo === 'roteador') for (const i of alvoCfg.interfaces) passos.push(t => configurarPoolDhcp(t, sel, i.id, { inicio: f.get(`pool-ini-${i.id}`), fim: f.get(`pool-fim-${i.id}`) }));
      if (dispositivo(topo, sel).tipo === 'roteador') {
        const campos = { rede: String(f.get('rota-rede') ?? '').trim(), mascara: String(f.get('rota-m') ?? '').trim(), via: String(f.get('rota-via') ?? '').trim() };
        const preenchidos = Object.values(campos).filter(Boolean).length;
        if (preenchidos === 3) passos.push(t => adicionarRotaEstatica(t, sel, campos));
        else if (preenchidos > 0) passos.push(() => ({ erro: 'Para acrescentar uma rota, preencha a rede, a máscara e o próximo salto.' }));
      }
      if (dispositivo(topo, sel).tipo === 'switch') {
        for (const p of TIPOS.switch.portas) {
          const modo = f.get(`modo-${p.id}`);
          const atual = configDaPortaSwitch(dispositivo(topo, sel), p.id);
          // trunk não usa VLAN; ao voltar para access sem informar VLAN, usa a que estava (ou 1)
          const vlan = f.get(`vlan-${p.id}`) || (atual.modo === 'access' ? atual.vlan : 1);
          passos.push(t => configurarPortaSwitch(t, sel, p.id, { modo, vlan }));
        }
      }
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
