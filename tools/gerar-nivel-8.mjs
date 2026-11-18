// Acrescenta o nível 8 (DHCP e NAT) ao quiz. Não sobrescreve: se já existir, não faz nada.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('dhcp-') || p.id.startsWith('nat-'))) { console.log('Nível 8 já existe; nada a fazer.'); process.exit(0); }

const base = { nivel: 8, habilidade: 'servicos.teoria' };
const dhcp = { ...base, categoria: 'dhcp' }, nat = { ...base, categoria: 'nat' };
const n8 = [
  { ...dhcp, id: 'dhcp-001', tipo: 'pergunta', assunto: 'Função do DHCP', dificuldade: 1,
    enunciado: 'Qual é a função do DHCP?',
    alternativas: ['Entregar automaticamente endereço IP, máscara, gateway e DNS aos dispositivos', 'Traduzir nomes como www.exemplo.com em endereços IP', 'Trocar endereços privados por públicos ao sair para a Internet', 'Criptografar o tráfego entre o computador e o roteador'],
    correta: 0, explicacao: 'O DHCP (Dynamic Host Configuration Protocol) configura os hosts automaticamente, sem ninguém digitar endereços. Traduzir nomes é função do DNS, e trocar endereços privados por públicos é função do NAT.' },
  { ...dhcp, id: 'dhcp-002', tipo: 'ordenar', assunto: 'Etapas do DHCP', dificuldade: 2,
    enunciado: 'Coloque em ordem as mensagens do processo DHCP, da primeira à última.',
    itens: ['DHCPDISCOVER', 'DHCPOFFER', 'DHCPREQUEST', 'DHCPACK'],
    explicacao: 'O cliente procura servidores (Discover), um servidor oferece um endereço (Offer), o cliente pede aquele endereço (Request) e o servidor confirma (Acknowledgment). A sequência é conhecida como DORA.' },
  { ...dhcp, id: 'dhcp-003', tipo: 'pergunta', assunto: 'DHCPDISCOVER em broadcast', dificuldade: 2,
    enunciado: 'Por que o DHCPDISCOVER é enviado em broadcast?',
    alternativas: ['O cliente ainda não tem endereço IP nem sabe onde está o servidor DHCP', 'O broadcast é a única forma de criptografar a mensagem inicial', 'O servidor DHCP só aceita mensagens enviadas a todos os hosts', 'O switch exige broadcast em toda mensagem que passa por ele'],
    correta: 0, explicacao: 'Ao conectar, o cliente não tem endereço IP e não sabe qual é o servidor. Por isso grita para toda a rede local, e qualquer servidor DHCP que ouvir pode responder.' },
  { ...dhcp, id: 'dhcp-004', tipo: 'numero', assunto: 'Porta do servidor DHCP', dificuldade: 3,
    enunciado: 'Qual é a porta UDP usada pelo servidor DHCP?', resposta: 67, unidade: '', dica: 'O cliente usa a porta 68; o servidor usa a anterior.',
    explicacao: 'O servidor DHCP escuta na porta UDP 67 e o cliente usa a porta UDP 68.' },
  { ...dhcp, id: 'dhcp-005', tipo: 'pergunta', assunto: 'Tempo de concessão', dificuldade: 2,
    enunciado: 'O que é a concessão (lease) de um endereço DHCP?',
    alternativas: ['O tempo durante o qual o cliente pode usar o endereço antes de renová-lo', 'A taxa que o provedor cobra por cada endereço entregue', 'O número máximo de dispositivos que o roteador aceita', 'O endereço do servidor DHCP que o cliente deve decorar'],
    correta: 0, explicacao: 'O servidor empresta o endereço por um tempo determinado. Antes de expirar, o cliente pede a renovação. Se não renovar, o endereço volta para o conjunto de endereços disponíveis.' },
  { ...nat, id: 'nat-001', tipo: 'pergunta', assunto: 'Por que usar NAT', dificuldade: 2,
    enunciado: 'Por que uma rede doméstica precisa de NAT para acessar a Internet?',
    alternativas: ['Endereços privados não são roteados na Internet e precisam ser traduzidos para um público', 'Sem o NAT o roteador não consegue ligar à energia do provedor', 'O NAT é o que escolhe a velocidade do plano contratado', 'Sem o NAT os endereços MAC dos dispositivos seriam apagados'],
    correta: 0, explicacao: 'Endereços como 192.168.0.15 são privados e não são roteados na Internet. O NAT, normalmente no roteador, troca o endereço privado por um público na saída e faz o caminho inverso na volta. Isso também economiza endereços IPv4.' },
  { ...nat, id: 'nat-002', tipo: 'ligar', assunto: 'Tipos de NAT', dificuldade: 3,
    enunciado: 'Ligue cada tipo de NAT à sua característica.',
    pares: [
      { esquerda: 'NAT estático', direita: 'Mapeamento fixo de um endereço privado para um público' },
      { esquerda: 'NAT dinâmico', direita: 'Escolhe o endereço público em um conjunto disponível' },
      { esquerda: 'PAT (sobrecarga)', direita: 'Vários hosts dividem um endereço público, distinguidos pela porta' }],
    explicacao: 'O NAT estático é um para um e fixo. O dinâmico sorteia um endereço público de um conjunto, quando houver. O PAT é o mais comum nas casas: um único endereço público atende muitos dispositivos, cada conexão com uma porta diferente.' },
  { ...nat, id: 'nat-003', tipo: 'classificar', assunto: 'DHCP ou NAT', dificuldade: 2,
    enunciado: 'Cada situação é resolvida pelo DHCP ou pelo NAT?',
    grupos: ['DHCP', 'NAT'],
    itens: [
      { texto: 'Entregar um endereço ao notebook que acabou de conectar', grupo: 0 },
      { texto: 'Informar o gateway padrão ao cliente', grupo: 0 },
      { texto: 'Renovar o tempo de concessão do endereço', grupo: 0 },
      { texto: 'Trocar o endereço privado pelo público ao sair para a Internet', grupo: 1 },
      { texto: 'Compartilhar um único endereço público entre vários dispositivos', grupo: 1 }],
    explicacao: 'O DHCP configura os hosts (endereço, gateway, concessão). O NAT traduz endereços na fronteira entre a rede privada e a Internet.' },
  { ...dhcp, id: 'dhcp-006', tipo: 'ligar', assunto: 'Informações entregues pelo DHCP', dificuldade: 1,
    enunciado: 'Ligue cada informação fornecida pelo DHCP à sua função.',
    pares: [
      { esquerda: 'Endereço IP', direita: 'Identifica o host na rede' },
      { esquerda: 'Máscara de sub-rede', direita: 'Separa a parte de rede da parte de host' },
      { esquerda: 'Gateway padrão', direita: 'Saída para outras redes' },
      { esquerda: 'Servidor DNS', direita: 'Traduz nomes em endereços IP' }],
    explicacao: 'O DHCP entrega o conjunto completo para o host funcionar: o endereço, a máscara, o gateway padrão (para sair da rede) e o servidor DNS (para resolver nomes).' }
];

perguntas.push(...n8);
const n = niveis.find(x => x.id === 8);
n.categoria = 'dhcp';
n.resumo = ['DHCP: o que entrega e as quatro mensagens (DORA)', 'Concessão (lease) e portas do DHCP', 'NAT estático, dinâmico e PAT'];
n.desafios = n8.map(q => q.id);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 8 acrescentado:', n8.length, 'desafios.');
