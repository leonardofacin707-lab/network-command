// Acrescenta 3 missões de NAT (2 de diagnóstico e 1 de prática) em data/missions.json. Idempotente (substitui as de mesmo id).
// O provedor (Provedor) só conhece as redes ligadas a ele; a restrição "sem-rota-privada" impede contornar o NAT com uma rota estática.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway, adicionarRotaEstatica, configurarNat, renomear } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

/**
 * Cliente(s) - SW1 - Borda (r1) - Provedor (r2) - Servidor. clientes: 1 ou 2.
 * borda: { configurada, rota, nat } controla o que a Borda já tem em direção ao provedor.
 */
function rede({ clientes, configurada, rota, nat }) {
  let t = topologiaVazia();
  for (let i = 0; i < clientes; i++) t = ok(adicionarDispositivo(t, 'pc', { x: 80, y: clientes === 1 ? 230 : 130 + i * 200 }));
  t = ok(adicionarDispositivo(t, 'switch', { x: 250, y: 230 }));
  t = ok(adicionarDispositivo(t, 'roteador', { x: 430, y: 230 }));
  t = ok(adicionarDispositivo(t, 'roteador', { x: 610, y: 230 }));
  t = ok(adicionarDispositivo(t, 'pc', { x: 800, y: 230 }));
  const sw = `sw1`, borda = 'r1', prov = 'r2', srv = `pc${clientes + 1}`;
  for (let i = 1; i <= clientes; i++) {
    t = ok(renomear(t, `pc${i}`, `Cliente${i}`));
    t = ok(conectar(t, `pc${i}`, sw, 'eth0', `fa${i}`));
    t = ok(configurarInterface(t, `pc${i}`, 'eth0', { ip: `192.168.1.${9 + i}`, mascara: '/24' }));
    t = ok(configurarGateway(t, `pc${i}`, '192.168.1.1'));
  }
  t = ok(renomear(t, borda, 'Borda')); t = ok(renomear(t, prov, 'Provedor')); t = ok(renomear(t, srv, 'Servidor'));
  t = ok(conectar(t, sw, borda, `fa${clientes + 1}`, 'gi0'));
  t = ok(conectar(t, borda, prov, 'gi1', 'gi0'));
  t = ok(conectar(t, prov, srv, 'gi1', 'eth0'));
  t = ok(configurarInterface(t, borda, 'gi0', { ip: '192.168.1.1', mascara: '/24' }));
  t = ok(configurarInterface(t, prov, 'gi0', { ip: '200.0.0.1', mascara: '/30' }));
  t = ok(configurarInterface(t, prov, 'gi1', { ip: '200.0.1.1', mascara: '/24' }));
  t = ok(configurarInterface(t, srv, 'eth0', { ip: '200.0.1.10', mascara: '/24' }));
  t = ok(configurarGateway(t, srv, '200.0.1.1'));
  if (configurada) t = ok(configurarInterface(t, borda, 'gi1', { ip: '200.0.0.2', mascara: '/30' }));
  if (rota) t = ok(adicionarRotaEstatica(t, borda, { rede: '0.0.0.0', mascara: '/0', via: '200.0.0.1' }));
  if (nat) t = ok(configurarNat(t, borda, nat));
  return t;
}

const objetivos = clientes => [
  ...Array.from({ length: clientes }, (_, i) => ({ id: `o${i + 1}`, de: `pc${i + 1}`, para: `pc${clientes + 1}` })),
  { id: `o${clientes + 1}`, tipo: 'sem-rota-privada', roteador: 'r2' }
];

const missoes = [
  { id: 'nat-sem-volta', modulo: 'missoes', titulo: 'A ida chega, a volta se perde', dificuldade: 2, xp: 170, habilidades: ['servicos.diagnostico'],
    cenario: 'O Cliente1 (192.168.1.10) usa endereço privado e precisa falar com o Servidor da Internet (200.0.1.10). A Borda já tem IP e rota padrão para o Provedor, mas o ping dá "esgotado o tempo limite". O Provedor, como qualquer provedor, não tem rotas para redes privadas e você não pode pedir uma.',
    objetivos: objetivos(1),
    dicas: ['Faça ping 200.0.1.10 e depois tracert: a ida passa por Borda e Provedor. O pacote chega ao Servidor, mas a resposta não volta.', 'O Servidor responde para 192.168.1.10, um endereço privado. O Provedor não sabe como chegar lá. A Borda precisa trocar o endereço de origem por um que o Provedor conheça.', 'Selecione a Borda e ligue o NAT: interface de dentro = a que leva à rede 192.168.1.0/24 (gi0), de fora = a que leva ao Provedor (gi1).'],
    topologia: rede({ clientes: 1, configurada: true, rota: true }) },
  { id: 'nat-lados-trocados', modulo: 'missoes', titulo: 'NAT ligado, mas ao contrário', dificuldade: 2, xp: 180, habilidades: ['servicos.diagnostico'],
    cenario: 'Alguém já ligou o NAT na Borda, mas o Cliente1 continua sem alcançar o Servidor. Agora o ping responde "Comunicação proibida administrativamente". O Provedor não conhece redes privadas.',
    objetivos: objetivos(1),
    dicas: ['Use ping e leia a mensagem: ela vem da Borda e fala em NAT. O NAT está ativo, mas não está traduzindo o tráfego do Cliente1.', 'No NAT, "dentro" é o lado da rede privada e "fora" é o lado do provedor. Veja qual interface da Borda leva a cada lado.', 'Na Borda, troque as duas interfaces do NAT: dentro = gi0 (192.168.1.1), fora = gi1 (200.0.0.2).'],
    topologia: rede({ clientes: 1, configurada: true, rota: true, nat: { dentro: 'gi1', fora: 'gi0' } }) },
  { id: 'nat-saida-da-empresa', modulo: 'missoes', titulo: 'Dê saída para a Internet à empresa', dificuldade: 3, xp: 260, habilidades: ['servicos.pratica', 'roteamento.pratica'],
    cenario: 'Dois clientes (192.168.1.10 e 192.168.1.11) precisam acessar o Servidor (200.0.1.10). O Provedor liga na Borda pela rede 200.0.0.0/30: o Provedor usa 200.0.0.1 e a Borda deve usar 200.0.0.2. A interface gi1 da Borda ainda não tem IP, não há rota e não há NAT. O Provedor não aceita rotas para endereços privados.',
    objetivos: objetivos(2),
    dicas: ['São três coisas na Borda: IP na interface que liga ao Provedor, uma rota para o resto do mundo e o NAT.', 'Configure o IP 200.0.0.2 com máscara /30 na gi1 e crie a rota 0.0.0.0 /0 com próximo salto 200.0.0.1.', 'Ligue o NAT com dentro = gi0 e fora = gi1. Depois teste o ping dos dois clientes.'],
    topologia: rede({ clientes: 2, configurada: false, rota: false }) }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de NAT gravadas (${todas.length} no total).`);
