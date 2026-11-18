// Acrescenta 3 missões de FILTRO DE PACOTES (ACL simplificada): 1 de prática e 2 de diagnóstico, para a trilha de Segurança.
// Idempotente (substitui as de mesmo id).
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, renomear, adicionarFiltro } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

/** Funcionario (.10) e Convidado (.20) na rede 192.168.1.0/24 via SW1; Servidor sozinho na 192.168.2.0/24. filtros: regras do R1 em ordem. */
function cenario(filtros = []) {
  let t = topologiaVazia();
  for (const [tipo, x, y] of [['pc', 90, 110], ['pc', 90, 350], ['pc', 810, 230], ['switch', 330, 230], ['roteador', 570, 230]]) t = ok(adicionarDispositivo(t, tipo, { x, y }));
  t = ok(renomear(t, 'pc1', 'Funcionario')); t = ok(renomear(t, 'pc2', 'Convidado')); t = ok(renomear(t, 'pc3', 'Servidor'));
  for (const [a, b, pa, pb] of [['pc1', 'sw1', 'eth0', 'fa1'], ['pc2', 'sw1', 'eth0', 'fa2'], ['sw1', 'r1', 'fa3', 'gi0'], ['pc3', 'r1', 'eth0', 'gi1']]) t = ok(conectar(t, a, b, pa, pb));
  for (const [id, p, ip] of [['pc1', 'eth0', '192.168.1.10'], ['pc2', 'eth0', '192.168.1.20'], ['r1', 'gi0', '192.168.1.1'], ['r1', 'gi1', '192.168.2.1'], ['pc3', 'eth0', '192.168.2.10']]) t = ok(configurarInterface(t, id, p, { ip, mascara: '/24' }));
  for (const [pc, gw] of [['pc1', '192.168.1.1'], ['pc2', '192.168.1.1'], ['pc3', '192.168.2.1']]) t = ok(configurarGateway(t, pc, gw));
  for (const [acao, origem, origemM, dest, destM] of filtros) t = ok(adicionarFiltro(t, 'r1', { acao, origem, origemM, destino: dest, destinoM: destM }));
  return t;
}
const obj = (...lista) => lista.map(([de, para, esperado], i) => ({ id: `o${i + 1}`, de, para, ...(esperado ? { esperado } : {}) }));

const missoes = [
  { id: 'filtro-convidado', modulo: 'missoes', titulo: 'O convidado não acessa o servidor', dificuldade: 2, xp: 260, habilidades: ['seguranca.pratica'],
    cenario: 'A rede 192.168.1.0/24 tem o computador de um funcionário (.10) e o de um convidado (.20). O servidor da empresa fica na rede 192.168.2.0/24, atrás do roteador, e hoje os dois alcançam o servidor. Bloqueie só o convidado, sem atrapalhar o funcionário.',
    objetivos: obj(['pc1', 'pc3'], ['pc2', 'pc3', 'falha'], ['pc1', 'pc2']),
    dicas: ['O roteador encaminha o tráfego entre as redes, então é lá que o bloqueio entra: selecione o R1 e use o Filtro de pacotes.', 'A regra é "negar" com origem 192.168.1.20 e máscara /32 (um único computador) e destino 192.168.2.0 com máscara /24.', 'Cuidado com a origem: negar a rede 192.168.1.0/24 inteira bloqueia também o funcionário.'],
    topologia: cenario() },
  { id: 'filtro-ordem', modulo: 'missoes', titulo: 'A regra que nunca vale', dificuldade: 3, xp: 240, habilidades: ['seguranca.diagnostico'],
    cenario: 'O administrador quis bloquear toda a rede 192.168.1.0/24 para o servidor, exceto o computador do funcionário (.10). Criou as duas regras, mas o funcionário continua sem acesso ao servidor.',
    objetivos: obj(['pc1', 'pc3'], ['pc2', 'pc3', 'falha'], ['pc1', 'pc2']),
    dicas: ['As regras são lidas de cima para baixo e vale a primeira que casa com o pacote. Veja a ordem das duas regras no R1.', 'A regra "negar a rede inteira" está na frente e já pega o pacote do funcionário, então a de "permitir" nunca é alcançada.', 'Suba a regra de permitir para a primeira posição (botão ↑) ou troque as duas de lugar.'],
    topologia: cenario([['negar', '192.168.1.0', '/24', '192.168.2.0', '/24'], ['permitir', '192.168.1.10', '/32', '192.168.2.10', '/32']]) },
  { id: 'filtro-resposta', modulo: 'missoes', titulo: 'A resposta que não volta', dificuldade: 3, xp: 220, habilidades: ['seguranca.diagnostico'],
    cenario: 'Para proteger a rede de funcionários, alguém criou uma regra negando tudo que vem do servidor (192.168.2.0/24) para a rede 192.168.1.0/24. Desde então, ninguém da rede 192.168.1.0/24 consegue falar com o servidor. Lembre: neste simulador o filtro não guarda estado, então ele não diferencia uma conexão nova de uma resposta.',
    objetivos: obj(['pc1', 'pc3'], ['pc2', 'pc3']),
    dicas: ['Use o terminal do Funcionario: o ping chega ao servidor (veja que o tracert passa pelo R1), mas a resposta não volta.', 'A resposta do servidor tem origem 192.168.2.10 e destino na rede 192.168.1.0/24, exatamente o que a regra nega.', 'Um filtro sem estado não consegue "permitir só respostas". Remova a regra: firewalls de verdade usam inspeção com estado para isso.'],
    topologia: cenario([['negar', '192.168.2.0', '/24', '192.168.1.0', '/24']]) }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
const saida = ordenarMissoes(todas);
writeFileSync(destino, JSON.stringify(saida, null, 2) + '\n');
console.log(`${missoes.length} missões de filtro gravadas (${saida.length} no total).`);
