// Acrescenta 3 missões de DNS (2 de diagnóstico e 1 de prática) em data/missions.json. Idempotente (substitui as de mesmo id).
// Objetivos com "nome" fazem o computador resolver o nome pelo DNS e depois dar ping no endereço obtido.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, renomear, configurarDnsPc, adicionarRegistroDns } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

/**
 * Rede 192.168.1.0/24 com SW1 e computadores com nomes de função: clientes (.10, .11), Dns (.50), Web (.60) e Arquivos (.70, opcional).
 * dns: servidor configurado nos clientes (ou ''); registros: lista [nome, ip] no servidor Dns.
 */
function rede({ clientes, dns, registros, arquivos = false }) {
  const nomes = [...Array.from({ length: clientes }, (_, i) => ['Cliente' + (i + 1), 10 + i]), ['Dns', 50], ['Web', 60], ...(arquivos ? [['Arquivos', 70]] : [])];
  let t = topologiaVazia();
  t = ok(adicionarDispositivo(t, 'switch', { x: 420, y: 230 }));
  nomes.forEach((_, i) => { t = ok(adicionarDispositivo(t, 'pc', { x: i < clientes ? 120 : 740, y: Math.round(i < clientes ? 120 + i * 220 : 70 + (i - clientes) * 130) })); });
  nomes.forEach(([nome, fim], i) => {
    const id = `pc${i + 1}`;
    t = ok(renomear(t, id, nome));
    t = ok(conectar(t, id, 'sw1', 'eth0', `fa${i + 1}`));
    t = ok(configurarInterface(t, id, 'eth0', { ip: `192.168.1.${fim}`, mascara: '/24' }));
  });
  if (dns) for (let i = 1; i <= clientes; i++) t = ok(configurarDnsPc(t, `pc${i}`, dns));
  const idDns = `pc${clientes + 1}`;
  for (const [nome, ip] of registros) t = ok(adicionarRegistroDns(t, idDns, { nome, ip }));
  return { t, idDns, idWeb: `pc${clientes + 2}`, idArq: `pc${clientes + 3}` };
}
const porNome = (...lista) => lista.map(([de, nome], i) => ({ id: `o${i + 1}`, de, nome }));

const a = rede({ clientes: 1, dns: '', registros: [['www.loja.local', '192.168.1.60']] });
const b = rede({ clientes: 1, dns: '192.168.1.50', registros: [['www.loja.local', '192.168.1.61']] });
const c = rede({ clientes: 2, dns: '', registros: [], arquivos: true });

const missoes = [
  { id: 'dns-ping-no-nome', modulo: 'missoes', titulo: 'Ping no IP funciona, no nome não', dificuldade: 1, xp: 140, habilidades: ['servicos.diagnostico'],
    cenario: 'O servidor Web (192.168.1.60) responde ao ping pelo endereço, mas o Cliente1 não consegue abrir o site pelo nome www.loja.local. O servidor de nomes da empresa (Dns, 192.168.1.50) já tem o registro.',
    objetivos: porNome(['pc1', 'www.loja.local']),
    dicas: ['No terminal do Cliente1, compare: ping 192.168.1.60 funciona, ping www.loja.local não. Então o problema está na resolução do nome. Use nslookup www.loja.local.', 'O nslookup diz que não há servidor DNS configurado neste computador.', 'Selecione o Cliente1 e preencha o servidor DNS com o IP do computador Dns (192.168.1.50).'],
    topologia: a.t },
  { id: 'dns-registro-errado', modulo: 'missoes', titulo: 'O nome aponta para o lugar errado', dificuldade: 2, xp: 180, habilidades: ['servicos.diagnostico'],
    cenario: 'O Cliente1 já usa o servidor DNS certo e o nome www.loja.local resolve, mas o site não abre. O servidor Web foi trocado de endereço e o registro DNS não foi atualizado.',
    objetivos: porNome(['pc1', 'www.loja.local']),
    dicas: ['Use nslookup www.loja.local e depois ping no endereço que ele mostrou. O nome resolve, mas esse endereço não responde.', 'O servidor Web é o computador de nome Web. Confira o endereço dele e compare com o registro no computador Dns.', 'No computador Dns, remova o registro www.loja.local e crie outro apontando para o endereço certo do Web (192.168.1.60).'],
    topologia: b.t },
  { id: 'dns-da-empresa', modulo: 'missoes', titulo: 'Monte o DNS da empresa', dificuldade: 3, xp: 260, habilidades: ['servicos.pratica'],
    cenario: 'A empresa tem dois clientes, um servidor Web (192.168.1.60), um servidor de arquivos (192.168.1.70) e um computador Dns (192.168.1.50) ainda sem nenhum registro. Faça os dois clientes acessarem intranet.empresa.local (o Web) e arquivos.empresa.local (o Arquivos) pelo nome.',
    objetivos: porNome(['pc1', 'intranet.empresa.local'], ['pc2', 'intranet.empresa.local'], ['pc1', 'arquivos.empresa.local'], ['pc2', 'arquivos.empresa.local']),
    dicas: ['Dois passos: o servidor DNS precisa conhecer os nomes (registros) e os clientes precisam saber quem é o servidor DNS.', 'No computador Dns, crie dois registros: intranet.empresa.local → 192.168.1.60 e arquivos.empresa.local → 192.168.1.70.', 'Nos dois clientes, preencha o servidor DNS com 192.168.1.50. Depois teste com nslookup.'],
    topologia: c.t }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de DNS gravadas (${todas.length} no total).`);
