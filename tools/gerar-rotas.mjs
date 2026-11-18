// Acrescenta 3 missões de ROTAS ESTÁTICAS (1 de diagnóstico e 2 de prática) em data/missions.json.
// Idempotente: substitui as de mesmo id e mantém a ordem de aprendizagem definida em gerar-praticas.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, adicionarRotaEstatica } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

/** pc1 - r1 - r2 - pc2 (cabos diretos). cfg: { lan1, r1gi0, link1, link2, r2gi1, lan2, gw1, gw2 } e rotas: [[roteador, rede, mascara, via]] */
function cenario({ ips, gws, rotas = [] }) {
  let t = topologiaVazia();
  for (const [tipo, x, y] of [['pc', 90, 260], ['roteador', 300, 260], ['roteador', 600, 260], ['pc', 810, 260]]) t = ok(adicionarDispositivo(t, tipo, { x, y }));
  for (const [a, b, pa, pb] of [['pc1', 'r1', 'eth0', 'gi0'], ['r1', 'r2', 'gi1', 'gi0'], ['r2', 'pc2', 'gi1', 'eth0']]) t = ok(conectar(t, a, b, pa, pb));
  for (const [id, p, ip, m] of ips) t = ok(configurarInterface(t, id, p, { ip, mascara: m }));
  for (const [id, gw] of Object.entries(gws)) t = ok(configurarGateway(t, id, gw));
  for (const [id, rede, mascara, via] of rotas) t = ok(adicionarRotaEstatica(t, id, { rede, mascara, via }));
  return t;
}
const ipsA = [['pc1', 'eth0', '192.168.1.10', '/24'], ['r1', 'gi0', '192.168.1.1', '/24'], ['r1', 'gi1', '10.0.0.1', '/30'], ['r2', 'gi0', '10.0.0.2', '/30'], ['r2', 'gi1', '172.16.0.1', '/24'], ['pc2', 'eth0', '172.16.0.10', '/24']];
const gwsA = { pc1: '192.168.1.1', pc2: '172.16.0.1' };
const ipsB = [['pc1', 'eth0', '192.168.1.10', '/24'], ['r1', 'gi0', '192.168.1.1', '/24'], ['r1', 'gi1', '203.0.113.1', '/30'], ['r2', 'gi0', '203.0.113.2', '/30'], ['r2', 'gi1', '8.8.8.1', '/24'], ['pc2', 'eth0', '8.8.8.8', '/24']];
const gwsB = { pc1: '192.168.1.1', pc2: '8.8.8.1' };
const ida = [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc2', para: 'pc1' }];

const rotas = [
  { id: 'rota-so-de-ida', modulo: 'missoes', titulo: 'A rota que só vai', dificuldade: 2, xp: 200, habilidades: ['roteamento.diagnostico'],
    cenario: 'Dois roteadores ligam a matriz (192.168.1.0/24) à filial (172.16.0.0/24). O R1 já sabe chegar à filial, mas o PC1 não recebe resposta nenhuma. O PC2 também não alcança a matriz.',
    objetivos: ida,
    dicas: ['Pelo PC1, o pacote até chega ao PC2 (veja o tracert), mas a resposta não volta. Um caminho de ida sem volta quase sempre é rota faltando no outro sentido.', 'Selecione o R2 e veja as rotas estáticas dele. Ele conhece a filial (rede ligada), mas não a rede 192.168.1.0/24.', 'No R2, acrescente a rota para 192.168.1.0 com máscara /24 e próximo salto 10.0.0.1 (a interface do R1 no enlace entre eles).'],
    topologia: cenario({ ips: ipsA, gws: gwsA, rotas: [['r1', '172.16.0.0', '/24', '10.0.0.2']] }) },
  { id: 'rotas-estaticas', modulo: 'missoes', titulo: 'Rotas estáticas, passo a passo', dificuldade: 3, xp: 280, habilidades: ['roteamento.pratica'],
    cenario: 'Matriz e filial têm roteadores novos, com endereços e gateways já configurados, mas sem nenhuma rota entre as redes remotas. Ensine cada roteador a chegar à rede do outro lado.',
    objetivos: ida,
    dicas: ['Cada roteador só conhece as redes ligadas diretamente a ele. Para chegar à rede do outro lado, ele precisa de uma rota estática.', 'O R1 precisa de uma rota para 172.16.0.0/24. O próximo salto é o endereço do R2 no enlace entre os dois roteadores.', 'O R2 precisa do caminho de volta: rota para 192.168.1.0/24 com próximo salto no endereço do R1 no enlace. Sem a volta, o ping não fecha.'],
    topologia: cenario({ ips: ipsA, gws: gwsA }) },
  { id: 'rota-padrao', modulo: 'missoes', titulo: 'Rota padrão para a Internet', dificuldade: 2, xp: 220, habilidades: ['roteamento.pratica'],
    cenario: 'O roteador da empresa (R1) está ligado ao roteador do provedor (R2). O provedor já conhece a rede da empresa. Falta ensinar o R1 a mandar para o provedor tudo o que não for da rede local, para alcançar o servidor 8.8.8.8.',
    objetivos: ida,
    dicas: ['Em vez de listar todas as redes da Internet, o R1 usa uma rota padrão: um destino que corresponde a qualquer endereço.', 'A rota padrão é a rede 0.0.0.0 com máscara /0 (ou 0.0.0.0). O próximo salto é o endereço do provedor (R2) no enlace entre os roteadores.'],
    topologia: cenario({ ips: ipsB, gws: gwsB, rotas: [['r2', '192.168.1.0', '/24', '203.0.113.1']] }) }
];

const ids = new Set(rotas.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...rotas];
const saida = ordenarMissoes(todas);
writeFileSync(destino, JSON.stringify(saida, null, 2) + '\n');
console.log(`${rotas.length} missões de rotas gravadas (${saida.length} no total).`);
