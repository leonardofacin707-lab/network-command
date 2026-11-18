// Acrescenta o nível 10 (TCP, UDP e portas) ao quiz. Não sobrescreve: se já existir, não faz nada.
// A categoria "transporte" (trilha servicos) foi acrescentada à mão em data/categories.json, para manter o formato do arquivo.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('transporte-'))) { console.log('Nível 10 já existe; nada a fazer.'); process.exit(0); }

const base = { nivel: 10, categoria: 'transporte', habilidade: 'servicos.teoria' };
const n10 = [
  { id: 'transporte-001', tipo: 'pergunta', assunto: 'TCP', dificuldade: 1,
    enunciado: 'Qual característica descreve o TCP?',
    alternativas: ['Estabelece uma conexão e confirma a entrega dos dados', 'Envia os dados sem avisar e sem conferir se chegaram', 'Entrega endereços IP automaticamente aos dispositivos', 'Traduz nomes de sites em endereços IP'],
    correta: 0, explicacao: 'O TCP é orientado a conexão e confiável: numera os dados, o destino confirma o que recebeu e o que se perde é reenviado. Quem envia sem conexão e sem confirmação é o UDP.' },
  { id: 'transporte-002', tipo: 'classificar', assunto: 'TCP ou UDP', dificuldade: 2,
    enunciado: 'Qual protocolo de transporte cada aplicação costuma usar?',
    grupos: ['TCP', 'UDP'],
    itens: [
      { texto: 'Página da web (HTTPS)', grupo: 0 },
      { texto: 'Envio de e-mail', grupo: 0 },
      { texto: 'Download de um arquivo', grupo: 0 },
      { texto: 'Chamada de voz pela Internet', grupo: 1 },
      { texto: 'Transmissão de vídeo ao vivo', grupo: 1 },
      { texto: 'Consulta DNS', grupo: 1 }],
    explicacao: 'Web, e-mail e arquivos não podem perder pedaços, então usam TCP. Voz, vídeo ao vivo e consultas DNS preferem rapidez: uma perda pequena é tolerável e reenviar atrasaria tudo, então usam UDP.' },
  { id: 'transporte-003', tipo: 'ordenar', assunto: 'Three-way handshake', dificuldade: 2,
    enunciado: 'Coloque em ordem as mensagens que abrem uma conexão TCP (three-way handshake).',
    itens: ['SYN', 'SYN-ACK', 'ACK'],
    explicacao: 'O cliente propõe a conexão (SYN), o servidor aceita e propõe a sua parte (SYN-ACK) e o cliente confirma (ACK). Só depois os dados são enviados.' },
  { id: 'transporte-004', tipo: 'ligar', assunto: 'Portas conhecidas', dificuldade: 2,
    enunciado: 'Ligue cada protocolo à sua porta padrão.',
    pares: [
      { esquerda: 'HTTP', direita: '80' },
      { esquerda: 'HTTPS', direita: '443' },
      { esquerda: 'DNS', direita: '53' },
      { esquerda: 'SSH', direita: '22' }],
    explicacao: 'HTTP usa a porta 80 e HTTPS a 443. O DNS usa a 53 (UDP e TCP) e o SSH, acesso remoto seguro, usa a 22.' },
  { id: 'transporte-005', tipo: 'numero', assunto: 'Quantidade de portas', dificuldade: 3,
    enunciado: 'Quantos números de porta existem no TCP (de 0 até o maior valor possível)?', resposta: 65536, unidade: 'portas', dica: 'O número da porta tem 16 bits.',
    explicacao: 'O número de porta tem 16 bits, então são 2^16 = 65.536 valores, de 0 a 65.535.' },
  { id: 'transporte-006', tipo: 'pergunta', assunto: 'Função da porta', dificuldade: 1,
    enunciado: 'Para que serve o número de porta?',
    alternativas: ['Indicar qual aplicação do computador deve receber os dados', 'Indicar em qual porta física do switch o cabo está ligado', 'Indicar qual roteador deve encaminhar o pacote', 'Indicar a velocidade em que o dado será enviado'],
    correta: 0, explicacao: 'O endereço IP leva o pacote até o dispositivo, e o número de porta leva os dados até o programa certo dentro dele (navegador, e-mail, jogo). Por isso vários programas usam a rede ao mesmo tempo sem se misturar.' },
  { id: 'transporte-007', tipo: 'pergunta', assunto: 'Soquete', dificuldade: 2,
    enunciado: 'O que é um soquete (socket)?',
    alternativas: ['A combinação de um endereço IP com um número de porta', 'O conector físico em que o cabo de rede é encaixado', 'A combinação de um endereço MAC com um endereço IP', 'O pedaço de dados enviado por uma conexão TCP'],
    correta: 0, explicacao: 'Um soquete é o par endereço IP + porta, como 192.168.1.10:443. Uma conexão fica definida pelos dois soquetes: o do cliente e o do servidor.' },
  { id: 'transporte-008', tipo: 'pergunta', assunto: 'Confiabilidade do TCP', dificuldade: 2,
    enunciado: 'Como o TCP garante que os dados chegaram?',
    alternativas: ['Numera os segmentos, recebe confirmações (ACK) e reenvia o que não foi confirmado', 'Envia cada segmento três vezes seguidas para compensar as perdas', 'Pede ao roteador que guarde uma cópia de todos os segmentos', 'Confia na camada de enlace, que nunca perde um quadro'],
    correta: 0, explicacao: 'Cada segmento tem um número de sequência. O destino confirma o que recebeu com ACK, e o que não é confirmado a tempo é retransmitido. Também reordena os segmentos se chegarem fora de ordem.' },
  { id: 'transporte-009', tipo: 'pergunta', assunto: 'Faixas de portas', dificuldade: 3,
    enunciado: 'Como são chamadas as portas de 0 a 1023?',
    alternativas: ['Portas conhecidas (well-known), reservadas a serviços padrão', 'Portas dinâmicas, escolhidas ao acaso pelo cliente a cada conexão', 'Portas registradas, usadas só por aplicativos de uma fabricante', 'Portas privadas, bloqueadas por padrão em qualquer rede'],
    correta: 0, explicacao: 'As portas de 0 a 1023 são as conhecidas (HTTP 80, HTTPS 443, SSH 22…). De 1024 a 49151 ficam as registradas, e de 49152 a 65535 as dinâmicas, que os clientes usam como porta de origem temporária.' }
].map(q => ({ ...base, ...q }));

perguntas.push(...n10);
const n = niveis.find(x => x.id === 10);
n.categoria = 'transporte';
n.resumo = ['TCP (confiável) e UDP (rápido): quando usar cada um', 'Three-way handshake, confirmações e retransmissão', 'Portas, soquetes e portas conhecidas'];
n.desafios = n10.map(q => q.id);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 10 acrescentado:', n10.length, 'desafios.');
