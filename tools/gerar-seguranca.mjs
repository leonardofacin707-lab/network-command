// Acrescenta 5 missões da trilha de segurança em data/missions.json (ataque e defesa, filtro por protocolo e porta).
// Idempotente (substitui as de mesmo id). Os ataques são simplificados e isso é dito no cenário de cada missão.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, renomear, configurarPoolDhcp,
  configurarDhcpPc, configurarDnsPc, adicionarRegistroDns, configurarServicos, adicionarFiltro } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

/** Pequeno construtor: add(tipo, nome, x, y) devolve o id; liga, ip, gw e ajustes encadeados sobre a mesma topologia. */
function montar() {
  let t = topologiaVazia();
  const api = {
    add(tipo, nome, x, y) { t = ok(adicionarDispositivo(t, tipo, { x, y })); const id = t.dispositivos.at(-1).id; t = ok(renomear(t, id, nome)); return id; },
    liga(a, pa, b, pb) { t = ok(conectar(t, a, b, pa, pb)); },
    ip(id, p, ip, m = '/24') { t = ok(configurarInterface(t, id, p, { ip, mascara: m })); },
    gw(id, g) { t = ok(configurarGateway(t, id, g)); },
    faz(fn) { t = ok(fn(t)); },
    get t() { return t; }
  };
  return api;
}
const alcanca = (id, de, para, extra = {}) => ({ id, de, para, ...extra });

// 1) Servidor DHCP falso: um roteador desconhecido ligado no switch responde primeiro e entrega o gateway errado.
const a = montar();
const a1 = a.add('pc', 'Cliente1', 90, 130), a2 = a.add('pc', 'Cliente2', 90, 330);
const aSw = a.add('switch', 'SW1', 300, 230), aR = a.add('roteador', 'R1', 520, 230), aSrv = a.add('pc', 'Servidor', 780, 230);
const aX = a.add('roteador', 'Desconhecido', 300, 440);
a.liga(aX, 'gi0', aSw, 'fa1'); // ligado antes: responde primeiro
a.liga(a1, 'eth0', aSw, 'fa2'); a.liga(a2, 'eth0', aSw, 'fa3'); a.liga(aSw, 'fa4', aR, 'gi0'); a.liga(aR, 'gi1', aSrv, 'eth0');
a.ip(aR, 'gi0', '192.168.1.1'); a.ip(aR, 'gi1', '10.0.0.1'); a.ip(aSrv, 'eth0', '10.0.0.10'); a.gw(aSrv, '10.0.0.1');
a.ip(aX, 'gi0', '192.168.1.254');
a.faz(t => configurarPoolDhcp(t, aR, 'gi0', { inicio: '192.168.1.100', fim: '192.168.1.150' }));
a.faz(t => configurarPoolDhcp(t, aX, 'gi0', { inicio: '192.168.1.50', fim: '192.168.1.60' }));
for (const pc of [a1, a2]) a.faz(t => configurarDhcpPc(t, pc, true));

// 2) Gateway falso (simplificação de ARP spoofing): um notebook visitante usa o IP do gateway.
const b = montar();
const b1 = b.add('pc', 'Cliente1', 90, 130), b2 = b.add('pc', 'Cliente2', 90, 330);
const bSw = b.add('switch', 'SW1', 300, 230), bR = b.add('roteador', 'R1', 520, 230), bSrv = b.add('pc', 'Servidor', 780, 230);
const bX = b.add('pc', 'Visitante', 300, 440);
b.liga(b1, 'eth0', bSw, 'fa1'); b.liga(b2, 'eth0', bSw, 'fa2'); b.liga(bSw, 'fa3', bR, 'gi0'); b.liga(bR, 'gi1', bSrv, 'eth0'); b.liga(bX, 'eth0', bSw, 'fa4');
b.ip(b1, 'eth0', '192.168.1.10'); b.ip(b2, 'eth0', '192.168.1.11'); b.ip(bR, 'gi0', '192.168.1.1'); b.ip(bR, 'gi1', '10.0.0.1');
b.ip(bSrv, 'eth0', '10.0.0.10'); b.ip(bX, 'eth0', '192.168.1.1');
for (const pc of [b1, b2]) b.gw(pc, '192.168.1.1');
b.gw(bSrv, '10.0.0.1');

// 3) DNS falso: o Cliente1 foi configurado para usar um "servidor DNS" do atacante, que manda banco.local para um site falso.
const c = montar();
const c1 = c.add('pc', 'Cliente1', 90, 130), c2 = c.add('pc', 'Cliente2', 90, 330);
const cSw = c.add('switch', 'SW1', 380, 230), cDns = c.add('pc', 'Dns', 720, 70), cBanco = c.add('pc', 'Banco', 760, 230), cX = c.add('pc', 'Falso', 720, 400);
c.liga(c1, 'eth0', cSw, 'fa1'); c.liga(c2, 'eth0', cSw, 'fa2'); c.liga(cDns, 'eth0', cSw, 'fa3'); c.liga(cBanco, 'eth0', cSw, 'fa4'); c.liga(cX, 'eth0', cSw, 'fa5');
for (const [id, fim] of [[c1, 10], [c2, 11], [cDns, 50], [cBanco, 60], [cX, 66]]) c.ip(id, 'eth0', `192.168.1.${fim}`);
c.faz(t => adicionarRegistroDns(t, cDns, { nome: 'banco.local', ip: '192.168.1.60' }));
c.faz(t => adicionarRegistroDns(t, cX, { nome: 'banco.local', ip: '192.168.1.66' }));
c.faz(t => configurarServicos(t, cBanco, [443])); c.faz(t => configurarServicos(t, cX, [80, 443]));
c.faz(t => configurarDnsPc(t, c1, '192.168.1.66')); c.faz(t => configurarDnsPc(t, c2, '192.168.1.50'));

// Rede comum das duas missões de filtro: clientes 192.168.1.0/24 — R1 — servidores 10.0.0.0/24 (Servidor e Admin).
function redeServidores({ filtros = [] }) {
  const m = montar();
  const p1 = m.add('pc', 'Cliente1', 90, 130), p2 = m.add('pc', 'Cliente2', 90, 330);
  const sw1 = m.add('switch', 'SW1', 260, 230), r = m.add('roteador', 'R1', 450, 230), sw2 = m.add('switch', 'SW2', 630, 230);
  const srv = m.add('pc', 'Servidor', 820, 130), adm = m.add('pc', 'Admin', 820, 330);
  m.liga(p1, 'eth0', sw1, 'fa1'); m.liga(p2, 'eth0', sw1, 'fa2'); m.liga(sw1, 'fa3', r, 'gi0'); m.liga(r, 'gi1', sw2, 'fa1');
  m.liga(srv, 'eth0', sw2, 'fa2'); m.liga(adm, 'eth0', sw2, 'fa3');
  m.ip(p1, 'eth0', '192.168.1.10'); m.ip(p2, 'eth0', '192.168.1.11'); m.ip(r, 'gi0', '192.168.1.1'); m.ip(r, 'gi1', '10.0.0.1');
  m.ip(srv, 'eth0', '10.0.0.10'); m.ip(adm, 'eth0', '10.0.0.20');
  for (const pc of [p1, p2]) m.gw(pc, '192.168.1.1');
  for (const pc of [srv, adm]) m.gw(pc, '10.0.0.1');
  m.faz(t => configurarServicos(t, srv, [22, 23, 80]));
  for (const f of filtros) m.faz(t => adicionarFiltro(t, r, f));
  return { t: m.t, p1, p2, srv, adm };
}
const d = redeServidores({});
const e = redeServidores({ filtros: [{ acao: 'negar', origem: '192.168.1.0', origemM: '/24', destino: '10.0.0.10', destinoM: '/32' }] });

const SIMPLIFICACAO = ' (Simulação simplificada: veja as observações na dica final.)';
const missoes = [
  { id: 'seg-dhcp-falso', modulo: 'missoes', titulo: 'Quem está entregando esses endereços?', dificuldade: 2, xp: 200, habilidades: ['seguranca.diagnostico', 'servicos.diagnostico'],
    cenario: 'Desde ontem, os clientes da recepção não acessam o Servidor (10.0.0.10). Eles usam DHCP e o servidor oficial é o R1 (pool 192.168.1.100 a 150). Alguém ligou um equipamento desconhecido no switch.' + SIMPLIFICACAO,
    objetivos: [alcanca('o1', a1, aSrv), alcanca('o2', a2, aSrv), { id: 'o3', tipo: 'dhcp-de', pc: a1, roteador: aR }, { id: 'o4', tipo: 'dhcp-de', pc: a2, roteador: aR }],
    dicas: ['No Cliente1, rode ipconfig /all. Que endereço ele recebeu e quem é o "Servidor DHCP"? Compare com o pool oficial do R1.', 'O endereço veio de 192.168.1.254, o roteador Desconhecido: um servidor DHCP falso (rogue DHCP). Ele entrega como gateway ele mesmo, e o tráfego não chega ao servidor.', 'Desligue o cabo do Desconhecido (ou apague o pool dele). Na vida real, switches gerenciáveis têm o DHCP snooping, que só aceita ofertas DHCP pela porta do servidor confiável. Simplificação: aqui o servidor mais próximo no switch sempre responde primeiro.'],
    topologia: a.t },
  { id: 'seg-gateway-falso', modulo: 'missoes', titulo: 'Dois donos para o mesmo gateway', dificuldade: 2, xp: 200, habilidades: ['seguranca.diagnostico', 'ethernet-comutacao.diagnostico'],
    cenario: 'Os clientes perderam o acesso ao Servidor (10.0.0.10) logo depois que um visitante ligou o notebook na rede. Use a captura de pacotes do terminal para descobrir o que está acontecendo no ARP.' + SIMPLIFICACAO,
    objetivos: [alcanca('o1', b1, bSrv), alcanca('o2', b2, bSrv)],
    dicas: ['No terminal do Cliente1, marque "Capturar pacotes" e rode ping 10.0.0.10. Olhe as respostas ARP para "Quem tem 192.168.1.1?".', 'Chegam duas respostas com MACs diferentes: o R1 e o notebook Visitante, que está usando o IP do gateway. É a ideia do ARP spoofing: alguém se passar pelo gateway para receber o tráfego dos outros.', 'Desligue o cabo do Visitante ou tire o IP dele. Simplificação: num ataque real o atacante envia respostas ARP falsas sem precisar do mesmo IP, e o tráfego é desviado sem erro aparente; aqui o simulador mostra o conflito. Defesa real: inspeção dinâmica de ARP (DAI) nos switches.'],
    topologia: b.t },
  { id: 'seg-dns-falso', modulo: 'missoes', titulo: 'O banco que não é o banco', dificuldade: 2, xp: 200, habilidades: ['seguranca.diagnostico', 'servicos.diagnostico'],
    cenario: 'O Cliente1 abre banco.local normalmente, mas a página parece diferente da que o Cliente2 vê. O servidor DNS da empresa é o Dns (192.168.1.50) e o banco é o computador Banco (192.168.1.60). Os dois clientes precisam chegar ao Banco verdadeiro, na porta 443 (HTTPS).' + SIMPLIFICACAO,
    objetivos: [{ id: 'o1', de: c1, nome: 'banco.local', para: cBanco }, { id: 'o2', de: c2, nome: 'banco.local', para: cBanco }, alcanca('o3', c1, cBanco, { porta: 443 })],
    dicas: ['Compare nslookup banco.local no Cliente1 e no Cliente2. Os endereços são iguais? E o servidor que respondeu?', 'O Cliente1 está usando como DNS o 192.168.1.66, o computador Falso, que responde banco.local com o próprio endereço (um site falso esperando a sua senha).', 'No Cliente1, troque o servidor DNS para 192.168.1.50. Simplificação: na vida real o DNS falso costuma chegar por um DHCP falso ou por malware que altera a configuração; o HTTPS com certificado válido ajudaria a perceber a fraude.'],
    topologia: c.t },
  { id: 'seg-feche-telnet', modulo: 'missoes', titulo: 'Feche o Telnet para os clientes', dificuldade: 3, xp: 260, habilidades: ['seguranca.pratica', 'roteamento.pratica'],
    cenario: 'O Servidor (10.0.0.10) oferece SSH (22), Telnet (23) e HTTP (80). O Telnet manda tudo, inclusive a senha, sem criptografia. A rede dos clientes (192.168.1.0/24) deve continuar acessando o site e o SSH, mas não o Telnet. O Admin, na mesma rede do servidor, ainda precisa do Telnet para um equipamento antigo.',
    objetivos: [alcanca('o1', d.p1, d.srv, { porta: 80 }), alcanca('o2', d.p2, d.srv, { porta: 22 }), alcanca('o3', d.p1, d.srv, { porta: 23, esperado: 'falha' }), alcanca('o4', d.p2, d.srv, { porta: 23, esperado: 'falha' }), alcanca('o5', d.adm, d.srv, { porta: 23 })],
    dicas: ['Teste no Cliente1 com tnc 10.0.0.10 23 e tnc 10.0.0.10 80. Desligar o Telnet no servidor tiraria o acesso do Admin também.', 'O tráfego dos clientes passa pelo R1; o do Admin não (está na mesma rede do servidor). Uma regra no filtro do R1 resolve só para os clientes.', 'No R1, acrescente: negar, protocolo tcp, origem 192.168.1.0 /24, destino 10.0.0.10 /32, porta 23.'],
    topologia: d.t },
  { id: 'seg-bloqueio-demais', modulo: 'missoes', titulo: 'Bloquearam o ping e levaram o site junto', dificuldade: 2, xp: 200, habilidades: ['seguranca.diagnostico', 'troubleshooting.diagnostico'],
    cenario: 'Pediram para bloquear o ping dos clientes até o Servidor (10.0.0.10), para dificultar a varredura da rede. Depois da mudança no R1, o site (porta 80) também parou para os clientes. O ping deve continuar bloqueado; o site precisa voltar.',
    objetivos: [alcanca('o1', e.p1, e.srv, { porta: 80 }), alcanca('o2', e.p2, e.srv, { porta: 80 }), alcanca('o3', e.p1, e.srv, { esperado: 'falha' })],
    dicas: ['Olhe a regra do filtro do R1: ela tem protocolo? Sem protocolo (ip) ela vale para tudo: ping, HTTP, SSH.', 'O ping usa ICMP. O site usa TCP na porta 80. A regra precisa ser só para icmp.', 'No R1, remova a regra atual e crie: negar, protocolo icmp, origem 192.168.1.0 /24, destino 10.0.0.10 /32.'],
    topologia: e.t }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de segurança gravadas (${todas.length} no total).`);
