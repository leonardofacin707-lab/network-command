// Envio do formulário do painel: transforma os campos em passos de configuração do modelo (aplicados em ordem).
import { TIPOS, dispositivo, renomear, configurarInterface, configurarGateway, configurarPortaSwitch, configDaPortaSwitch, adicionarRotaEstatica, configurarPoolDhcp, configurarDhcpPc, adicionarFiltro, configurarDnsPc, adicionarRegistroDns, configurarNat, removerNat, configurarServicos, configurarInterface6, configurarGateway6, configurarSlaac, configurarRoteamento6, adicionarRota6, configurarWifiAp, configurarWifiPc, adicionarNetworkOspf, configurarDhcp6Pc, configurarPoolDhcp6 } from '../sim/topologia.js';

/** Lista de funções (topologia -> { topologia } | { erro }) a aplicar em ordem. f: FormData; topo: topologia atual; sel: id. */
export function passosDoFormulario(f, topo, sel) {
  const passos = [t => renomear(t, sel, f.get('nome'))];
  const alvoCfg = dispositivo(topo, sel), usaDhcp = alvoCfg.tipo === 'pc' && f.get('dhcp') === 'on';
  if (alvoCfg.tipo === 'pc') passos.push(t => configurarDhcpPc(t, sel, usaDhcp));
  if (!usaDhcp) {
    for (const i of alvoCfg.interfaces) passos.push(t => configurarInterface(t, sel, i.id, { ip: f.get(`ip-${i.id}`), mascara: f.get(`m-${i.id}`) }));
    if (alvoCfg.tipo === 'pc') passos.push(t => configurarGateway(t, sel, f.get('gw')));
  }
  if (alvoCfg.tipo === 'roteador' && f.get('filtro-acao')) {
    passos.push(t => adicionarFiltro(t, sel, { acao: f.get('filtro-acao'), origem: f.get('filtro-o'), origemM: f.get('filtro-om'), destino: f.get('filtro-d'), destinoM: f.get('filtro-dm'), protocolo: f.get('filtro-proto') ?? 'ip', porta: f.get('filtro-porta') ?? '' }));
  }
  if (alvoCfg.tipo === 'pc') {
    passos.push(t => configurarServicos(t, sel, f.getAll('servico').map(Number)));
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
  if (alvoCfg.tipo === 'roteador') {
    const on = { rede: String(f.get('ospf-rede') ?? '').trim(), wildcard: String(f.get('ospf-wc') ?? '').trim(), area: String(f.get('ospf-area') ?? '').trim() };
    if (on.rede || on.wildcard || on.area) passos.push(t => adicionarNetworkOspf(t, sel, on));
  }
  if (alvoCfg.tipo === 'ap') passos.push(t => configurarWifiAp(t, sel, { ssid: f.get('ssid'), seguranca: f.get('seg'), senha: f.get('wsenha'), banda: f.get('banda'), oculto: f.get('oculto') === 'on' }));
  if (alvoCfg.tipo === 'pc') passos.push(t => configurarWifiPc(t, sel, { ssid: f.get('wssid'), senha: f.get('wpc'), so24: f.get('so24') === 'on' }));
  if (alvoCfg.tipo !== 'switch' && alvoCfg.tipo !== 'ap') {
    const modo6 = String(f.get('modo6') ?? 'manual'), auto = alvoCfg.tipo === 'pc' && modo6 !== 'manual';
    if (alvoCfg.tipo === 'pc') { passos.push(t => configurarSlaac(t, sel, modo6 === 'slaac')); passos.push(t => configurarDhcp6Pc(t, sel, modo6 === 'dhcp6')); }
    if (alvoCfg.tipo === 'roteador') passos.push(t => configurarRoteamento6(t, sel, f.get('rot6') === 'on'));
    if (!auto) {
      for (const i of alvoCfg.interfaces) passos.push(t => configurarInterface6(t, sel, i.id, { ip6: f.get(`ip6-${i.id}`), prefixo6: f.get(`p6-${i.id}`) }));
      if (alvoCfg.tipo === 'roteador') for (const i of alvoCfg.interfaces) passos.push(t => configurarPoolDhcp6(t, sel, i.id, { inicio: f.get(`p6i-${i.id}`), fim: f.get(`p6f-${i.id}`) }));
      if (alvoCfg.tipo === 'pc') passos.push(t => configurarGateway6(t, sel, f.get('gw6')));
    }
    const r6 = String(f.get('r6-rede') ?? '').trim(), v6 = String(f.get('r6-via') ?? '').trim();
    if (alvoCfg.tipo === 'roteador' && (r6 || v6)) {
      passos.push(r6.includes('/') && v6 ? (t => adicionarRota6(t, sel, { rede: r6, via: v6 })) : () => ({ erro: 'Para acrescentar uma rota IPv6, preencha rede/prefixo (ex.: 2001:db8:3::/64) e o próximo salto.' }));
    }
  }
  return passos;
}
