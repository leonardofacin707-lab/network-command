// Desenho da rede no SVG do laboratório (só gera marcação; quem chama decide onde colocar).
import { esc } from '../core/ui.js';
import { dispositivo, vizinhos, rotuloDaPorta, configDaPortaSwitch, vlansDoSwitch } from '../sim/topologia.js';

export const ICONE = {
  pc: '<rect x="-26" y="-22" width="52" height="34" rx="4"/><path d="M-12 22h24M0 12v10"/>',
  switch: '<rect x="-36" y="-12" width="72" height="24" rx="4"/><path d="M-24 0h.01M-12 0h.01M0 0h.01M12 0h.01M24 0h.01"/>',
  roteador: '<circle r="26"/><path d="M0-14v28M-14 0h28M-5-9l5-5 5 5M-5 9l5 5 5-5M-9-5l-5 5 5 5M9-5l5 5-5 5"/>',
  ap: '<rect x="-26" y="2" width="52" height="16" rx="4"/><path d="M0 2v-14M-10-14a14 14 0 0 1 20 0M-17-21a24 24 0 0 1 34 0"/>'
};
export const TIPO_ROTULO = { pc: 'computador', switch: 'switch', roteador: 'roteador', ap: 'ponto de acesso' };

/** Centro de um dispositivo no desenho. */
export const centroDe = (topo, id) => { const d = dispositivo(topo, id); return [d.x, d.y]; };

/**
 * Marcação SVG da rede: ligações sem fio (tracejadas), cabos e dispositivos.
 * e: { topo, sim, sel, origemCabo } (sim.topologia traz DHCP, SLAAC e Wi-Fi aplicados).
 */
export function desenharRede(e) {
  const { topo, sim, sel, origemCabo } = e;
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
    for (const i of efetivo.interfaces) if (i.ip6) ips.push(`${i.ip6}/${i.prefixo6}`);
    let vlanTxt = '';
    if (d.tipo === 'switch') {
      const vl = vlansDoSwitch(topo, d.id);
      const trunks = vizinhos(topo, d.id).filter(v => configDaPortaSwitch(d, v.minhaPorta).modo === 'trunk').length;
      if (vl.some(v => v !== 1) || trunks) vlanTxt = [vl.length ? `VLAN ${vl.join(',')}` : '', trunks ? `trunk×${trunks}` : ''].filter(Boolean).join(' · ');
      if (vlanTxt) ips.push(vlanTxt);
    }
    if (d.tipo === 'ap') ips.push(`((( ${d.wifi.ssid}${d.wifi.oculto ? ' (oculto)' : ''}`);
    if (d.tipo === 'pc' && d.wifi) ips.push(sim.wifi?.get(d.id)?.ok ? `Wi-Fi: ${d.wifi.ssid}` : 'Wi-Fi: desconectado');
    const ligado = vizinhos(topo, d.id).length > 0;
    return `<g class="disp tipo-${d.tipo}${sel === d.id ? ' sel' : ''}${origemCabo === d.id ? ' origem' : ''}" data-id="${d.id}" transform="translate(${d.x} ${d.y})"
        role="button" tabindex="0" aria-label="${esc(d.nome)}${ips.length ? ' ' + ips.join(' ') : ''}, ${TIPO_ROTULO[d.tipo]}${ips.length ? '' : ', sem IP'}${ligado ? '' : ', sem cabo'}">
      <rect class="area" x="-48" y="-40" width="96" height="104" rx="10"/>
      <g class="icone">${ICONE[d.tipo]}</g>
      <text class="nome" y="${d.tipo === 'roteador' ? 46 : 42}">${esc(d.nome)}</text>
      ${ips.map((ip, i) => `<text class="ip" y="${(d.tipo === 'roteador' ? 60 : 56) + i * 13}">${esc(ip)}</text>`).join('\n      ')}
    </g>`;
  }

  const semFio = sim.topologia.cabos.filter(c => c.semFio).map(c => { const [x1, y1] = centro(c.a.d), [x2, y2] = centro(c.b.d); return `<line class="cabo-wifi" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join('');
  return `<g class="cabos">${semFio}${desenharCabos()}</g>${topo.dispositivos.map(desenharDispositivo).join('')}`;
}
