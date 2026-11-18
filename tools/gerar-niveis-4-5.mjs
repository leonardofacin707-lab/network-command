// Acrescenta os níveis 4 (Dentro do switch) e 5 (Endereço IPv4) ao quiz. Não sobrescreve: se já existirem, não faz nada.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('ethernet-'))) { console.log('Níveis 4 e 5 já existem; nada a fazer.'); process.exit(0); }

const base4 = { nivel: 4, categoria: 'ethernet', habilidade: 'ethernet-comutacao.teoria' };
const base5 = { nivel: 5, categoria: 'ipv4', habilidade: 'ip.teoria' };

const n4 = [
  { id: 'ethernet-001', tipo: 'pergunta', assunto: 'Encaminhamento do switch', dificuldade: 1,
    enunciado: 'O que o switch usa para decidir por qual porta enviar um quadro?',
    alternativas: ['O endereço MAC de destino, consultado na tabela de endereços MAC', 'O endereço IP de destino, consultado na tabela de rotas', 'O nome do computador de destino, consultado no servidor DNS', 'O tamanho do quadro, enviando os maiores pelas portas mais rápidas'],
    correta: 0, explicacao: 'O switch trabalha na camada 2. Ele lê o MAC de destino do quadro e procura esse endereço na sua tabela de endereços MAC, que diz em qual porta o destinatário está.' },
  { id: 'ethernet-002', tipo: 'numero', assunto: 'Endereço MAC', dificuldade: 1,
    enunciado: 'Quantos bits tem um endereço MAC?', resposta: 48, unidade: 'bits', dica: 'O endereço MAC tem 6 bytes, e cada byte tem 8 bits.',
    explicacao: 'Um endereço MAC tem 48 bits (6 bytes), escritos em 12 dígitos hexadecimais, como 00:1A:2B:3C:4D:5E.' },
  { id: 'ethernet-003', tipo: 'ordenar', assunto: 'Quadro Ethernet', dificuldade: 2,
    enunciado: 'Monte o quadro Ethernet na ordem em que os campos são transmitidos, do primeiro ao último.',
    itens: ['Preâmbulo', 'MAC de destino', 'MAC de origem', 'Tipo', 'Dados', 'FCS'],
    explicacao: 'O quadro começa com o preâmbulo (sincronização), depois vêm o MAC de destino, o MAC de origem, o campo Tipo (qual protocolo está nos dados), os dados e, no fim, o FCS, que serve para detectar erros.' },
  { id: 'ethernet-004', tipo: 'classificar', assunto: 'Subcamadas do enlace de dados', dificuldade: 2,
    enunciado: 'A camada de enlace tem duas subcamadas. A qual delas pertence cada função?',
    grupos: ['LLC (controle do enlace lógico)', 'MAC (controle de acesso ao meio)'],
    itens: [
      { texto: 'Conversar com a camada de rede', grupo: 0 },
      { texto: 'Identificar qual protocolo de rede está nos dados (IPv4 ou IPv6)', grupo: 0 },
      { texto: 'Montar o quadro com os endereços MAC', grupo: 1 },
      { texto: 'Controlar quando o dispositivo pode usar o meio', grupo: 1 }],
    explicacao: 'A subcamada LLC faz a ligação com a camada de rede. A subcamada MAC cuida do quadro, dos endereços MAC e do acesso ao meio físico.' },
  { id: 'ethernet-005', tipo: 'pergunta', assunto: 'Aprendizado de endereços', dificuldade: 2,
    enunciado: 'Um quadro chega a uma porta do switch com um MAC de origem ainda desconhecido. O que o switch faz?',
    alternativas: ['Associa esse MAC à porta em que o quadro entrou', 'Descarta o quadro até o administrador cadastrar o MAC', 'Pede ao roteador para registrar o MAC na tabela de rotas', 'Troca o MAC de origem por um endereço que ele já conhece'],
    correta: 0, explicacao: 'O switch aprende olhando o MAC de origem: guarda na tabela que aquele endereço está na porta por onde o quadro chegou. Ninguém precisa cadastrar nada.' },
  { id: 'ethernet-006', tipo: 'classificar', assunto: 'Decisão do switch', dificuldade: 3,
    enunciado: 'O que o switch faz em cada situação?',
    grupos: ['Encaminha só pela porta do destino', 'Inunda por todas as outras portas', 'Filtra (não encaminha)'],
    itens: [
      { texto: 'Unicast cujo destino está na tabela, em outra porta', grupo: 0 },
      { texto: 'Unicast cujo destino ainda não está na tabela', grupo: 1 },
      { texto: 'Broadcast (FF:FF:FF:FF:FF:FF)', grupo: 1 },
      { texto: 'Unicast cujo destino está na mesma porta por onde o quadro entrou', grupo: 2 }],
    explicacao: 'Com o destino conhecido em outra porta, o switch encaminha só por ela. Destino desconhecido e broadcast são inundados por todas as portas, menos a de entrada. Se o destino está na própria porta de entrada, não há por que encaminhar.' },
  { id: 'ethernet-007', tipo: 'ligar', assunto: 'Tipos de comunicação', dificuldade: 1,
    enunciado: 'Ligue cada tipo de comunicação ao seu alcance.',
    pares: [
      { esquerda: 'Unicast', direita: 'Um único destinatário' },
      { esquerda: 'Multicast', direita: 'Um grupo de destinatários' },
      { esquerda: 'Broadcast', direita: 'Todos os dispositivos da rede local' }],
    explicacao: 'Unicast é de um para um. Multicast é de um para um grupo que se inscreveu. Broadcast é de um para todos os dispositivos da mesma rede local.' },
  { id: 'ethernet-008', tipo: 'pergunta', assunto: 'Full-duplex', dificuldade: 2,
    enunciado: 'Qual é a vantagem de uma porta de switch operar em full-duplex?',
    alternativas: ['Enviar e receber ao mesmo tempo, sem colisões', 'Reservar metade da velocidade para a próxima conexão', 'Alcançar distâncias maiores do que o cabo permitiria', 'Trocar o MAC de origem sem avisar o outro lado'],
    correta: 0, explicacao: 'No full-duplex cada sentido tem seu próprio caminho. Por isso o dispositivo transmite e recebe ao mesmo tempo, e as colisões deixam de existir nesse enlace.' },
  { id: 'ethernet-009', tipo: 'pergunta', assunto: 'Formato do endereço MAC', dificuldade: 3,
    enunciado: 'Qual destes é um endereço MAC válido?',
    alternativas: ['00:1A:2B:3C:4D:5E', '00:1A:2B:3C:4D', '00:1A:2B:3C:4D:5G', '192.168.0.10'],
    correta: 0, explicacao: 'Um MAC tem 6 bytes em hexadecimal. O segundo tem só 5 bytes, o terceiro usa a letra G (fora do hexadecimal 0 a F) e o último é um endereço IPv4.' }
].map(q => ({ ...base4, ...q }));

const n5 = [
  { id: 'ipv4-001', tipo: 'numero', assunto: 'Tamanho do endereço IPv4', dificuldade: 1,
    enunciado: 'Quantos bits tem um endereço IPv4?', resposta: 32, unidade: 'bits', dica: 'São 4 números (octetos) de 8 bits cada.',
    explicacao: 'Um endereço IPv4 tem 32 bits, divididos em 4 octetos de 8 bits e escritos em decimal separados por pontos, como 192.168.1.10.' },
  { id: 'ipv4-002', tipo: 'numero', assunto: 'Binário para decimal', dificuldade: 2,
    enunciado: 'Quanto vale o octeto 11000000 em decimal?', resposta: 192, dica: 'Some os pesos dos bits 1: 128 + 64.',
    explicacao: 'Os pesos dos bits, da esquerda para a direita, são 128, 64, 32, 16, 8, 4, 2 e 1. Em 11000000 só os dois primeiros bits valem 1: 128 + 64 = 192.' },
  { id: 'ipv4-003', tipo: 'classificar', assunto: 'Endereços públicos, privados e especiais', dificuldade: 3,
    enunciado: 'Classifique cada endereço IPv4.',
    grupos: ['Privado', 'Público', 'Especial (loopback ou link-local)'],
    itens: [
      { texto: '10.20.30.40', grupo: 0 },
      { texto: '172.16.5.9', grupo: 0 },
      { texto: '192.168.1.10', grupo: 0 },
      { texto: '172.32.0.1', grupo: 1 },
      { texto: '8.8.8.8', grupo: 1 },
      { texto: '127.0.0.1', grupo: 2 },
      { texto: '169.254.10.5', grupo: 2 }],
    explicacao: 'Os blocos privados são 10.0.0.0/8, 172.16.0.0 a 172.31.255.255 e 192.168.0.0/16. Por isso 172.32.0.1 já é público. 127.0.0.0/8 é loopback (o próprio equipamento) e 169.254.0.0/16 é link-local, usado quando o host não recebeu endereço.' },
  { id: 'ipv4-004', tipo: 'ligar', assunto: 'Máscara e prefixo', dificuldade: 2,
    enunciado: 'Ligue cada máscara de sub-rede ao seu prefixo.',
    pares: [
      { esquerda: '255.0.0.0', direita: '/8' },
      { esquerda: '255.255.0.0', direita: '/16' },
      { esquerda: '255.255.255.0', direita: '/24' },
      { esquerda: '255.255.255.128', direita: '/25' }],
    explicacao: 'O prefixo conta quantos bits 1 a máscara tem, da esquerda para a direita. 255.255.255.128 tem 24 bits 1 nos três primeiros octetos mais 1 bit no último, ou seja, /25.' },
  { id: 'ipv4-005', tipo: 'pergunta', assunto: 'Função da máscara', dificuldade: 1,
    enunciado: 'Para que serve a máscara de sub-rede?',
    alternativas: ['Separar a parte de rede e a parte de host do endereço IP', 'Esconder o endereço IP do dispositivo para os vizinhos', 'Criptografar os pacotes enviados para outras redes', 'Definir a velocidade máxima que a placa de rede aceita'],
    correta: 0, explicacao: 'Os bits 1 da máscara marcam a parte de rede do endereço, e os bits 0 marcam a parte de host. É assim que o dispositivo descobre se o destino está na sua rede ou fora dela.' },
  { id: 'ipv4-006', tipo: 'pergunta', assunto: 'Endereço 169.254.x.x', dificuldade: 2,
    enunciado: 'Um computador aparece com o endereço 169.254.37.8. O que isso indica?',
    alternativas: ['Ele não recebeu endereço de um servidor DHCP e se autoatribuiu um', 'Ele está usando o endereço de loopback para falar consigo mesmo', 'Ele tem um endereço público fixo entregue pelo provedor', 'Ele faz parte de um grupo multicast dentro da rede local'],
    correta: 0, explicacao: 'O bloco 169.254.0.0/16 é de endereços link-local (APIPA). O sistema se atribui um deles quando não consegue obter um endereço do DHCP. Costuma indicar falha ao pedir endereço.' },
  { id: 'ipv4-007', tipo: 'ordenar', assunto: 'Tamanho das redes', dificuldade: 2,
    enunciado: 'Ordene os prefixos da rede que comporta MENOS hosts para a que comporta MAIS.',
    itens: ['/30', '/27', '/24', '/16'],
    explicacao: 'Quanto maior o prefixo, menos bits sobram para hosts. Uma /30 tem 2 hosts úteis, uma /27 tem 30, uma /24 tem 254 e uma /16 tem 65.534.' },
  { id: 'ipv4-008', tipo: 'pergunta', assunto: 'Endereço de broadcast', dificuldade: 3,
    enunciado: 'Qual é o endereço de broadcast da rede 192.168.10.0/24?',
    alternativas: ['192.168.10.255', '192.168.10.254', '192.168.255.255', '192.168.10.1'],
    correta: 0, explicacao: 'Com /24, os 8 últimos bits são de host. O broadcast é o endereço com todos esses bits em 1, ou seja, 192.168.10.255. O .254 é o último host utilizável, e o .1 é só um host.' },
  { id: 'ipv4-009', tipo: 'pergunta', assunto: 'Mesma rede ou não', dificuldade: 3,
    enunciado: 'Qual destes hosts está na mesma rede que 192.168.1.10 com máscara 255.255.255.0?',
    alternativas: ['192.168.1.200', '192.168.2.10', '192.168.10.1', '10.0.1.10'],
    correta: 0, explicacao: 'Com a máscara /24, os três primeiros octetos definem a rede. Só 192.168.1.200 tem a rede 192.168.1.0. Os outros ficam em redes diferentes e precisariam de um roteador para conversar.' }
].map(q => ({ ...base5, ...q }));

perguntas.push(...n4, ...n5);
const completa = (id, resumo, ids) => {
  const n = niveis.find(x => x.id === id);
  n.categoria = id === 4 ? 'ethernet' : 'ipv4';
  n.resumo = resumo;
  n.desafios = ids.map(q => q.id);
};
completa(4, ['Endereço MAC e o quadro Ethernet', 'Como o switch aprende, encaminha e inunda', 'Unicast, multicast e broadcast; full-duplex'], n4);
completa(5, ['Octetos, binário e decimal', 'Máscara, prefixo, rede, host e broadcast', 'Endereços privados, públicos, loopback e link-local'], n5);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Níveis 4 e 5 acrescentados:', n4.length + n5.length, 'desafios.');
