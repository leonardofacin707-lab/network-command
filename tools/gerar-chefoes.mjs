// Acrescenta 2 missões de DIAGNÓSTICO com vários defeitos ao mesmo tempo (roteamento, DHCP, filtro e gateway).
// Idempotente (substitui as de mesmo id).
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, configurarDhcpPc, configurarPoolDhcp, adicionarRotaEstatica, adicionarFiltro } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };
const montar = ({ disp, cabos, ips = [], gws = {}, dhcp = [], pools = [], rotas = [], filtros = [] }) => {
  let t = topologiaVazia();
  for (const [tipo, x, y] of disp) t = ok(adicionarDispositivo(t, tipo, { x, y }));
  for (const [a, b, pa, pb] of cabos) t = ok(conectar(t, a, b, pa, pb));
  for (const [id, p, ip, m] of ips) t = ok(configurarInterface(t, id, p, { ip, mascara: m }));
  for (const [id, gw] of Object.entries(gws)) t = ok(configurarGateway(t, id, gw));
  for (const id of dhcp) t = ok(configurarDhcpPc(t, id, true));
  for (const [id, porta, inicio, fim] of pools) t = ok(configurarPoolDhcp(t, id, porta, { inicio, fim }));
  for (const [id, rede, mascara, via] of rotas) t = ok(adicionarRotaEstatica(t, id, { rede, mascara, via }));
  for (const [id, acao, origem, origemM, dest, destM] of filtros) t = ok(adicionarFiltro(t, id, { acao, origem, origemM, destino: dest, destinoM: destM }));
  return t;
};
const obj = lista => lista.map(([de, para], i) => ({ id: `o${i + 1}`, de, para }));

const missoes = [
  { id: 'filial-fora-do-ar', modulo: 'missoes', titulo: 'Filial fora do ar: três defeitos', dificuldade: 3, xp: 320,
    habilidades: ['troubleshooting.diagnostico', 'roteamento.diagnostico', 'servicos.diagnostico'],
    cenario: 'A matriz (192.168.1.0/24) acabou de ser ligada à filial (172.16.0.0/24) por dois roteadores. Os computadores da filial pedem endereço automático. Nada funciona e há mais de um defeito. Descubra, um por vez, com o terminal.',
    objetivos: obj([['pc1', 'pc2'], ['pc2', 'pc1'], ['pc1', 'pc3']]),
    dicas: ['Comece pelo que está mais perto: ipconfig no PC1 e nos PCs da filial. Quem tem endereço e quem não tem?', 'Os computadores da filial não recebem IP: falta o pool no roteador deles. Há ainda um problema no gateway do PC1 e uma rota que falta em um dos roteadores.', 'Gateway do PC1: é o IP do R1 na rede da matriz (192.168.1.1). Pool: faixa de 172.16.0.x na interface Gi1 do R2. Rota: o R2 precisa chegar à rede 192.168.1.0/24 pelo R1 (10.0.0.1).'],
    topologia: montar({
      disp: [['pc', 70, 230], ['roteador', 270, 230], ['roteador', 520, 230], ['switch', 690, 230], ['pc', 810, 110], ['pc', 810, 350]],
      cabos: [['pc1', 'r1', 'eth0', 'gi0'], ['r1', 'r2', 'gi1', 'gi0'], ['r2', 'sw1', 'gi1', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['pc3', 'sw1', 'eth0', 'fa3']],
      ips: [['pc1', 'eth0', '192.168.1.10', '/24'], ['r1', 'gi0', '192.168.1.1', '/24'], ['r1', 'gi1', '10.0.0.1', '/30'], ['r2', 'gi0', '10.0.0.2', '/30'], ['r2', 'gi1', '172.16.0.1', '/24']],
      gws: { pc1: '192.168.1.254' }, dhcp: ['pc2', 'pc3'], rotas: [['r1', '172.16.0.0', '/24', '10.0.0.2']] }) },
  { id: 'dois-sites-quatro-defeitos', modulo: 'missoes', titulo: 'Dois sites, quatro defeitos', dificuldade: 3, xp: 380,
    habilidades: ['troubleshooting.diagnostico', 'seguranca.diagnostico', 'servicos.diagnostico', 'roteamento.diagnostico'],
    cenario: 'A matriz tem dois computadores em DHCP e fala com o servidor da filial por dois roteadores. Alguém mexeu em tudo: um pool, uma rota, um filtro de pacotes e o gateway do servidor. Há defeitos de camadas diferentes, e consertar um revela o próximo.',
    objetivos: obj([['pc1', 'pc3'], ['pc2', 'pc3'], ['pc3', 'pc1']]),
    dicas: ['Use ipconfig nos PCs da matriz: um deles não recebe endereço. Depois use ping e tracert a partir do PC1 até o servidor (PC3).', 'Defeitos: o pool do R1 tem um único endereço para dois computadores; a rota do R1 para a filial aponta para um próximo salto que não existe; o R2 tem um filtro que nega a volta para a matriz; e o servidor (PC3) está com o gateway errado (o certo é o IP do R2 na filial).', 'Próximo salto certo da rota: o IP do R2 na rede entre os roteadores (10.0.0.2). Para o filtro, lembre-se de que ele não guarda estado: a resposta do servidor também é bloqueada.'],
    topologia: montar({
      disp: [['pc', 60, 110], ['pc', 60, 350], ['switch', 190, 230], ['roteador', 380, 230], ['roteador', 600, 230], ['pc', 810, 230]],
      cabos: [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['sw1', 'r1', 'fa3', 'gi0'], ['r1', 'r2', 'gi1', 'gi0'], ['r2', 'pc3', 'gi1', 'eth0']],
      ips: [['r1', 'gi0', '192.168.1.1', '/24'], ['r1', 'gi1', '10.0.0.1', '/29'], ['r2', 'gi0', '10.0.0.2', '/29'], ['r2', 'gi1', '172.16.0.1', '/24'], ['pc3', 'eth0', '172.16.0.10', '/24']],
      gws: { pc3: '172.16.0.254' }, dhcp: ['pc1', 'pc2'], pools: [['r1', 'gi0', '192.168.1.100', '192.168.1.100']],
      rotas: [['r1', '172.16.0.0', '/24', '10.0.0.3'], ['r2', '192.168.1.0', '/24', '10.0.0.1']],
      filtros: [['r2', 'negar', '172.16.0.0', '/24', '192.168.1.0', '/24']] }) }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de diagnóstico geradas (${todas.length} no total).`);
