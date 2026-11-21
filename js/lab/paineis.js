// Painel de configuração do dispositivo selecionado (só gera o HTML do formulário; o envio está em formulario.js).
import { esc } from '../core/ui.js';
import { TIPOS, dispositivo, vizinhos, rotuloDaPorta, configDaPortaSwitch, SEGURANCAS_WIFI, BANDAS_WIFI } from '../sim/topologia.js';
import { NOMES_PORTAS } from '../sim/motor.js';
import { formatarIPv4, lerMascara, prefixoDeMascara } from '../sim/ipv4.js';
import { MOTIVO_DHCP, MOTIVO_SLAAC, MOTIVO_DHCP6 } from '../sim/terminal.js';
import { formatarIPv6 } from '../sim/ipv6.js';
import { enderecosDaInterface } from '../sim/motor6.js';
import { MOTIVO_WIFI } from '../sim/wifi.js';
import { prefixoOspf } from '../sim/ospf.js';
import { TIPO_ROTULO } from './desenho.js';

/** HTML do painel. e: { topo, sim, sel, livre }. */
export function htmlPainel(e) {
  const { topo, sim, sel, livre } = e;
  const redePrefixo = (rede, mascara) => `${rede}/${prefixoDeMascara(lerMascara(mascara))}`;
  const PORTAS_COMUNS = [21, 22, 23, 25, 80, 443];
  const alvoFiltro = (rede, mascara) => (rede === '0.0.0.0' && mascara === '0.0.0.0' ? 'qualquer' : redePrefixo(rede, mascara));
  const poolDe = (d, porta) => (d.pools ?? []).find(q => q.porta === porta);
  /** Painel OSPF: comandos network (rede, wildcard, área), vizinhos e rotas aprendidas. */
  function fieldsetOspf(d) {
    if (d.tipo !== 'roteador') return '';
    const viz = sim.ospf?.vizinhos.get(d.id) ?? [], rotas = dispositivo(sim.topologia, d.id)?.rotasOspf ?? [];
    const ESTADO = { FULL: 'vizinhança completa (FULL)', 'area-diferente': 'sem vizinhança: áreas diferentes', 'mascara-diferente': 'sem vizinhança: máscara ou sub-rede diferente' };
    return `<fieldset class="iface" id="ospf-roteador"><legend>OSPF</legend>
      ${(d.ospf?.redes ?? []).length ? `<ol class="regras" aria-label="Comandos network do OSPF de ${esc(d.nome)}">${d.ospf.redes.map((n, i) => `<li class="regra"><span class="regra-txt">network ${esc(n.rede)} ${esc(n.wildcard)} <b>area</b> ${n.area}</span>
        <span class="acoes-regra"><button class="btn-sec" type="button" data-remover-ospf="${i}" aria-label="Remover o comando network ${esc(n.rede)}">Remover</button></span></li>`).join('')}</ol>` : '<p>OSPF desligado: nenhum comando network.</p>'}
      ${viz.length ? `<p class="motivo" role="status">Vizinhos: ${viz.map(v => `${esc(dispositivo(topo, v.vizinho).nome)} (${ESTADO[v.estado]})`).join('; ')}.</p>` : ''}
      ${rotas.length ? `<p class="motivo">Rotas aprendidas: ${rotas.map(r => `${esc(formatarIPv4(r.rede))}/${prefixoOspf(r.mascara)} via ${esc(formatarIPv4(r.via))} (custo ${r.custo})`).join('; ')}.</p>` : ''}
      <label for="cfg-ospf-rede">Novo network: rede</label><input id="cfg-ospf-rede" class="campo" name="ospf-rede" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.0">
      <label for="cfg-ospf-wc">Wildcard (inverso da máscara)</label><input id="cfg-ospf-wc" class="campo" name="ospf-wc" inputmode="decimal" autocomplete="off" placeholder="ex.: 0.0.0.255 para /24">
      <label for="cfg-ospf-area">Área</label><input id="cfg-ospf-area" class="campo qtd" name="ospf-area" inputmode="numeric" autocomplete="off" placeholder="0">
      <p class="motivo">Simplificação: custo 1 por enlace, sem DR/BDR, timers ou várias áreas de verdade. A interface entra no OSPF quando o IP dela casa com um network.</p></fieldset>`;
  }

  /** Painel Wi-Fi: rede do ponto de acesso, ou a conexão sem fio do computador. Senhas daqui são de laboratório. */
  function fieldsetWifi(d) {
    const aviso = '<p class="motivo">Use só senhas inventadas para o laboratório: o que você digita aqui fica salvo neste navegador.</p>';
    if (d.tipo === 'ap') {
      const w = d.wifi, clientes = [...(sim.wifi ?? [])].filter(([, a]) => a.ok && a.ap === d.id).map(([id]) => dispositivo(topo, id).nome);
      return `<fieldset class="iface" id="wifi-ap"><legend>Rede Wi-Fi</legend>
        <label for="cfg-ssid">Nome da rede (SSID)</label><input id="cfg-ssid" class="campo" name="ssid" maxlength="32" autocomplete="off" spellcheck="false" value="${esc(w.ssid)}">
        <label for="cfg-seg">Segurança</label><select id="cfg-seg" class="campo" name="seg">${Object.entries(SEGURANCAS_WIFI).map(([k, v]) => `<option value="${k}"${w.seguranca === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
        <label for="cfg-wsenha">Senha (8 a 63 caracteres)</label><input id="cfg-wsenha" class="campo" name="wsenha" maxlength="63" autocomplete="off" spellcheck="false" value="${esc(w.senha)}">
        <label for="cfg-banda">Banda</label><select id="cfg-banda" class="campo" name="banda">${Object.entries(BANDAS_WIFI).map(([k, v]) => `<option value="${k}"${w.banda === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
        <label class="opcao"><input type="checkbox" name="oculto"${w.oculto ? ' checked' : ''}> SSID oculto (não aparece na lista de redes)</label>
        <p class="motivo" role="status">${clientes.length ? `Conectados: ${esc(clientes.join(', '))}.` : 'Nenhum computador conectado.'}</p>
        ${aviso}
        <p class="motivo">Simplificação: sem alcance, canais, interferência ou WPA-Enterprise. Ligue a porta Ethernet0 do ponto de acesso a um switch.</p></fieldset>`;
    }
    if (d.tipo !== 'pc') return '';
    const a = sim.wifi?.get(d.id);
    return `<fieldset class="iface" id="wifi-pc"><legend>Conexão Wi-Fi</legend>
      <label for="cfg-wssid">Rede (SSID)</label><input id="cfg-wssid" class="campo" name="wssid" maxlength="32" autocomplete="off" spellcheck="false" placeholder="vazio = usar cabo" value="${esc(d.wifi?.ssid ?? '')}">
      <label for="cfg-wpc">Senha</label><input id="cfg-wpc" class="campo" name="wpc" maxlength="63" autocomplete="off" spellcheck="false" value="${esc(d.wifi?.senha ?? '')}">
      <label class="opcao"><input type="checkbox" name="so24"${d.wifi?.so24 ? ' checked' : ''}> Adaptador antigo (só 2,4 GHz)</label>
      ${d.wifi ? `<p class="motivo" role="status">${a?.ok ? `Conectado a ${esc(dispositivo(topo, a.ap).nome)} (${esc(a.banda)}).` : `Desconectado: ${esc(MOTIVO_WIFI[a?.motivo] ?? '')}.`}</p>` : ''}
      ${aviso}</fieldset>`;
  }

  /** Painel IPv6: endereço global e prefixo por interface, link-local automático, gateway e SLAAC (PC) ou roteamento e rotas (roteador). */
  function fieldsetIPv6(d) {
    if (d.tipo === 'switch' || d.tipo === 'ap') return '';
    const efetivo = dispositivo(sim.topologia, d.id) ?? d;
    const ll = p => enderecosDaInterface(efetivo, p).find(e => e.tipo === 'link-local');
    const campos = i => `<label for="cfg-ip6-${i.id}">Endereço IPv6 de ${esc(rotuloDaPorta(d, i.id))}</label><input id="cfg-ip6-${i.id}" class="campo" name="ip6-${i.id}" autocomplete="off" spellcheck="false" placeholder="ex.: 2001:db8:1::10 (vazio = sem IPv6 global)" value="${esc(i.ip6 ?? '')}">
        <label for="cfg-p6-${i.id}">Prefixo</label><input id="cfg-p6-${i.id}" class="campo qtd" name="p6-${i.id}" inputmode="numeric" autocomplete="off" placeholder="64" value="${i.prefixo6 ?? ''}">
        <p class="motivo">Link-local (automático): ${ll(i.id) ? esc(formatarIPv6(ll(i.id).ip)) : 'aparece quando a interface tiver IPv6'}</p>`;
    if (d.tipo === 'pc') {
      const modo = d.slaac ? 'slaac' : d.dhcp6 ? 'dhcp6' : 'manual', a = d.slaac ? sim.slaac?.get(d.id) : sim.dhcp6?.get(d.id);
      const motivo = d.slaac ? MOTIVO_SLAAC[a?.motivo] : MOTIVO_DHCP6[a?.motivo];
      return `<fieldset class="iface" id="ipv6-cfg"><legend>IPv6</legend>
        <label for="cfg-modo6">Como obter o endereço IPv6</label><select id="cfg-modo6" class="campo" name="modo6">
          <option value="manual"${modo === 'manual' ? ' selected' : ''}>Manual (endereço fixo)</option>
          <option value="slaac"${modo === 'slaac' ? ' selected' : ''}>SLAAC (monta o endereço com o prefixo do roteador)</option>
          <option value="dhcp6"${modo === 'dhcp6' ? ' selected' : ''}>DHCPv6 (pede o endereço a um servidor)</option></select>
        ${modo !== 'manual' ? `<p class="motivo" role="status">${a?.ok ? `${modo === 'slaac' ? 'SLAAC' : 'DHCPv6'}: ${esc(formatarIPv6(a.ip))}/${a.prefixo}, gateway ${esc(formatarIPv6(a.gateway))} (link-local do roteador).` : esc(motivo ?? '')}</p>` : ''}
        <div data-fixo6${modo !== 'manual' ? ' hidden' : ''}>${d.interfaces.map(campos).join('')}
        <label for="cfg-gw6">Gateway padrão IPv6</label><input id="cfg-gw6" class="campo" name="gw6" autocomplete="off" spellcheck="false" placeholder="ex.: 2001:db8:1::1 ou o fe80:: do roteador" value="${esc(d.gateway6 ?? '')}"></div>
        ${modo !== 'manual' ? `<p class="motivo">Link-local (automático): ${esc(formatarIPv6(ll('eth0').ip))}</p>` : ''}
      </fieldset>`;
    }
    return `<fieldset class="iface" id="ipv6-cfg"><legend>IPv6</legend>
      <label class="opcao"><input type="checkbox" id="cfg-rot6" name="rot6"${d.ipv6Roteamento ? ' checked' : ''}> Rotear IPv6 (ipv6 unicast-routing)</label>
      <p class="motivo">Sem isso o roteador não encaminha IPv6 nem anuncia o prefixo para o SLAAC, como no Cisco IOS.</p>
      ${d.interfaces.map(i => campos(i) + `<label for="cfg-p6i-${i.id}">Pool DHCPv6 de ${esc(rotuloDaPorta(d, i.id))}: primeiro</label><input id="cfg-p6i-${i.id}" class="campo" name="p6i-${i.id}" autocomplete="off" spellcheck="false" placeholder="vazio = sem DHCPv6" value="${esc((d.pools6 ?? []).find(q => q.porta === i.id)?.inicio ?? '')}">
        <label for="cfg-p6f-${i.id}">Pool DHCPv6 de ${esc(rotuloDaPorta(d, i.id))}: último</label><input id="cfg-p6f-${i.id}" class="campo" name="p6f-${i.id}" autocomplete="off" spellcheck="false" placeholder="ex.: 2001:db8:1::1ff" value="${esc((d.pools6 ?? []).find(q => q.porta === i.id)?.fim ?? '')}">`).join('')}
      <h4>Rotas estáticas IPv6</h4>
      ${(d.rotas6 ?? []).length ? `<ol class="regras" aria-label="Rotas IPv6 de ${esc(d.nome)}">${d.rotas6.map((r, i) => `<li class="regra"><span class="regra-txt">${esc(r.rede)}/${r.prefixo} <b>via</b> ${esc(r.via)}</span>
        <span class="acoes-regra"><button class="btn-sec" type="button" data-remover-rota6="${i}" aria-label="Remover a rota IPv6 para ${esc(r.rede)}/${r.prefixo}">Remover</button></span></li>`).join('')}</ol>` : '<p>Nenhuma rota IPv6 estática.</p>'}
      <label for="cfg-r6-rede">Nova rota IPv6: rede/prefixo</label><input id="cfg-r6-rede" class="campo" name="r6-rede" autocomplete="off" spellcheck="false" placeholder="ex.: 2001:db8:3::/64 (::/0 = rota padrão)">
      <label for="cfg-r6-via">Próximo salto</label><input id="cfg-r6-via" class="campo" name="r6-via" autocomplete="off" spellcheck="false" placeholder="ex.: 2001:db8:2::2">
    </fieldset>`;
  }

  function infoConcessao(d) {
    const c = sim.concessoes.get(d.id);
    if (!c) return '';
    if (!c.ok) return `<p class="motivo" role="status">${esc(MOTIVO_DHCP[c.motivo] ?? 'Sem concessão.')}</p>`;
    return `<p class="motivo" role="status">Concessão: ${esc(formatarIPv4(c.ip))} / ${esc(formatarIPv4(c.mascara))}, gateway ${esc(formatarIPv4(c.gateway))}, servidor ${esc(formatarIPv4(c.servidor.ip))}.</p>`;
  }

  function renderCfg() {
    const d = sel ? dispositivo(topo, sel) : null;
    if (!d) {
      return `<div class="painel"><h3>Nenhum dispositivo selecionado</h3>
        <p>${topo.dispositivos.length ? 'Clique em um dispositivo para configurar IP, máscara e gateway, ver os cabos e (nos computadores) abrir o terminal.' : (livre ? 'A área de trabalho está vazia. Adicione dispositivos pela barra de ferramentas ou carregue um exemplo.' : 'Não há dispositivos neste cenário.')}</p></div>`;
    }
    const cabos = vizinhos(topo, d.id);
    return `<form class="painel" id="form-cfg" novalidate>
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
      ${fieldsetWifi(d)}
      ${fieldsetIPv6(d)}
      ${d.tipo === 'pc' ? `<fieldset class="iface" id="dns-pc"><legend>DNS</legend>
        <label for="cfg-dns">Servidor DNS (IP)</label><input id="cfg-dns" class="campo" name="dns" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.50" value="${esc(d.dns ?? '')}">
        <p class="motivo">O DHCP simplificado não entrega o servidor DNS: informe-o aqui, mesmo com DHCP ligado.</p>
        <h4>Este computador como servidor DNS</h4>
        ${(d.registros ?? []).length ? `<ol class="regras" aria-label="Registros DNS de ${esc(d.nome)}">${d.registros.map((r, i) => `<li class="regra"><span class="regra-txt">${esc(r.nome)} <b>→</b> ${esc(r.ip)}</span>
          <span class="acoes-regra"><button class="btn-sec" type="button" data-remover-registro="${i}" aria-label="Remover o registro ${esc(r.nome)}">Remover</button></span></li>`).join('')}</ol>` : '<p>Sem registros: este computador não responde consultas DNS.</p>'}
        <label for="cfg-reg-nome">Novo registro: nome</label><input id="cfg-reg-nome" class="campo" name="reg-nome" autocomplete="off" spellcheck="false" placeholder="ex.: www.loja.local">
        <label for="cfg-reg-ip">Novo registro: endereço IP</label><input id="cfg-reg-ip" class="campo" name="reg-ip" inputmode="decimal" autocomplete="off" placeholder="ex.: 192.168.1.60"></fieldset>` : ''}
      ${d.tipo === 'pc' ? `<fieldset class="iface" id="servicos-pc"><legend>Serviços (portas TCP abertas)</legend>
        <p class="motivo">Marque os serviços que este computador oferece. Teste de outro computador com <code>tnc ip porta</code>.</p>
        <div class="servicos">${[...new Set([...PORTAS_COMUNS, ...(d.servicos ?? [])])].sort((a, b) => a - b).map(p => `<label class="servico"><input type="checkbox" name="servico" value="${p}"${(d.servicos ?? []).includes(p) ? ' checked' : ''}> ${p} ${esc(NOMES_PORTAS[p] ?? '')}</label>`).join('')}</div></fieldset>` : ''}
      ${d.tipo === 'roteador' ? `<fieldset class="iface" id="rotas-estaticas"><legend>Rotas estáticas</legend>
        ${(d.rotas ?? []).length ? `<ol class="regras" aria-label="Rotas estáticas de ${esc(d.nome)}">${d.rotas.map((r, i) => `<li class="regra"><span class="regra-txt">${esc(redePrefixo(r.rede, r.mascara))} <b>via</b> ${esc(r.via)}</span>
          <span class="acoes-regra"><button class="btn-sec" type="button" data-remover-rota="${i}" aria-label="Remover a rota para ${esc(r.rede)}">Remover</button></span></li>`).join('')}</ol>` : '<p>Nenhuma rota estática. O roteador só conhece as redes ligadas diretamente a ele.</p>'}
        <label for="cfg-rota-rede">Rede de destino</label><input id="cfg-rota-rede" class="campo" name="rota-rede" inputmode="decimal" autocomplete="off" placeholder="ex.: 172.16.0.0 (0.0.0.0 = rota padrão)">
        <label for="cfg-rota-m">Máscara da rede</label><input id="cfg-rota-m" class="campo" name="rota-m" autocomplete="off" placeholder="ex.: 255.255.255.0 ou /24 (/0 = rota padrão)">
        <label for="cfg-rota-via">Próximo salto</label><input id="cfg-rota-via" class="campo" name="rota-via" inputmode="decimal" autocomplete="off" placeholder="ex.: 10.0.0.2 (o roteador vizinho)">
        <p class="motivo">Preencha os três campos e use Aplicar para acrescentar a rota.</p></fieldset>` : ''}
      ${fieldsetOspf(d)}
      ${d.tipo === 'roteador' ? `<fieldset class="iface" id="nat-roteador"><legend>NAT</legend>
        <label for="cfg-nat-dentro">Interface de dentro (rede privada)</label><select id="cfg-nat-dentro" class="campo" name="nat-dentro"><option value="">(NAT desligado)</option>${d.interfaces.map(i => `<option value="${i.id}"${d.nat?.dentro === i.id ? ' selected' : ''}>${esc(rotuloDaPorta(d, i.id))}</option>`).join('')}</select>
        <label for="cfg-nat-fora">Interface de fora (lado do provedor)</label><select id="cfg-nat-fora" class="campo" name="nat-fora"><option value="">(NAT desligado)</option>${d.interfaces.map(i => `<option value="${i.id}"${d.nat?.fora === i.id ? ' selected' : ''}>${esc(rotuloDaPorta(d, i.id))}</option>`).join('')}</select>
        <p class="motivo">NAT simplificado (tipo PAT): o que sai de dentro para fora ganha o IP da interface de fora, e a resposta volta sozinha. Quem vem de fora rumo à rede de dentro é bloqueado; não há redirecionamento de portas, tabela de traduções nem tempo de expiração.</p></fieldset>` : ''}
      ${d.tipo === 'roteador' ? `<fieldset class="iface" id="filtros-pacotes"><legend>Filtro de pacotes</legend>
        ${(d.filtros ?? []).length ? `<ol class="regras" aria-label="Regras de filtro de ${esc(d.nome)}, lidas de cima para baixo">${d.filtros.map((f, i) => `<li class="regra"><span class="regra-txt"><b>${f.acao === 'negar' ? 'negar' : 'permitir'}</b> ${f.protocolo ? `<b>${esc(f.protocolo)}</b> ` : ''}de ${esc(alvoFiltro(f.origem, f.origemM))} <b>para</b> ${esc(alvoFiltro(f.destino, f.destinoM))}${f.porta ? ` <b>porta</b> ${f.porta}${NOMES_PORTAS[f.porta] ? ' (' + NOMES_PORTAS[f.porta] + ')' : ''}` : ''}</span>
          <span class="acoes-regra"><button class="btn-sec" type="button" data-mover-filtro="${i}" data-delta="-1" aria-label="Subir a regra ${i + 1}"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="btn-sec" type="button" data-mover-filtro="${i}" data-delta="1" aria-label="Descer a regra ${i + 1}"${i === d.filtros.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="btn-sec" type="button" data-remover-filtro="${i}" aria-label="Remover a regra ${i + 1}">Remover</button></span></li>`).join('')}</ol>` : '<p>Nenhuma regra: o roteador encaminha tudo.</p>'}
        <label for="cfg-filtro-acao">Nova regra: ação</label><select id="cfg-filtro-acao" class="campo" name="filtro-acao"><option value="">(não acrescentar)</option><option value="negar">negar</option><option value="permitir">permitir</option></select>
        <label for="cfg-filtro-o">Origem: rede</label><input id="cfg-filtro-o" class="campo" name="filtro-o" inputmode="decimal" autocomplete="off" placeholder="vazio = qualquer origem">
        <label for="cfg-filtro-om">Origem: máscara</label><input id="cfg-filtro-om" class="campo" name="filtro-om" autocomplete="off" placeholder="ex.: /24 ou /32 para um só PC">
        <label for="cfg-filtro-d">Destino: rede</label><input id="cfg-filtro-d" class="campo" name="filtro-d" inputmode="decimal" autocomplete="off" placeholder="vazio = qualquer destino">
        <label for="cfg-filtro-dm">Destino: máscara</label><input id="cfg-filtro-dm" class="campo" name="filtro-dm" autocomplete="off" placeholder="ex.: 255.255.255.0">
        <label for="cfg-filtro-proto">Protocolo</label><select id="cfg-filtro-proto" class="campo" name="filtro-proto"><option value="ip">ip (qualquer)</option><option value="icmp">icmp (ping)</option><option value="tcp">tcp</option><option value="udp">udp</option></select>
        <label for="cfg-filtro-porta">Porta de destino (só tcp ou udp)</label><input id="cfg-filtro-porta" class="campo" name="filtro-porta" inputmode="numeric" autocomplete="off" placeholder="vazio = qualquer porta; ex.: 23 (Telnet)">
        <p class="motivo">As regras valem de cima para baixo; vale a primeira que casa. O que não casa com nenhuma é <b>permitido</b> (numa ACL Cisco seria negado). O filtro não guarda estado: a resposta também passa por ele, com origem e destino trocados (e as portas também: a resposta de um serviço sai da porta dele para a porta do cliente).</p></fieldset>` : ''}
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

  return renderCfg();
}
