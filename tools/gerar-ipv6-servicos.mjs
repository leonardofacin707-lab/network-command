// Acrescenta 2 missões que completam o IPv6: DHCPv6 com estado e registro DNS AAAA. Idempotente.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, renomear, configurarInterface, configurarInterface6, configurarGateway6, configurarDhcp6Pc,
  configurarRoteamento6, configurarDnsPc, adicionarRegistroDns } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

// 1) DHCPv6: clientes pedem endereço, o R1 anuncia a rede mas não tem pool.
let a = topologiaVazia();
const addA = (tipo, nome, x, y) => { a = ok(adicionarDispositivo(a, tipo, { x, y })); const id = a.dispositivos.at(-1).id; a = ok(renomear(a, id, nome)); return id; };
const a1 = addA('pc', 'Cliente1', 90, 130), a2 = addA('pc', 'Cliente2', 90, 340), aSw = addA('switch', 'SW1', 270, 230), aR = addA('roteador', 'R1', 470, 230), aSrv = addA('pc', 'Servidor', 740, 230);
a = ok(conectar(a, a1, aSw, 'eth0', 'fa1')); a = ok(conectar(a, a2, aSw, 'eth0', 'fa2')); a = ok(conectar(a, aSw, aR, 'fa3', 'gi0')); a = ok(conectar(a, aR, aSrv, 'gi1', 'eth0'));
a = ok(configurarInterface6(a, aR, 'gi0', { ip6: '2001:db8:1::1/64' })); a = ok(configurarInterface6(a, aR, 'gi1', { ip6: '2001:db8:2::1/64' }));
a = ok(configurarRoteamento6(a, aR, true));
a = ok(configurarInterface6(a, aSrv, 'eth0', { ip6: '2001:db8:2::10/64' })); a = ok(configurarGateway6(a, aSrv, '2001:db8:2::1'));
for (const pc of [a1, a2]) a = ok(configurarDhcp6Pc(a, pc, true));

// 2) AAAA: clientes com IPv4 e IPv6; o DNS só tem o registro A do portal.
let b = topologiaVazia();
const addB = (tipo, nome, x, y) => { b = ok(adicionarDispositivo(b, tipo, { x, y })); const id = b.dispositivos.at(-1).id; b = ok(renomear(b, id, nome)); return id; };
const b1 = addB('pc', 'Cliente1', 120, 120), b2 = addB('pc', 'Cliente2', 120, 340), bSw = addB('switch', 'SW1', 420, 230), bDns = addB('pc', 'Dns', 740, 120), bWeb = addB('pc', 'Portal', 740, 340);
for (const [id, p] of [[b1, 'fa1'], [b2, 'fa2'], [bDns, 'fa3'], [bWeb, 'fa4']]) b = ok(conectar(b, id, bSw, 'eth0', p));
for (const [id, fim] of [[b1, 10], [b2, 11], [bDns, 50], [bWeb, 60]]) {
  b = ok(configurarInterface(b, id, 'eth0', { ip: `192.168.1.${fim}`, mascara: '/24' }));
  b = ok(configurarInterface6(b, id, 'eth0', { ip6: `2001:db8:1::${fim}/64` }));
}
for (const pc of [b1, b2]) b = ok(configurarDnsPc(b, pc, '192.168.1.50'));
b = ok(adicionarRegistroDns(b, bDns, { nome: 'portal.empresa.local', ip: '192.168.1.60' }));

const missoes = [
  { id: 'ipv6-dhcpv6', modulo: 'missoes', titulo: 'Endereços IPv6 pelo DHCPv6', dificuldade: 2, xp: 220, habilidades: ['ip.pratica', 'servicos.pratica'],
    cenario: 'A empresa quer controlar quais endereços IPv6 os clientes usam, então eles foram configurados para DHCPv6 (não SLAAC). O R1 já roteia IPv6 e anuncia a rede 2001:db8:1::/64, mas os clientes continuam sem endereço global.',
    objetivos: [{ id: 'o1', de: a1, para: aSrv, ipv6: true }, { id: 'o2', de: a2, para: aSrv, ipv6: true }],
    dicas: ['Rode ipconfig no Cliente1: ele diz que o roteador anuncia a rede, mas não tem pool DHCPv6.', 'No DHCPv6 com estado, o servidor (aqui, o R1) entrega o endereço de uma faixa (pool) e o gateway continua vindo do anúncio do roteador.', 'No R1, preencha o pool DHCPv6 da Gi0/0, por exemplo de 2001:db8:1::100 até 2001:db8:1::1ff.'],
    topologia: a },
  { id: 'ipv6-registro-aaaa', modulo: 'missoes', titulo: 'O portal só responde por IPv4', dificuldade: 2, xp: 200, habilidades: ['servicos.diagnostico', 'ip.diagnostico'],
    cenario: 'A empresa ligou o IPv6 em toda a rede e quer que o portal.empresa.local seja acessado por IPv6. Os clientes e o Portal (2001:db8:1::60) já têm IPv6, mas pelo nome o acesso continua só por IPv4.',
    objetivos: [{ id: 'o1', de: b1, nome: 'portal.empresa.local', ipv6: true }, { id: 'o2', de: b2, nome: 'portal.empresa.local', ipv6: true }],
    dicas: ['Rode nslookup portal.empresa.local no Cliente1: aparece só o endereço IPv4.', 'No DNS, o registro A guarda um IPv4 e o registro AAAA guarda um IPv6. Um nome pode ter os dois.', 'No computador Dns, acrescente o registro portal.empresa.local → 2001:db8:1::60. O ping pelo nome passa a usar IPv6, como no Windows.'],
    topologia: b }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de IPv6 (serviços) gravadas (${todas.length} no total).`);
