// Fecha a árvore de habilidades: 1 missão de diagnóstico de Fundamentos e o "chefão" de Troubleshooting (cinco camadas).
// Idempotente (substitui as de mesmo id).
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, configurarDhcpPc, configurarPoolDhcp, adicionarRotaEstatica, adicionarFiltro, adicionarRegistroDns, renomear } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };
const dispositivos = (t, lista) => lista.reduce((acc, [tipo, x, y]) => ok(adicionarDispositivo(acc, tipo, { x, y })), t);
const cabos = (t, lista) => lista.reduce((acc, [a, b, pa, pb]) => ok(conectar(acc, a, b, pa, pb)), t);
const ips = (t, lista) => lista.reduce((acc, [id, p, ip, m]) => ok(configurarInterface(acc, id, p, { ip, mascara: m })), t);

// Fundamentos: dois switches que não se enxergam
let sw = dispositivos(topologiaVazia(), [['pc', 90, 110], ['pc', 90, 350], ['switch', 330, 230], ['switch', 600, 230], ['pc', 810, 230]]);
sw = cabos(sw, [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw2', 'eth0', 'fa1']]);
sw = ips(sw, [['pc1', 'eth0', '192.168.1.10', '/24'], ['pc2', 'eth0', '192.168.1.11', '/24'], ['pc3', 'eth0', '192.168.1.12', '/24']]);

// Chefão: Cliente1 e Cliente2 (DHCP) na matriz; Dns e Web na filial. Cinco defeitos em camadas diferentes.
let c = dispositivos(topologiaVazia(), [['pc', 60, 110], ['pc', 60, 350], ['switch', 200, 230], ['roteador', 360, 230], ['roteador', 560, 230], ['switch', 700, 230], ['pc', 830, 110], ['pc', 830, 350]]);
c = ok(renomear(c, 'pc1', 'Cliente1')); c = ok(renomear(c, 'pc2', 'Cliente2')); c = ok(renomear(c, 'pc3', 'Dns')); c = ok(renomear(c, 'pc4', 'Web'));
c = cabos(c, [['pc1', 'sw1', 'eth0', 'fa1'], /* Cliente2 sem cabo */ ['sw1', 'r1', 'fa3', 'gi0'], ['r1', 'r2', 'gi1', 'gi0'], ['r2', 'sw2', 'gi1', 'fa1'], ['pc3', 'sw2', 'eth0', 'fa2'], ['pc4', 'sw2', 'eth0', 'fa3']]);
c = ips(c, [['r1', 'gi0', '192.168.1.1', '/24'], ['r1', 'gi1', '10.0.0.1', '/30'], ['r2', 'gi0', '10.0.0.2', '/30'], ['r2', 'gi1', '172.16.0.1', '/24'], ['pc3', 'eth0', '172.16.0.10', '/24'], ['pc4', 'eth0', '172.16.0.20', '/24']]);
c = ok(configurarGateway(c, 'pc3', '172.16.0.1')); c = ok(configurarGateway(c, 'pc4', '172.16.0.1'));
c = ok(configurarDhcpPc(c, 'pc1', true)); c = ok(configurarDhcpPc(c, 'pc2', true));
c = ok(adicionarRotaEstatica(c, 'r2', { rede: '192.168.1.0', mascara: '/24', via: '10.0.0.1' }));
c = ok(adicionarFiltro(c, 'r2', { acao: 'negar', origem: '172.16.0.0', origemM: '/24', destino: '192.168.1.0', destinoM: '/24' }));
c = ok(adicionarRegistroDns(c, 'pc3', { nome: 'intranet.empresa.local', ip: '172.16.0.20' }));

const missoes = [
  { id: 'dois-switches', modulo: 'missoes', titulo: 'Dois switches, uma rede só', dificuldade: 1, xp: 120, habilidades: ['fundamentos.diagnostico'],
    cenario: 'Três computadores da mesma sala usam endereços da mesma rede, mas só dois deles se falam. O terceiro está ligado a outro switch, que não está conectado ao primeiro.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc1', para: 'pc3' }, { id: 'o3', de: 'pc3', para: 'pc2' }],
    dicas: ['Os endereços estão certos: todos são 192.168.1.x com a mesma máscara. Então o problema não está na configuração, está na ligação física.', 'Veja a que switch cada computador está ligado. Um switch só encaminha para o que está nele, a não ser que esteja ligado a outro.', 'Use o modo Conectar cabo para ligar o SW1 ao SW2 (ou mova o PC3 para o SW1).'],
    topologia: sw },
  { id: 'chefao-cinco-camadas', modulo: 'missoes', titulo: 'O chefão: cinco defeitos, cinco camadas', dificuldade: 3, xp: 450,
    habilidades: ['troubleshooting.pratica', 'troubleshooting.diagnostico', 'roteamento.diagnostico', 'servicos.diagnostico'],
    cenario: 'Os dois clientes da matriz precisam abrir a intranet (intranet.empresa.local) que fica na filial. O DNS e o servidor Web estão na filial, atrás de dois roteadores. Nada funciona e os defeitos estão em camadas diferentes: siga o método de baixo para cima (cabo, endereço, rota, regra de acesso e nome) e corrija um por vez.',
    objetivos: [{ id: 'o1', de: 'pc1', nome: 'intranet.empresa.local' }, { id: 'o2', de: 'pc2', nome: 'intranet.empresa.local' }],
    dicas: ['Comece pelo mais baixo: o Cliente2 está com algum cabo? E os clientes têm endereço (ipconfig)? Em DHCP, quem entrega o endereço é o roteador da matriz.', 'Com endereço, teste o ping até o Dns (172.16.0.10) e use tracert para ver onde para. Há uma rota faltando no R1 e uma regra de filtro que derruba a resposta no R2.', 'Por último, o nome: o DHCP simplificado não entrega o servidor DNS, então configure nos dois clientes o IP do computador Dns. Resumo: cabo do Cliente2, pool no R1 (192.168.1.x), rota do R1 para 172.16.0.0/24 via 10.0.0.2, remover o filtro do R2 e DNS 172.16.0.10 nos clientes.'],
    topologia: c }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões gravadas (${todas.length} no total).`);
