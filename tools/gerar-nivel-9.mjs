// Acrescenta o nível 9 (ARP e roteamento) ao quiz. Não sobrescreve: se já existir, não faz nada.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('arp-') || p.id.startsWith('roteamento-'))) { console.log('Nível 9 já existe; nada a fazer.'); process.exit(0); }

const arp = { nivel: 9, categoria: 'arp', habilidade: 'ethernet-comutacao.teoria' };
const rot = { nivel: 9, categoria: 'roteamento', habilidade: 'roteamento.teoria' };
const n9 = [
  { ...arp, id: 'arp-001', tipo: 'pergunta', assunto: 'Função do ARP', dificuldade: 1,
    enunciado: 'Para que serve o ARP?',
    alternativas: ['Descobrir o endereço MAC associado a um endereço IP da rede local', 'Descobrir o endereço IP a partir de um nome como www.exemplo.com', 'Entregar endereço IP automaticamente aos dispositivos da rede', 'Escolher o melhor caminho até uma rede em outro continente'],
    correta: 0, explicacao: 'Para montar o quadro, o host precisa do MAC de destino, mas só conhece o IP. O ARP (Address Resolution Protocol) faz essa ligação dentro da rede local. Nomes são resolvidos pelo DNS e endereços são entregues pelo DHCP.' },
  { ...arp, id: 'arp-002', tipo: 'ordenar', assunto: 'Passos do ARP', dificuldade: 2,
    enunciado: 'Coloque em ordem o que acontece quando o host A quer falar com o host B na mesma rede e só conhece o IP de B.',
    itens: ['A envia um ARP Request em broadcast', 'B responde com um ARP Reply para A', 'A guarda o MAC de B na tabela ARP', 'A envia o quadro com o MAC de destino de B'],
    explicacao: 'A pergunta a todos "quem tem este IP?" (broadcast). Só B responde, direto para A (unicast). A guarda a resposta na tabela ARP, para não perguntar de novo, e então envia o quadro.' },
  { ...arp, id: 'arp-003', tipo: 'pergunta', assunto: 'ARP e o gateway', dificuldade: 3,
    enunciado: 'Um PC envia um pacote para um host de OUTRA rede. Qual endereço MAC vai como destino no quadro?',
    alternativas: ['O MAC da interface do roteador que é o gateway padrão', 'O MAC do host de destino, que o ARP descobre pela Internet', 'O MAC de broadcast, FF:FF:FF:FF:FF:FF, para que todos recebam', 'O MAC do switch mais próximo do computador de origem'],
    correta: 0, explicacao: 'O quadro só atravessa a rede local. O endereço IP de destino continua sendo o do host distante, mas o MAC de destino é o do gateway, que recebe o quadro e encaminha o pacote adiante. O PC descobre o MAC do gateway com o ARP.' },
  { ...rot, id: 'roteamento-001', tipo: 'numero', assunto: 'TTL', dificuldade: 2,
    enunciado: 'Um pacote sai com TTL 64 e passa por 3 roteadores. Qual é o TTL quando chega ao destino?', resposta: 61, unidade: '', dica: 'Cada roteador diminui o TTL em 1.',
    explicacao: 'Cada roteador que encaminha o pacote reduz o TTL em 1: 64 − 3 = 61. Se chegar a 0, o pacote é descartado, o que impede que fique circulando para sempre.' },
  { ...rot, id: 'roteamento-002', tipo: 'ligar', assunto: 'Tipos de rota', dificuldade: 2,
    enunciado: 'Ligue cada tipo de rota à sua descrição.',
    pares: [
      { esquerda: 'Rota conectada', direita: 'Rede ligada diretamente a uma interface do roteador' },
      { esquerda: 'Rota estática', direita: 'Configurada manualmente pelo administrador' },
      { esquerda: 'Rota dinâmica', direita: 'Aprendida com outros roteadores por um protocolo' },
      { esquerda: 'Rota padrão', direita: 'Usada quando nenhuma outra rota corresponde ao destino' }],
    explicacao: 'A rota conectada aparece sozinha quando a interface recebe um endereço. A estática é escrita à mão. A dinâmica vem de protocolos como OSPF. A rota padrão (0.0.0.0/0) é a "saída" para qualquer destino desconhecido.' },
  { ...rot, id: 'roteamento-003', tipo: 'pergunta', assunto: 'Prefixo mais específico', dificuldade: 3,
    enunciado: 'A tabela tem as rotas 10.0.0.0/8, 10.1.1.0/24 e 0.0.0.0/0. Qual rota o roteador usa para chegar em 10.1.1.5?',
    alternativas: ['10.1.1.0/24, a de prefixo mais longo que corresponde', '10.0.0.0/8, a primeira que corresponde na lista', '0.0.0.0/0, a rota padrão serve para qualquer destino', 'Nenhuma: com três rotas possíveis, o pacote é descartado'],
    correta: 0, explicacao: 'As três rotas correspondem ao destino, mas o roteador escolhe a mais específica, a de prefixo mais longo. A /24 vence a /8, e a rota padrão só é usada quando nada mais corresponde.' },
  { ...rot, id: 'roteamento-004', tipo: 'classificar', assunto: 'Direto ou pelo gateway', dificuldade: 2,
    enunciado: 'O host 192.168.1.10/24 vai enviar pacotes para cada destino. Para onde o quadro vai primeiro?',
    grupos: ['Direto ao destino', 'Ao gateway padrão'],
    itens: [
      { texto: '192.168.1.50', grupo: 0 },
      { texto: '192.168.1.200', grupo: 0 },
      { texto: '192.168.2.5', grupo: 1 },
      { texto: '8.8.8.8', grupo: 1 },
      { texto: '10.0.0.1', grupo: 1 }],
    explicacao: 'Destinos na mesma rede (192.168.1.0/24) são alcançados direto, com ARP do próprio destino. Qualquer destino fora da rede é enviado ao gateway padrão, que é o roteador.' },
  { ...rot, id: 'roteamento-005', tipo: 'pergunta', assunto: 'Sem gateway padrão', dificuldade: 2,
    enunciado: 'Um computador tem IP e máscara corretos, mas nenhum gateway padrão. O que ele consegue fazer?',
    alternativas: ['Falar com hosts da própria rede, mas não com redes de fora', 'Falar com qualquer host, porque o switch faz o roteamento', 'Falar só com a Internet, porque os endereços locais exigem gateway', 'Nada: sem gateway a placa de rede é desativada'],
    correta: 0, explicacao: 'Dentro da própria rede o ARP basta, e o gateway não é necessário. Para qualquer destino em outra rede, o host não sabe para onde enviar. Esse é um defeito clássico que o laboratório reproduz.' },
  { ...rot, id: 'roteamento-006', tipo: 'pergunta', assunto: 'Roteador sem rota', dificuldade: 3,
    enunciado: 'Um roteador recebe um pacote para um destino sem rota correspondente e sem rota padrão. O que acontece?',
    alternativas: ['O pacote é descartado, e o roteador pode avisar a origem com um ICMP "destino inalcançável"', 'O pacote é enviado por todas as interfaces até alguém aceitar', 'O pacote fica guardado no roteador até uma rota aparecer', 'O pacote é entregue ao switch mais próximo, que decide o destino'],
    correta: 0, explicacao: 'Sem rota, o roteador não sabe para onde enviar e descarta o pacote. Normalmente avisa a origem com uma mensagem ICMP de destino inalcançável. É o que aparece no ping quando falta rota.' }
];

perguntas.push(...n9);
const n = niveis.find(x => x.id === 9);
n.categoria = 'roteamento';
n.resumo = ['ARP: como o host descobre o MAC dentro da rede', 'Gateway padrão e o MAC usado para sair da rede', 'Tabela de rotas, prefixo mais longo e TTL'];
n.desafios = n9.map(q => q.id);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 9 acrescentado:', n9.length, 'desafios.');
