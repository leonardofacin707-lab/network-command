// Acrescenta 3 missões de OSPF em data/missions.json (configurar do zero, área errada e wildcard errada). Idempotente.
// Rede: PC1 — R1 — R2 — R3 — PC2, enlaces /30 entre os roteadores.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, renomear, configurarInterface, configurarGateway, adicionarNetworkOspf } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

function rede(networks = {}) {
  let t = topologiaVazia();
  const add = (tipo, nome, x, y) => { t = ok(adicionarDispositivo(t, tipo, { x, y })); const id = t.dispositivos.at(-1).id; t = ok(renomear(t, id, nome)); return id; };
  const p1 = add('pc', 'PC1', 70, 230), r1 = add('roteador', 'R1', 250, 230), r2 = add('roteador', 'R2', 450, 230), r3 = add('roteador', 'R3', 650, 230), p2 = add('pc', 'PC2', 830, 230);
  t = ok(conectar(t, p1, r1, 'eth0', 'gi0')); t = ok(conectar(t, r1, r2, 'gi1', 'gi0')); t = ok(conectar(t, r2, r3, 'gi1', 'gi0')); t = ok(conectar(t, r3, p2, 'gi1', 'eth0'));
  const i = (d, p, x, m) => { t = ok(configurarInterface(t, d, p, { ip: x, mascara: m })); };
  i(p1, 'eth0', '192.168.1.10', '/24'); i(r1, 'gi0', '192.168.1.1', '/24'); i(r1, 'gi1', '10.0.12.1', '/30'); i(r2, 'gi0', '10.0.12.2', '/30');
  i(r2, 'gi1', '10.0.23.1', '/30'); i(r3, 'gi0', '10.0.23.2', '/30'); i(r3, 'gi1', '192.168.3.1', '/24'); i(p2, 'eth0', '192.168.3.10', '/24');
  t = ok(configurarGateway(t, p1, '192.168.1.1')); t = ok(configurarGateway(t, p2, '192.168.3.1'));
  const ids = { r1, r2, r3 };
  for (const [r, lista] of Object.entries(networks)) for (const [rede, wildcard, area] of lista) t = ok(adicionarNetworkOspf(t, ids[r], { rede, wildcard, area: String(area) }));
  return { t, p1, p2, r1, r2, r3 };
}
const certos = {
  r1: [['192.168.1.0', '0.0.0.255', 0], ['10.0.12.0', '0.0.0.3', 0]],
  r2: [['10.0.12.0', '0.0.0.3', 0], ['10.0.23.0', '0.0.0.3', 0]],
  r3: [['10.0.23.0', '0.0.0.3', 0], ['192.168.3.0', '0.0.0.255', 0]]
};
const a = rede();
const b = rede({ ...certos, r2: [['10.0.12.0', '0.0.0.3', 1], ['10.0.23.0', '0.0.0.3', 0]] });
const c = rede({ ...certos, r3: [['10.0.23.0', '0.0.0.3', 0], ['192.168.3.0', '255.255.255.0', 0]] });
const ida = (x) => [{ id: 'o1', de: x.p1, para: x.p2 }, { id: 'o2', de: x.p2, para: x.p1 }];

const missoes = [
  { id: 'ospf-tres-roteadores', modulo: 'missoes', titulo: 'OSPF em três roteadores', dificuldade: 3, xp: 320, habilidades: ['roteamento.pratica'],
    cenario: 'PC1 (192.168.1.0/24) e PC2 (192.168.3.0/24) estão separados por três roteadores ligados por enlaces /30. Em vez de rotas estáticas, a empresa quer roteamento dinâmico: configure o OSPF (área 0) nos três.',
    objetivos: [...ida(a), ...['r1', 'r2', 'r3'].map((r, i) => ({ id: `s${i + 1}`, tipo: 'sem-rotas-estaticas', roteador: a[r] }))],
    dicas: ['No OSPF, cada roteador anuncia as redes das interfaces que entram no processo. O comando é network REDE WILDCARD area 0. A wildcard é o inverso da máscara: /24 vira 0.0.0.255 e /30 vira 0.0.0.3.', 'R1: network 192.168.1.0 0.0.0.255 area 0 e network 10.0.12.0 0.0.0.3 area 0. Faça o mesmo raciocínio no R2 (os dois enlaces) e no R3.', 'Confira com show ip ospf neighbor (vizinhos em FULL) e show ip route (rotas marcadas com O) no console de cada roteador.'],
    topologia: a.t },
  { id: 'ospf-area-errada', modulo: 'missoes', titulo: 'Vizinhos que não se falam', dificuldade: 3, xp: 240, habilidades: ['roteamento.diagnostico'],
    cenario: 'O OSPF está configurado nos três roteadores, mas PC1 e PC2 não se alcançam. O R2 vê o R3 como vizinho, mas não vê o R1.',
    objetivos: ida(b),
    dicas: ['No console do R1 e do R2, rode show ip ospf neighbor. O estado da vizinhança entre eles diz o motivo.', 'Dois roteadores só formam vizinhança se a interface do enlace estiver na mesma área nos dois lados. Compare os comandos network do enlace 10.0.12.0/30.', 'No R2, o enlace com o R1 está na área 1. Remova esse network e crie de novo com area 0 (no console: router ospf 1, no network 10.0.12.0 0.0.0.3 area 1, network 10.0.12.0 0.0.0.3 area 0).'],
    topologia: b.t },
  { id: 'ospf-wildcard-errada', modulo: 'missoes', titulo: 'A máscara no lugar da wildcard', dificuldade: 3, xp: 240, habilidades: ['roteamento.diagnostico'],
    cenario: 'Os três roteadores são vizinhos em FULL, mas a rede do PC2 (192.168.3.0/24) não aparece nas tabelas do R1 e do R2.',
    objetivos: ida(c),
    dicas: ['Rode show ip route no R1: há rota O para 10.0.23.0, mas não para 192.168.3.0. Então o R3 não está anunciando a LAN dele.', 'Olhe os comandos network do R3. O segundo usa 255.255.255.0, que é uma máscara. O comando network espera uma wildcard, que é o inverso.', 'No R3, troque por network 192.168.3.0 0.0.0.255 area 0.'],
    topologia: c.t }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de OSPF gravadas (${todas.length} no total).`);
