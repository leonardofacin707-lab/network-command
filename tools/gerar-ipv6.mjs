// Acrescenta 5 missões de IPv6 em data/missions.json (endereços, roteamento, SLAAC, prefixo errado e rotas estáticas).
// Idempotente (substitui as de mesmo id). Os objetivos usam ping IPv6 (ida e volta) no motor.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, renomear, configurarInterface6, configurarGateway6, configurarSlaac,
  configurarRoteamento6 } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

function montar() {
  let t = topologiaVazia();
  return {
    add(tipo, nome, x, y) { t = ok(adicionarDispositivo(t, tipo, { x, y })); const id = t.dispositivos.at(-1).id; t = ok(renomear(t, id, nome)); return id; },
    liga(a, pa, b, pb) { t = ok(conectar(t, a, b, pa, pb)); },
    ip6(id, p, e) { t = ok(configurarInterface6(t, id, p, { ip6: e })); },
    gw6(id, g) { t = ok(configurarGateway6(t, id, g)); },
    slaac(id) { t = ok(configurarSlaac(t, id, true)); },
    roteia(id) { t = ok(configurarRoteamento6(t, id, true)); },
    get t() { return t; }
  };
}
const v6 = (id, de, para) => ({ id, de, para, ipv6: true });

// 1) Primeiros passos: três PCs no mesmo switch, sem IPv6.
const a = montar();
const a1 = a.add('pc', 'PC1', 140, 120), a2 = a.add('pc', 'PC2', 140, 340), aSw = a.add('switch', 'SW1', 420, 230), a3 = a.add('pc', 'PC3', 700, 230);
a.liga(a1, 'eth0', aSw, 'fa1'); a.liga(a2, 'eth0', aSw, 'fa2'); a.liga(a3, 'eth0', aSw, 'fa3');

// Duas LANs IPv6 com um roteador: base das missões 2, 3 e 4.
function duasLans({ roteia = true, gi0 = '2001:db8:1::1/64', clientes = 'fixo' } = {}) {
  const m = montar();
  const p1 = m.add('pc', 'Cliente1', 90, 130), p2 = m.add('pc', 'Cliente2', 90, 340), sw = m.add('switch', 'SW1', 270, 230);
  const r = m.add('roteador', 'R1', 470, 230), srv = m.add('pc', 'Servidor', 740, 230);
  m.liga(p1, 'eth0', sw, 'fa1'); m.liga(p2, 'eth0', sw, 'fa2'); m.liga(sw, 'fa3', r, 'gi0'); m.liga(r, 'gi1', srv, 'eth0');
  if (gi0) m.ip6(r, 'gi0', gi0);
  m.ip6(r, 'gi1', '2001:db8:2::1/64'); m.ip6(srv, 'eth0', '2001:db8:2::10/64'); m.gw6(srv, '2001:db8:2::1');
  if (roteia) m.roteia(r);
  if (clientes === 'slaac') { m.slaac(p1); m.slaac(p2); }
  else if (clientes === 'fixo') { m.ip6(p1, 'eth0', '2001:db8:1::10/64'); m.gw6(p1, '2001:db8:1::1'); m.ip6(p2, 'eth0', '2001:db8:1::20/64'); m.gw6(p2, '2001:db8:1::1'); }
  else if (clientes === 'erro') { m.ip6(p1, 'eth0', '2001:db8:1::10/64'); m.gw6(p1, '2001:db8:1::1'); m.ip6(p2, 'eth0', '2001:db8:11::20/64'); m.gw6(p2, '2001:db8:1::1'); }
  return { t: m.t, p1, p2, srv };
}
const b = duasLans({ roteia: false });
const c = duasLans({ gi0: null, clientes: 'slaac' });
const d = duasLans({ clientes: 'erro' });

// 5) Dois roteadores: falta a rota IPv6 nos dois sentidos.
const e = montar();
const e1 = e.add('pc', 'PC1', 90, 230), eR1 = e.add('roteador', 'R1', 300, 230), eR2 = e.add('roteador', 'R2', 560, 230), e2 = e.add('pc', 'PC2', 780, 230);
e.liga(e1, 'eth0', eR1, 'gi0'); e.liga(eR1, 'gi1', eR2, 'gi0'); e.liga(eR2, 'gi1', e2, 'eth0');
e.ip6(eR1, 'gi0', '2001:db8:a::1/64'); e.ip6(eR1, 'gi1', '2001:db8:ff::1/64'); e.ip6(eR2, 'gi0', '2001:db8:ff::2/64'); e.ip6(eR2, 'gi1', '2001:db8:b::1/64');
e.roteia(eR1); e.roteia(eR2);
e.ip6(e1, 'eth0', '2001:db8:a::10/64'); e.gw6(e1, '2001:db8:a::1'); e.ip6(e2, 'eth0', '2001:db8:b::10/64'); e.gw6(e2, '2001:db8:b::1');

const missoes = [
  { id: 'ipv6-primeiros-passos', modulo: 'missoes', titulo: 'Primeiros passos no IPv6', dificuldade: 1, xp: 160, habilidades: ['ip.pratica'],
    cenario: 'Três computadores no mesmo switch precisam conversar por IPv6. Cada um já tem um endereço link-local (fe80::) automático, mas a empresa quer endereços globais na rede 2001:db8:1::/64.',
    objetivos: [v6('o1', a1, a2), v6('o2', a1, a3), v6('o3', a2, a3)],
    dicas: ['Selecione cada PC e preencha o endereço IPv6 e o prefixo no quadro IPv6. Todos precisam estar no mesmo prefixo /64.', 'Por exemplo: PC1 2001:db8:1::10, PC2 2001:db8:1::20 e PC3 2001:db8:1::30, todos com prefixo 64. Na mesma rede não é preciso gateway.', 'Teste no terminal com ping 2001:db8:1::20. Rode ipconfig para ver também o endereço link-local, criado a partir do MAC (EUI-64).'],
    topologia: a.t },
  { id: 'ipv6-roteador-nao-roteia', modulo: 'missoes', titulo: 'O roteador que esqueceu o IPv6', dificuldade: 2, xp: 180, habilidades: ['ip.diagnostico', 'roteamento.diagnostico'],
    cenario: 'Os clientes da rede 2001:db8:1::/64 não alcançam o Servidor (2001:db8:2::10). Os endereços e os gateways estão certos, e do próprio R1 o ping para o servidor funciona.',
    objetivos: [v6('o1', b.p1, b.srv), v6('o2', b.p2, b.srv)],
    dicas: ['O ping do Cliente1 até 2001:db8:1::1 (o R1) funciona? E até o servidor? O pacote chega ao R1 e some ali.', 'No Cisco IOS, um roteador só encaminha IPv6 com o comando global "ipv6 unicast-routing". Abra o console do R1 e rode show ipv6 interface brief.', 'No R1: marque "Rotear IPv6" no painel, ou no console: en, conf t, ipv6 unicast-routing.'],
    topologia: b.t },
  { id: 'ipv6-slaac', modulo: 'missoes', titulo: 'Endereço sozinho com SLAAC', dificuldade: 2, xp: 220, habilidades: ['ip.pratica', 'servicos.pratica'],
    cenario: 'Os clientes estão configurados para SLAAC: montam o próprio endereço com o prefixo que o roteador anuncia. Mas o ipconfig mostra só o link-local. O R1 já roteia IPv6 e a interface do lado do servidor está pronta.',
    objetivos: [v6('o1', c.p1, c.srv), v6('o2', c.p2, c.srv)],
    dicas: ['Rode ipconfig no Cliente1: ele diz que nenhum roteador anunciou um prefixo. Olhe a interface Gi0/0 do R1, a que liga ao switch dos clientes.', 'O R1 só anuncia o prefixo (Router Advertisement) numa interface que tem endereço IPv6 global, e o SLAAC só funciona com prefixo /64.', 'Dê ao R1, na Gi0/0, o endereço 2001:db8:1::1 com prefixo 64 (ou no console: interface g0/0, ipv6 address 2001:db8:1::1/64). Os clientes se configuram sozinhos.'],
    topologia: c.t },
  { id: 'ipv6-prefixo-errado', modulo: 'missoes', titulo: 'Um dígito a mais no prefixo', dificuldade: 2, xp: 170, habilidades: ['ip.diagnostico'],
    cenario: 'O Cliente1 alcança o Servidor (2001:db8:2::10) por IPv6, mas o Cliente2, configurado à mão ontem, não. O gateway dele é 2001:db8:1::1, igual ao do Cliente1.',
    objetivos: [v6('o1', d.p1, d.srv), v6('o2', d.p2, d.srv)],
    dicas: ['Compare o ipconfig dos dois clientes. O ping do Cliente2 diz "falha geral": o gateway está fora da rede dele.', 'O endereço do Cliente2 é 2001:db8:11::20. Com /64, a rede dele é 2001:db8:11::/64, não 2001:db8:1::/64.', 'Corrija o endereço do Cliente2 para 2001:db8:1::20, prefixo 64.'],
    topologia: d.t },
  { id: 'ipv6-rotas-estaticas', modulo: 'missoes', titulo: 'Rotas IPv6 entre dois roteadores', dificuldade: 3, xp: 260, habilidades: ['roteamento.pratica', 'ip.pratica'],
    cenario: 'PC1 (2001:db8:a::10) e PC2 (2001:db8:b::10) ficam em redes ligadas por R1 e R2 pelo enlace 2001:db8:ff::/64. Os dois roteadores já roteiam IPv6, mas cada um só conhece as redes ligadas a ele.',
    objetivos: [v6('o1', e1, e2), v6('o2', e2, e1)],
    dicas: ['Rode show ipv6 route no console do R1: falta a rede 2001:db8:b::/64. No R2 falta a 2001:db8:a::/64.', 'Uma rota IPv6 aponta para o endereço do roteador vizinho no enlace: do R1, o próximo salto é 2001:db8:ff::2; do R2, é 2001:db8:ff::1.', 'R1: ipv6 route 2001:db8:b::/64 2001:db8:ff::2. R2: ipv6 route 2001:db8:a::/64 2001:db8:ff::1 (ou uma rota padrão ::/0).'],
    topologia: e.t }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de IPv6 gravadas (${todas.length} no total).`);
