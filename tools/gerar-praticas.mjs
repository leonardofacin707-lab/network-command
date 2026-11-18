// Acrescenta 4 missões de PRÁTICA (montar/configurar, em vez de consertar) em data/missions.json.
// Idempotente: substitui as de mesmo id e reordena as missões na ordem de aprendizagem.
// Objetivos com esperado: "falha" são de isolamento (o ping NÃO deve passar), usados nas missões de VLAN.
import { readFileSync, writeFileSync } from 'node:fs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));

const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };
function montar({ disp, cabos, ips = [] }) {
  let t = topologiaVazia();
  for (const [tipo, x, y] of disp) t = ok(adicionarDispositivo(t, tipo, { x, y }));
  for (const [a, b, pa, pb] of cabos) t = ok(conectar(t, a, b, pa, pb));
  for (const [id, p, ip, m] of ips) t = ok(configurarInterface(t, id, p, { ip, mascara: m }));
  return t;
}
const ip24 = (id, ip) => [id, 'eth0', ip, '/24'];

const praticas = [
  { id: 'primeira-rede', modulo: 'missoes', titulo: 'Sua primeira rede local', dificuldade: 1, xp: 100,
    habilidades: ['fundamentos.pratica', 'ip.pratica'],
    cenario: 'Três computadores de um escritório novo já estão ligados ao mesmo switch, mas nenhum tem endereço IP. Configure a rede para que todos se comuniquem.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc2', para: 'pc3' }, { id: 'o3', de: 'pc3', para: 'pc1' }],
    dicas: ['Computadores na mesma rede precisam de endereços da mesma sub-rede e com a mesma máscara. Cada um precisa de um endereço diferente.', 'Por exemplo: 192.168.1.10, 192.168.1.20 e 192.168.1.30, todos com máscara /24. Selecione cada PC e configure a interface eth0.'],
    topologia: montar({ disp: [['switch', 450, 130], ['pc', 200, 340], ['pc', 450, 340], ['pc', 700, 340]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw1', 'eth0', 'fa3']] }) },
  { id: 'duas-redes-um-roteador', modulo: 'missoes', titulo: 'Duas redes, um roteador', dificuldade: 3, xp: 250,
    habilidades: ['roteamento.pratica', 'ip.pratica'],
    cenario: 'A matriz e a filial estão ligadas por um roteador novo, mas nada foi configurado: nem os computadores, nem o roteador. Planeje duas redes e deixe os dois PCs se comunicarem.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc2', para: 'pc1' }],
    dicas: ['Cada lado do roteador é uma rede diferente: use uma sub-rede para cada interface (por exemplo 192.168.1.0/24 e 10.0.0.0/24).', 'A interface do roteador de cada lado precisa de um endereço da rede daquele lado. Esse endereço é o gateway dos computadores.', 'Configure o gateway padrão de cada PC com o endereço da interface do roteador que está ligada à rede dele.'],
    topologia: montar({ disp: [['pc', 110, 120], ['pc', 790, 120], ['switch', 250, 260], ['switch', 650, 260], ['roteador', 450, 400]],
      cabos: [['pc1', 'sw1'], ['sw1', 'r1'], ['pc2', 'sw2'], ['sw2', 'r1']] }) },
  { id: 'setores-separados', modulo: 'campus', titulo: 'Setores separados por VLAN', dificuldade: 2, xp: 150,
    habilidades: ['ethernet-comutacao.pratica'],
    cenario: 'Vendas (PC1 e PC2) e financeiro (PC3 e PC4) dividem o mesmo switch e a mesma sub-rede, e hoje todos se enxergam. Separe os setores com VLANs, sem perder a comunicação dentro de cada setor.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc3', para: 'pc4' }, { id: 'o3', de: 'pc1', para: 'pc3', esperado: 'falha' }, { id: 'o4', de: 'pc2', para: 'pc4', esperado: 'falha' }],
    dicas: ['Cada setor precisa de uma VLAN própria. Selecione o SW1 e configure o modo e a VLAN de cada porta dos PCs.', 'Vendas na VLAN 10 e financeiro na VLAN 20, por exemplo. As duas portas de um mesmo setor devem ficar na mesma VLAN.'],
    topologia: montar({ disp: [['switch', 450, 130], ['pc', 110, 340], ['pc', 330, 340], ['pc', 570, 340], ['pc', 790, 340]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw1', 'eth0', 'fa3'], ['pc4', 'sw1', 'eth0', 'fa4']],
      ips: [ip24('pc1', '192.168.1.1'), ip24('pc2', '192.168.1.2'), ip24('pc3', '192.168.1.3'), ip24('pc4', '192.168.1.4')] }) },
  { id: 'dois-andares-mesmas-vlans', modulo: 'campus', titulo: 'Dois andares, as mesmas VLANs', dificuldade: 3, xp: 220,
    habilidades: ['ethernet-comutacao.pratica'],
    cenario: 'O térreo (SW1) e o primeiro andar (SW2) têm vendas e financeiro cada um. Os setores devem ficar isolados entre si, mas vendas do térreo precisa falar com vendas do andar de cima, e o mesmo vale para o financeiro. Tudo está na VLAN padrão.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc3' }, { id: 'o2', de: 'pc2', para: 'pc4' }, { id: 'o3', de: 'pc1', para: 'pc2', esperado: 'falha' }, { id: 'o4', de: 'pc3', para: 'pc4', esperado: 'falha' }],
    dicas: ['Vendas (PC1 e PC3) na VLAN 10 e financeiro (PC2 e PC4) na VLAN 20, nas portas dos PCs dos dois switches.', 'O cabo entre os switches precisa levar as duas VLANs ao mesmo tempo. Use o modo trunk nos dois lados.', 'Sem o trunk, os setores ficam isolados também entre os andares.'],
    topologia: montar({ disp: [['switch', 220, 150], ['switch', 680, 150], ['pc', 110, 360], ['pc', 330, 360], ['pc', 570, 360], ['pc', 790, 360]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw2', 'eth0', 'fa1'], ['pc4', 'sw2', 'eth0', 'fa2'], ['sw1', 'sw2', 'fa8', 'fa8']],
      ips: [ip24('pc1', '192.168.1.1'), ip24('pc2', '192.168.1.2'), ip24('pc3', '192.168.1.3'), ip24('pc4', '192.168.1.4')] }) }
];

// Ordem de aprendizagem dentro de cada módulo
const ordem = ['primeira-rede', 'cabo-esquecido', 'ip-duplicado', 'mascara-errada', 'gateway-errado', 'interface-sem-ip', 'duas-redes-um-roteador',
  'rota-so-de-ida', 'rota-padrao', 'rotas-estaticas',
  'setores-separados', 'porta-na-vlan-errada', 'trunk-esquecido', 'vlans-sem-gateway', 'dois-andares-mesmas-vlans', 'campus-completo'];
const ids = new Set(praticas.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...praticas];
const pos = m => (ordem.includes(m.id) ? ordem.indexOf(m.id) : ordem.length);
const saida = todas.map((m, i) => ({ m, i })).sort((a, b) => pos(a.m) - pos(b.m) || a.i - b.i).map(x => x.m);
writeFileSync(destino, JSON.stringify(saida, null, 2) + '\n');
console.log(`${praticas.length} missões de prática gravadas (${saida.length} no total).`);
