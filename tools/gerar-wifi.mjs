// Acrescenta 4 missões de Wi-Fi em data/missions.json (senha, SSID oculto, banda e rede aberta). Idempotente.
// Todas usam a mesma rede: Servidor com cabo no SW1, ponto de acesso AP1 no SW1 e notebooks sem fio.
import { readFileSync, writeFileSync } from 'node:fs';
import { ordenarMissoes } from './ordem-missoes.mjs';
import { topologiaVazia, adicionarDispositivo, conectar, renomear, configurarInterface, configurarWifiAp, configurarWifiPc } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
const existentes = JSON.parse(readFileSync(destino, 'utf8'));
const ok = r => { if (!r.topologia) throw new Error(r.erro); return r.topologia; };

/** ap: config do AP; clientes: [[nome, config Wi-Fi]] */
function rede(ap, clientes) {
  let t = topologiaVazia();
  const add = (tipo, nome, x, y) => { t = ok(adicionarDispositivo(t, tipo, { x, y })); const id = t.dispositivos.at(-1).id; t = ok(renomear(t, id, nome)); return id; };
  const srv = add('pc', 'Servidor', 780, 230), sw = add('switch', 'SW1', 560, 230), apId = add('ap', 'AP1', 340, 230);
  t = ok(conectar(t, srv, sw, 'eth0', 'fa1')); t = ok(conectar(t, apId, sw, 'eth0', 'fa2'));
  t = ok(configurarInterface(t, srv, 'eth0', { ip: '192.168.1.10', mascara: '/24' }));
  t = ok(configurarWifiAp(t, apId, ap));
  const ids = clientes.map(([nome, w], i) => {
    const id = add('pc', nome, 100, clientes.length === 1 ? 230 : 120 + i * 230);
    t = ok(configurarInterface(t, id, 'eth0', { ip: `192.168.1.${21 + i}`, mascara: '/24' }));
    t = ok(configurarWifiPc(t, id, w));
    return id;
  });
  return { t, srv, ap: apId, ids };
}
const alc = (id, de, para) => ({ id, de, para });
const CORRETA = 'Cafe-com-Leite-2026';

const a = rede({ ssid: 'Escritorio', seguranca: 'wpa2', senha: CORRETA, banda: 'ambas' },
  [['Notebook1', { ssid: 'Escritorio', senha: CORRETA }], ['Notebook2', { ssid: 'Escritorio', senha: 'cafe-com-leite-2026' }]]);
const b = rede({ ssid: 'Diretoria', seguranca: 'wpa3', senha: 'Reuniao-Sexta-9h', banda: 'ambas', oculto: true },
  [['Notebook1', { ssid: 'diretoria', senha: 'Reuniao-Sexta-9h' }]]);
const c = rede({ ssid: 'Loja', seguranca: 'wpa2', senha: 'Vitrine-Azul-77', banda: '5' },
  [['Caixa', { ssid: 'Loja', senha: 'Vitrine-Azul-77' }], ['Leitor', { ssid: 'Loja', senha: 'Vitrine-Azul-77', so24: true }]]);
const d = rede({ ssid: 'Clinica', seguranca: 'aberta', banda: 'ambas' },
  [['Recepcao', { ssid: 'Clinica', senha: '' }], ['Consultorio', { ssid: 'Clinica', senha: '' }]]);

const missoes = [
  { id: 'wifi-senha-errada', modulo: 'missoes', titulo: 'Um notebook não entra no Wi-Fi', dificuldade: 1, xp: 140, habilidades: ['fundamentos.diagnostico'],
    cenario: 'No escritório, o Notebook1 acessa o Servidor (192.168.1.10) pelo Wi-Fi "Escritorio", mas o Notebook2 não conecta. Os dois foram configurados pela mesma pessoa.',
    objetivos: [alc('o1', a.ids[0], a.srv), alc('o2', a.ids[1], a.srv)],
    dicas: ['No terminal do Notebook2, rode netsh wlan show interfaces. Qual é o motivo da desconexão?', 'A senha do Wi-Fi diferencia maiúsculas de minúsculas. Compare a senha do Notebook2 com a configurada no AP1.', `No Notebook2, use a senha exatamente como está no AP1: ${CORRETA}.`],
    topologia: a.t },
  { id: 'wifi-ssid-oculto', modulo: 'missoes', titulo: 'A rede que não aparece', dificuldade: 2, xp: 160, habilidades: ['fundamentos.diagnostico', 'seguranca.diagnostico'],
    cenario: 'A rede da diretoria tem o SSID oculto. O Notebook1 tem a senha certa, mas não conecta, e a rede nem aparece na lista.',
    objetivos: [alc('o1', b.ids[0], b.srv)],
    dicas: ['Rode netsh wlan show networks: redes com SSID oculto não aparecem na lista. Para entrar, é preciso digitar o nome exato.', 'Veja o SSID no AP1 e compare com o do Notebook1, letra por letra. O SSID diferencia maiúsculas de minúsculas.', 'No Notebook1, escreva o SSID como Diretoria (com D maiúsculo). Lembre: esconder o SSID não é segurança, ele aparece nos pacotes. O que protege a rede é o WPA3 com senha forte.'],
    topologia: b.t },
  { id: 'wifi-leitor-antigo', modulo: 'missoes', titulo: 'O leitor antigo não acha a rede', dificuldade: 2, xp: 170, habilidades: ['fundamentos.diagnostico'],
    cenario: 'A loja trocou o ponto de acesso e configurou a rede "Loja" só em 5 GHz. O Caixa funciona, mas o leitor de código de barras, um aparelho antigo, não conecta.',
    objetivos: [alc('o1', c.ids[0], c.srv), alc('o2', c.ids[1], c.srv)],
    dicas: ['No Leitor, rode netsh wlan show networks e netsh wlan show interfaces. O adaptador dele é de qual banda?', 'Adaptadores antigos só funcionam em 2,4 GHz. A rede está transmitindo só em 5 GHz.', 'No AP1, mude a banda para "2,4 e 5 GHz": o Caixa continua funcionando e o Leitor passa a enxergar a rede.'],
    topologia: c.t },
  { id: 'wifi-rede-aberta', modulo: 'missoes', titulo: 'Feche o Wi-Fi aberto da clínica', dificuldade: 2, xp: 220, habilidades: ['seguranca.pratica', 'fundamentos.pratica'],
    cenario: 'A clínica usa um Wi-Fi aberto, sem senha: qualquer pessoa na calçada entra na rede e o tráfego não tem criptografia. Coloque WPA2 ou WPA3 com uma senha forte e reconecte os dois computadores.',
    objetivos: [{ id: 'o1', tipo: 'wifi-seguro', ap: d.ap }, alc('o2', d.ids[0], d.srv), alc('o3', d.ids[1], d.srv)],
    dicas: ['Rode netsh wlan show networks em um dos computadores: a autenticação aparece como "Aberta (sem criptografia!)".', 'No AP1, escolha WPA2-Personal ou WPA3-Personal e uma senha de 12 caracteres ou mais, difícil de adivinhar (nada de 12345678 ou o nome da rede).', 'Ao trocar a senha do AP, os computadores desconectam: atualize a senha na conexão Wi-Fi de cada um. Use uma senha inventada para o jogo, não uma senha real.'],
    topologia: d.t }
];

const ids = new Set(missoes.map(m => m.id));
const todas = [...existentes.filter(m => !ids.has(m.id)), ...missoes];
writeFileSync(destino, JSON.stringify(ordenarMissoes(todas), null, 2) + '\n');
console.log(`${missoes.length} missões de Wi-Fi gravadas (${todas.length} no total).`);
