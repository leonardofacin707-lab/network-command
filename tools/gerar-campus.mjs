// Acrescenta as missões do módulo Campus de Redes (modulo: "campus") em data/missions.json, montadas pela API do simulador.
// Idempotente: substitui as missões de mesmo id. Não toca nas missões do módulo Missões.
import { readFileSync, writeFileSync } from 'node:fs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, configurarPortaSwitch } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));

const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };
/** disp: [[tipo, x, y]]; cabos: [[a, b, portaA, portaB]]; ips: [[id, porta, ip, mascara]]; gws: {id: ip}; vlans: [[sw, porta, modo, vlan]] */
function montar({ disp, cabos, ips, gws = {}, vlans = [] }) {
  let t = topologiaVazia();
  for (const [tipo, x, y] of disp) t = ok(adicionarDispositivo(t, tipo, { x, y }));
  for (const [a, b, pa, pb] of cabos) t = ok(conectar(t, a, b, pa, pb));
  for (const [id, p, ip, m] of ips) t = ok(configurarInterface(t, id, p, { ip, mascara: m }));
  for (const [id, gw] of Object.entries(gws)) t = ok(configurarGateway(t, id, gw));
  for (const [sw, p, modo, vlan] of vlans) t = ok(configurarPortaSwitch(t, sw, p, { modo, vlan }));
  return t;
}
const ip24 = (id, ip) => [id, 'eth0', ip, '/24'];

const campus = [
  { id: 'porta-na-vlan-errada', modo: 'campus', titulo: 'A porta na VLAN errada', dificuldade: 1, xp: 120,
    cenario: 'No laboratório de informática, os PCs 1, 2 e 3 deveriam estar na mesma VLAN (10), com endereços da mesma sub-rede. O PC3 não consegue falar com os outros dois.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc3' }, { id: 'o2', de: 'pc3', para: 'pc2' }],
    dicas: ['Os endereços IP estão corretos. Confira a VLAN de cada porta do switch ao qual os PCs estão ligados.', 'Selecione o SW1 e compare a VLAN da porta do PC3 com a das portas dos outros dois.'],
    topologia: montar({ disp: [['switch', 450, 130], ['pc', 200, 340], ['pc', 450, 340], ['pc', 700, 340]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw1', 'eth0', 'fa3']],
      ips: [ip24('pc1', '192.168.10.1'), ip24('pc2', '192.168.10.2'), ip24('pc3', '192.168.10.3')],
      vlans: [['sw1', 'fa1', 'access', 10], ['sw1', 'fa2', 'access', 10], ['sw1', 'fa3', 'access', 20]] }) },
  { id: 'trunk-esquecido', modo: 'campus', titulo: 'O trunk esquecido', dificuldade: 2, xp: 180,
    cenario: 'O prédio A e o prédio B têm as mesmas duas VLANs (10 e 20), cada uma com um PC por prédio. Dentro de cada prédio tudo funciona, mas nada atravessa o cabo entre os switches.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc3' }, { id: 'o2', de: 'pc2', para: 'pc4' }],
    dicas: ['As portas dos PCs estão certas. Olhe a configuração das portas nas duas pontas do cabo que liga os switches.', 'Esse cabo precisa levar mais de uma VLAN ao mesmo tempo: use o modo trunk, e nos dois switches.', 'Colocar o cabo em access na VLAN 10 resolveria só metade dos objetivos.'],
    topologia: montar({ disp: [['switch', 220, 150], ['switch', 680, 150], ['pc', 110, 360], ['pc', 330, 360], ['pc', 570, 360], ['pc', 790, 360]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw2', 'eth0', 'fa1'], ['pc4', 'sw2', 'eth0', 'fa2'], ['sw1', 'sw2', 'fa8', 'fa8']],
      ips: [ip24('pc1', '192.168.10.1'), ip24('pc2', '192.168.20.2'), ip24('pc3', '192.168.10.3'), ip24('pc4', '192.168.20.4')],
      vlans: [['sw1', 'fa1', 'access', 10], ['sw1', 'fa2', 'access', 20], ['sw2', 'fa1', 'access', 10], ['sw2', 'fa2', 'access', 20]] }) },
  { id: 'vlans-sem-gateway', modo: 'campus', titulo: 'VLANs que não se falam', dificuldade: 2, xp: 200,
    cenario: 'A secretaria (VLAN 10) precisa acessar um servidor da diretoria (VLAN 20). O roteador tem uma interface em cada VLAN e os computadores já apontam para os gateways certos, mas o ping não passa.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc2', para: 'pc1' }],
    dicas: ['Cada interface do roteador precisa estar na mesma VLAN dos computadores que a usam como gateway.', 'Veja em qual porta do switch cada interface do roteador está ligada e qual é a VLAN dessa porta.'],
    topologia: montar({ disp: [['pc', 150, 130], ['pc', 750, 130], ['switch', 450, 250], ['roteador', 450, 420]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['r1', 'sw1', 'gi0', 'fa7'], ['r1', 'sw1', 'gi1', 'fa8']],
      ips: [ip24('pc1', '192.168.10.1'), ip24('pc2', '192.168.20.1'), ['r1', 'gi0', '192.168.10.254', '/24'], ['r1', 'gi1', '192.168.20.254', '/24']],
      gws: { pc1: '192.168.10.254', pc2: '192.168.20.254' },
      vlans: [['sw1', 'fa1', 'access', 10], ['sw1', 'fa2', 'access', 20], ['sw1', 'fa7', 'access', 10]] }) },
  { id: 'campus-completo', modo: 'campus', titulo: 'O campus inteiro', dificuldade: 3, xp: 300,
    cenario: 'Dois prédios, duas VLANs (10 e 20) e um roteador no prédio A que liga as duas. Depois da última mudança, quase nada funciona: há mais de um defeito.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc3' }, { id: 'o2', de: 'pc2', para: 'pc4' }, { id: 'o3', de: 'pc1', para: 'pc4' }],
    dicas: ['Resolva por partes: primeiro uma VLAN dentro do prédio, depois entre os prédios, depois entre as VLANs.', 'Há um defeito no cabo entre os switches e outro na VLAN de uma porta de computador.', 'O PC4 deveria estar na VLAN 20, como o PC2. E o cabo entre os prédios precisa ser trunk nos dois lados.'],
    topologia: montar({ disp: [['switch', 230, 190], ['switch', 670, 190], ['pc', 90, 380], ['pc', 250, 380], ['pc', 600, 380], ['pc', 790, 380], ['roteador', 230, 60]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw2', 'eth0', 'fa1'], ['pc4', 'sw2', 'eth0', 'fa2'], ['sw1', 'sw2', 'fa8', 'fa8'], ['r1', 'sw1', 'gi0', 'fa6'], ['r1', 'sw1', 'gi1', 'fa7']],
      ips: [ip24('pc1', '192.168.10.1'), ip24('pc2', '192.168.20.2'), ip24('pc3', '192.168.10.3'), ip24('pc4', '192.168.20.4'), ['r1', 'gi0', '192.168.10.254', '/24'], ['r1', 'gi1', '192.168.20.254', '/24']],
      gws: { pc1: '192.168.10.254', pc2: '192.168.20.254', pc3: '192.168.10.254', pc4: '192.168.20.254' },
      vlans: [['sw1', 'fa1', 'access', 10], ['sw1', 'fa2', 'access', 20], ['sw1', 'fa6', 'access', 10], ['sw1', 'fa7', 'access', 20], ['sw2', 'fa1', 'access', 10], ['sw2', 'fa2', 'access', 10]] }) }
].map(({ modo, ...m }) => ({ ...m, modulo: modo }));

const ids = new Set(campus.map(m => m.id));
const saida = [...existentes.filter(m => !ids.has(m.id)), ...campus];
writeFileSync(destino, JSON.stringify(saida, null, 2) + '\n');
console.log(`${campus.length} missões de campus gravadas (${saida.length} no total).`);
