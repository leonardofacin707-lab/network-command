// Gera data/missions.json a partir de cenários montados pela API do simulador (assim as topologias são sempre válidas).
// Rode uma vez; o JSON gerado é a fonte dos dados. Não sobrescreve sem --forcar.
import { writeFileSync } from 'node:fs';
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway } from '../js/sim/topologia.js';

const destino = new URL('../data/missions.json', import.meta.url);
// Sem --forcar, a gravação usa a flag 'wx' (falha se o arquivo já existe), sem checar antes e gravar depois.
const FLAG = process.argv.includes('--forcar') ? 'w' : 'wx';

const montar = (disp, cabos, cfg, gws = {}) => {
  let t = topologiaVazia();
  for (const [tipo, x, y] of disp) t = adicionarDispositivo(t, tipo, { x, y }).topologia;
  for (const [a, b] of cabos) t = conectar(t, a, b).topologia;
  for (const [id, porta, ip, m] of cfg) t = configurarInterface(t, id, porta, { ip, mascara: m }).topologia;
  for (const [id, gw] of Object.entries(gws)) t = configurarGateway(t, id, gw).topologia;
  return t;
};
const lanTres = [['switch', 450, 130], ['pc', 200, 340], ['pc', 450, 340], ['pc', 700, 340]]; // sw1, pc1, pc2, pc3
const duasRedes = [['pc', 110, 120], ['pc', 790, 120], ['switch', 250, 260], ['switch', 650, 260], ['roteador', 450, 400]]; // pc1 pc2 sw1 sw2 r1
const cabosDuasRedes = [['pc1', 'sw1'], ['sw1', 'r1'], ['pc2', 'sw2'], ['sw2', 'r1']];

const missoes = [
  { id: 'cabo-esquecido', titulo: 'O cabo esquecido', dificuldade: 1, xp: 100,
    cenario: 'O PC3 foi instalado hoje na sala de reuniões, mas ninguém consegue acessá-lo. Os endereços IP já estão configurados corretamente.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc3' }, { id: 'o2', de: 'pc3', para: 'pc1' }],
    dicas: ['Antes de olhar para os endereços, confira o nível físico: todo computador precisa estar ligado ao switch.', 'Selecione o PC3 e veja a lista de cabos dele. Depois use "Conectar cabo" para ligá-lo ao SW1.'],
    topologia: montar(lanTres, [['pc1', 'sw1'], ['pc2', 'sw1']], [['pc1', 'eth0', '192.168.1.10', '/24'], ['pc2', 'eth0', '192.168.1.20', '/24'], ['pc3', 'eth0', '192.168.1.30', '/24']]) },
  { id: 'ip-duplicado', titulo: 'Dois computadores, um endereço', dificuldade: 1, xp: 100,
    cenario: 'A rede da contabilidade está instável: às vezes o PC2 responde, às vezes não. O suporte suspeita que dois computadores foram configurados na mão com o mesmo endereço.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc3', para: 'pc2' }],
    dicas: ['Compare o endereço IP de cada computador. O laboratório também mostra avisos abaixo da área de trabalho.', 'Dois computadores não podem ter o mesmo IP na mesma rede. Troque o de um deles por outro endereço livre de 192.168.1.0/24.'],
    topologia: montar(lanTres, [['pc1', 'sw1'], ['pc2', 'sw1'], ['pc3', 'sw1']], [['pc1', 'eth0', '192.168.1.10', '/24'], ['pc2', 'eth0', '192.168.1.20', '/24'], ['pc3', 'eth0', '192.168.1.10', '/24']]) },
  { id: 'mascara-errada', titulo: 'A máscara que não combina', dificuldade: 2, xp: 150,
    cenario: 'O PC1 "vê" o PC2, mas o PC2 não consegue responder. O técnico anterior alterou a máscara de sub-rede de um deles.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc2', para: 'pc1' }],
    dicas: ['O ping que chega ao destino mas não volta indica que um dos lados não enxerga o outro como vizinho. Use ipconfig nos dois e compare.', 'Calcule a sub-rede de cada computador com o seu endereço e a sua máscara. Elas precisam ser a mesma rede.'],
    topologia: montar([['switch', 450, 130], ['pc', 250, 340], ['pc', 650, 340]], [['pc1', 'sw1'], ['pc2', 'sw1']], [['pc1', 'eth0', '192.168.1.10', '255.255.255.0'], ['pc2', 'eth0', '192.168.1.200', '255.255.255.128']]) },
  { id: 'gateway-errado', titulo: 'O caminho para a outra rede', dificuldade: 2, xp: 200,
    cenario: 'A filial (10.0.0.0/24) e a matriz (192.168.1.0/24) estão ligadas por um roteador, mas o PC1 não consegue falar com a filial. A matriz inteira usa o gateway configurado no PC1.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc2', para: 'pc1' }],
    dicas: ['Dentro da própria rede o PC1 funciona; o problema aparece só ao sair dela. Quem leva o tráfego para fora é o gateway padrão.', 'Veja qual IP o roteador usa na rede do PC1 e compare com o gateway configurado no PC1.'],
    topologia: montar(duasRedes, cabosDuasRedes, [['r1', 'gi0', '192.168.1.1', '/24'], ['r1', 'gi1', '10.0.0.1', '/24'], ['pc1', 'eth0', '192.168.1.10', '/24'], ['pc2', 'eth0', '10.0.0.10', '/24']], { pc1: '192.168.1.254', pc2: '10.0.0.1' }) },
  { id: 'interface-sem-ip', titulo: 'O roteador pela metade', dificuldade: 3, xp: 250,
    cenario: 'O roteador novo foi instalado e ligado às duas redes, mas só uma delas funciona. Os dois computadores já estão corretos.',
    objetivos: [{ id: 'o1', de: 'pc1', para: 'pc2' }, { id: 'o2', de: 'pc2', para: 'pc1' }],
    dicas: ['Os computadores estão certos. Olhe as duas interfaces do roteador, uma de cada vez.', 'O gateway do PC2 aponta para um endereço que o roteador precisa ter na interface ligada à rede do PC2.'],
    topologia: montar(duasRedes, cabosDuasRedes, [['r1', 'gi0', '192.168.1.1', '/24'], ['pc1', 'eth0', '192.168.1.10', '/24'], ['pc2', 'eth0', '10.0.0.10', '/24']], { pc1: '192.168.1.1', pc2: '10.0.0.1' }) }
];
try { writeFileSync(destino, JSON.stringify(missoes, null, 2) + '\n', { flag: FLAG }); }
catch (e) { if (e.code === 'EEXIST') { console.error('data/missions.json já existe. Use --forcar para sobrescrever.'); process.exit(1); } throw e; }
console.log(`${missoes.length} missões gravadas em data/missions.json`);
