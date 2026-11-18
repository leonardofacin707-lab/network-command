// Acrescenta o nível 6 (Sub-redes) ao quiz. Não sobrescreve: se já existir, não faz nada.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('subnetting-'))) { console.log('Nível 6 já existe; nada a fazer.'); process.exit(0); }

const base = { nivel: 6, categoria: 'subnetting', habilidade: 'subnetting.teoria' };
const n6 = [
  { id: 'subnetting-001', tipo: 'numero', assunto: 'Bits de host', dificuldade: 1,
    enunciado: 'Quantos bits de host sobram em uma rede /27?', resposta: 5, unidade: 'bits', dica: 'O endereço tem 32 bits. Tire os bits do prefixo.',
    explicacao: 'Bits de host = 32 − prefixo. Em uma /27 sobram 32 − 27 = 5 bits para identificar os hosts.' },
  { id: 'subnetting-002', tipo: 'numero', assunto: 'Hosts úteis', dificuldade: 2,
    enunciado: 'Quantos hosts úteis cabem em uma rede /26?', resposta: 62, unidade: 'hosts', dica: 'Use 2 elevado ao número de bits de host, menos 2.',
    explicacao: 'Em uma /26 sobram 6 bits de host: 2^6 = 64 endereços. Dois não podem ser usados por hosts (o de rede e o de broadcast), então sobram 62.' },
  { id: 'subnetting-003', tipo: 'pergunta', assunto: 'Máscara de um prefixo', dificuldade: 2,
    enunciado: 'Qual é a máscara de sub-rede de uma rede /26?',
    alternativas: ['255.255.255.192', '255.255.255.224', '255.255.255.128', '255.255.255.240'],
    correta: 0, explicacao: 'Uma /26 tem 24 bits 1 nos três primeiros octetos mais 2 bits 1 no último: 11000000 = 192. A máscara é 255.255.255.192.' },
  { id: 'subnetting-004', tipo: 'ligar', assunto: 'Prefixo e hosts úteis', dificuldade: 2,
    enunciado: 'Ligue cada prefixo à quantidade de hosts úteis.',
    pares: [
      { esquerda: '/30', direita: '2 hosts' },
      { esquerda: '/29', direita: '6 hosts' },
      { esquerda: '/28', direita: '14 hosts' },
      { esquerda: '/27', direita: '30 hosts' }],
    explicacao: 'Hosts úteis = 2^(bits de host) − 2. Uma /30 tem 2 bits de host (2 hosts), /29 tem 3 (6), /28 tem 4 (14) e /27 tem 5 (30).' },
  { id: 'subnetting-005', tipo: 'classificar', assunto: 'Em que sub-rede o host está', dificuldade: 3,
    enunciado: 'Dividindo 192.168.1.0/24 em quatro redes /26, em qual delas está cada host?',
    grupos: ['192.168.1.0/26', '192.168.1.64/26', '192.168.1.128/26', '192.168.1.192/26'],
    itens: [
      { texto: '192.168.1.10', grupo: 0 },
      { texto: '192.168.1.45', grupo: 0 },
      { texto: '192.168.1.70', grupo: 1 },
      { texto: '192.168.1.100', grupo: 1 },
      { texto: '192.168.1.130', grupo: 2 },
      { texto: '192.168.1.200', grupo: 3 }],
    explicacao: 'Cada /26 tem 64 endereços, então as redes começam em .0, .64, .128 e .192. Cada host pertence à rede cujo bloco o contém.' },
  { id: 'subnetting-006', tipo: 'pergunta', assunto: 'Escolha do prefixo', dificuldade: 2,
    enunciado: 'Um setor precisa de 50 hosts. Qual é o menor bloco que serve, sem desperdiçar endereços à toa?',
    alternativas: ['/26, com 62 hosts úteis', '/27, com 30 hosts úteis', '/25, com 126 hosts úteis', '/24, com 254 hosts úteis'],
    correta: 0, explicacao: 'Precisamos de 50 hosts úteis. Uma /27 só tem 30, então não serve. A /26 tem 62 e é a menor que comporta os 50. A /25 e a /24 funcionam, mas desperdiçam endereços.' },
  { id: 'subnetting-007', tipo: 'numero', assunto: 'Quantidade de sub-redes', dificuldade: 3,
    enunciado: 'Quantas sub-redes /27 cabem dentro de uma rede /24?', resposta: 8, unidade: 'sub-redes', dica: 'Quantos bits foram "emprestados" do host: 27 − 24.',
    explicacao: 'De /24 para /27 foram emprestados 3 bits, e 2^3 = 8. Cada sub-rede tem 32 endereços, e 8 × 32 = 256.' },
  { id: 'subnetting-008', tipo: 'ordenar', assunto: 'Planejamento com VLSM', dificuldade: 2,
    enunciado: 'Ordene os passos para planejar as sub-redes de uma empresa com VLSM.',
    itens: ['Calcular quantos hosts cada setor precisa', 'Ordenar os setores do maior para o menor', 'Escolher o menor prefixo que comporte cada setor', 'Alocar os blocos em sequência, sem sobreposição'],
    explicacao: 'Primeiro se levanta a necessidade de cada setor. Depois se ordena do maior para o menor, escolhe-se o menor prefixo que atenda e, por fim, os blocos são alocados um depois do outro, sem se sobreporem. É o que o módulo Empresa pede.' },
  { id: 'subnetting-009', tipo: 'pergunta', assunto: 'Endereço de rede', dificuldade: 3,
    enunciado: 'Qual é o endereço de rede do host 172.16.45.200/20?',
    alternativas: ['172.16.32.0', '172.16.45.0', '172.16.40.0', '172.16.0.0'],
    correta: 0, explicacao: 'Uma /20 tem máscara 255.255.240.0, e o terceiro octeto avança de 16 em 16 (0, 16, 32, 48…). O valor 45 está no bloco que começa em 32, então a rede é 172.16.32.0.' }
].map(q => ({ ...base, ...q }));

perguntas.push(...n6);
const n = niveis.find(x => x.id === 6);
n.categoria = 'subnetting';
n.resumo = ['Bits de rede e de host, hosts úteis', 'Máscara, prefixo e endereço de rede', 'Escolher o prefixo e planejar com VLSM'];
n.desafios = n6.map(q => q.id);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 6 acrescentado:', n6.length, 'desafios.');
