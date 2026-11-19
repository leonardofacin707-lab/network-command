// Acrescenta 3 missões de DHCP (2 de diagnóstico e 1 de prática) em data/missions.json. Idempotente (substitui as de mesmo id).
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, configurarDhcpPc, configurarPoolDhcp } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };
const add = (t, tipo, x, y) => ok(adicionarDispositivo(t, tipo, { x, y }));

/** Uma LAN: r1 - sw1 - N PCs em DHCP. pool: [inicio, fim] ou null. */
function lan({ n, pool }) {
  let t = topologiaVazia();
  t = add(t, 'roteador', 150, 230); t = add(t, 'switch', 400, 230);
  // PCs centralizados em y=230, com 120 de espaço (100 deixava as caixas se tocando)
  for (let i = 0; i < n; i++) t = add(t, 'pc', 680, 230 + (i - (n - 1) / 2) * 120);
  t = ok(conectar(t, 'r1', 'sw1', 'gi0', 'fa1'));
  for (let i = 1; i <= n; i++) { t = ok(conectar(t, `pc${i}`, 'sw1', 'eth0', `fa${i + 1}`)); t = ok(configurarDhcpPc(t, `pc${i}`, true)); }
  t = ok(configurarInterface(t, 'r1', 'gi0', { ip: '192.168.10.1', mascara: '/24' }));
  if (pool) t = ok(configurarPoolDhcp(t, 'r1', 'gi0', { inicio: pool[0], fim: pool[1] }));
  return t;
}
const pares = lista => lista.map(([a, b], i) => ({ id: `o${i + 1}`, de: a, para: b }));

/** Duas LANs ligadas por um roteador, todos os PCs em DHCP, sem nenhum pool. */
function duasLans() {
  let t = topologiaVazia();
  t = add(t, 'roteador', 400, 230);
  t = add(t, 'switch', 190, 230); t = add(t, 'switch', 610, 230);
  t = add(t, 'pc', 60, 100); t = add(t, 'pc', 60, 360); t = add(t, 'pc', 740, 100); t = add(t, 'pc', 740, 360);
  t = ok(conectar(t, 'r1', 'sw1', 'gi0', 'fa1')); t = ok(conectar(t, 'r1', 'sw2', 'gi1', 'fa1'));
  t = ok(conectar(t, 'pc1', 'sw1', 'eth0', 'fa2')); t = ok(conectar(t, 'pc2', 'sw1', 'eth0', 'fa3'));
  t = ok(conectar(t, 'pc3', 'sw2', 'eth0', 'fa2')); t = ok(conectar(t, 'pc4', 'sw2', 'eth0', 'fa3'));
  for (const pc of ['pc1', 'pc2', 'pc3', 'pc4']) t = ok(configurarDhcpPc(t, pc, true));
  t = ok(configurarInterface(t, 'r1', 'gi0', { ip: '192.168.10.1', mascara: '/24' }));
  t = ok(configurarInterface(t, 'r1', 'gi1', { ip: '192.168.20.1', mascara: '/24' }));
  return t;
}

const missoes = [
  { id: 'dhcp-sem-servidor', modulo: 'missoes', titulo: 'Ninguém recebe endereço', dificuldade: 1, xp: 120, habilidades: ['servicos.diagnostico'],
    cenario: 'Três computadores novos foram configurados para obter o endereço automaticamente (DHCP), mas nenhum consegue falar com os outros. O roteador já está com IP, mas não foi ligado como servidor DHCP.',
    objetivos: pares([['pc1', 'pc2'], ['pc2', 'pc3']]),
    dicas: ['Abra o terminal de um PC e rode ipconfig: sem endereço, ele não recebeu resposta de nenhum servidor DHCP. ipconfig /renew mostra o motivo.', 'Quem entrega endereços nesta rede é o roteador. Selecione o R1 e veja os campos de pool DHCP da interface Gi0.', 'Informe um pool dentro da rede 192.168.10.0/24, por exemplo do .100 ao .150, e use Aplicar.'],
    topologia: lan({ n: 3, pool: null }) },
  { id: 'dhcp-pool-curto', modulo: 'missoes', titulo: 'O pool que acabou', dificuldade: 2, xp: 160, habilidades: ['servicos.diagnostico'],
    cenario: 'O escritório recebeu um quarto computador. Os três primeiros funcionam, mas o último nunca consegue endereço. O servidor DHCP está ligado.',
    objetivos: pares([['pc1', 'pc4'], ['pc2', 'pc3'], ['pc3', 'pc4']]),
    dicas: ['Rode ipconfig no PC4 e compare com o dos outros: ele não recebeu IP e a mensagem diz o porquê.', 'Cada computador usa um endereço do pool. O pool atual tem só 3 endereços para 4 computadores.', 'Aumente o último endereço do pool do R1 (por exemplo, de .102 para .110).'],
    topologia: lan({ n: 4, pool: ['192.168.10.100', '192.168.10.102'] }) },
  { id: 'dhcp-duas-redes', modulo: 'missoes', titulo: 'DHCP para duas redes', dificuldade: 3, xp: 260, habilidades: ['servicos.pratica'],
    cenario: 'O roteador liga duas redes: 192.168.10.0/24 (PC1 e PC2) e 192.168.20.0/24 (PC3 e PC4). Todos os computadores pedem endereço automático, mas o roteador não tem nenhum pool. Configure o DHCP das duas redes para que todos se comuniquem, inclusive entre as redes.',
    objetivos: pares([['pc1', 'pc2'], ['pc3', 'pc4'], ['pc1', 'pc3'], ['pc2', 'pc4']]),
    dicas: ['Cada interface do roteador atende a sua própria rede, então cada uma precisa do seu pool.', 'O pool precisa estar dentro da rede da interface: 192.168.10.x na Gi0 e 192.168.20.x na Gi1.', 'O gateway e a máscara são entregues automaticamente a partir do IP da interface; por isso a comunicação entre as redes funciona sem mais configuração.'],
    topologia: duasLans() }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
const saida = ordenarMissoes(todas);
writeFileSync(destino, JSON.stringify(saida, null, 2) + '\n');
console.log(`${missoes.length} missões de DHCP gravadas (${todas.length} no total).`);
