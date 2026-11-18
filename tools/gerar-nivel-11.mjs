// Acrescenta o nível 11 (Serviços) ao quiz. Não sobrescreve: se já existir, não faz nada.
// A categoria "aplicacao" (trilha servicos) foi acrescentada à mão em data/categories.json, para manter o formato do arquivo.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('aplicacao-'))) { console.log('Nível 11 já existe; nada a fazer.'); process.exit(0); }

const dns = { nivel: 11, categoria: 'dns', habilidade: 'servicos.teoria' };
const app = { nivel: 11, categoria: 'aplicacao', habilidade: 'servicos.teoria' };
const n11 = [
  { ...dns, id: 'dns-001', tipo: 'pergunta', assunto: 'Função do DNS', dificuldade: 1,
    enunciado: 'Qual é a função do DNS?',
    alternativas: ['Traduzir nomes como www.exemplo.com em endereços IP', 'Entregar endereços IP automaticamente aos aparelhos da rede', 'Descobrir o endereço MAC que corresponde a um endereço IP', 'Trocar endereços privados por públicos ao sair para a Internet'],
    correta: 0, explicacao: 'As pessoas lembram nomes, e os computadores usam endereços IP. O DNS (Domain Name System) faz a tradução. DHCP entrega endereços, ARP descobre MACs e NAT troca endereços privados por públicos.' },
  { ...dns, id: 'dns-002', tipo: 'ordenar', assunto: 'Consulta DNS', dificuldade: 2,
    enunciado: 'Coloque em ordem o que acontece ao abrir um site pelo nome.',
    itens: ['O usuário digita o nome do site no navegador', 'O computador procura o nome no cache local', 'O computador consulta o servidor DNS configurado', 'O servidor DNS responde com o endereço IP', 'O navegador se conecta ao endereço IP recebido'],
    explicacao: 'Primeiro o computador tenta o cache. Se não achar, pergunta ao servidor DNS. Com o endereço IP em mãos, o navegador abre a conexão com o servidor do site.' },
  { ...dns, id: 'dns-003', tipo: 'ligar', assunto: 'Registros DNS', dificuldade: 3,
    enunciado: 'Ligue cada tipo de registro DNS ao que ele guarda.',
    pares: [
      { esquerda: 'A', direita: 'Endereço IPv4 de um nome' },
      { esquerda: 'AAAA', direita: 'Endereço IPv6 de um nome' },
      { esquerda: 'MX', direita: 'Servidor de e-mail do domínio' },
      { esquerda: 'NS', direita: 'Servidor DNS responsável pelo domínio' }],
    explicacao: 'O registro A associa um nome a um endereço IPv4, e o AAAA a um IPv6. O MX diz para onde entregar os e-mails do domínio, e o NS indica quais servidores DNS respondem por ele.' },
  { ...app, id: 'aplicacao-001', tipo: 'classificar', assunto: 'Protocolos de aplicação', dificuldade: 2,
    enunciado: 'A que tipo de serviço pertence cada protocolo?',
    grupos: ['Web', 'E-mail', 'Transferência de arquivos'],
    itens: [
      { texto: 'HTTP', grupo: 0 },
      { texto: 'HTTPS', grupo: 0 },
      { texto: 'SMTP', grupo: 1 },
      { texto: 'POP3', grupo: 1 },
      { texto: 'IMAP', grupo: 1 },
      { texto: 'FTP', grupo: 2 },
      { texto: 'SMB', grupo: 2 }],
    explicacao: 'HTTP e HTTPS levam páginas da web. SMTP envia e-mails, e POP3 e IMAP permitem receber e ler. FTP e SMB servem para transferir e compartilhar arquivos.' },
  { ...app, id: 'aplicacao-002', tipo: 'numero', assunto: 'Porta do FTP', dificuldade: 3,
    enunciado: 'Qual é a porta TCP padrão de controle (comandos) do FTP?', resposta: 21, unidade: '', dica: 'O FTP usa duas portas vizinhas: uma para dados e outra para comandos.',
    explicacao: 'O FTP usa a porta 21 para controle (comandos) e a 20 para transferir dados no modo ativo.' },
  { ...app, id: 'aplicacao-003', tipo: 'pergunta', assunto: 'HTTP e HTTPS', dificuldade: 1,
    enunciado: 'Qual é a diferença entre HTTP e HTTPS?',
    alternativas: ['O HTTPS criptografa a comunicação entre o navegador e o servidor', 'O HTTPS só funciona em redes sem fio, e o HTTP só em redes com cabo', 'O HTTP é mais seguro porque sempre pede senha antes de carregar', 'O HTTPS serve só para e-mail, e o HTTP serve só para páginas da web'],
    correta: 0, explicacao: 'O HTTPS é o HTTP protegido por criptografia (TLS), o que impede que alguém no caminho leia ou altere os dados. É o que o cadeado do navegador indica.' },
  { ...dns, id: 'dns-004', tipo: 'pergunta', assunto: 'Cache DNS', dificuldade: 2,
    enunciado: 'Para que serve o cache DNS?',
    alternativas: ['Guardar respostas recentes para responder mais rápido sem consultar de novo', 'Guardar cópias das páginas da web para abri-las sem a Internet funcionando', 'Guardar as senhas digitadas para entrar automaticamente nos sites visitados', 'Guardar os endereços MAC de todos os aparelhos que já usaram a rede local'],
    correta: 0, explicacao: 'O cache guarda por um tempo as respostas que já recebeu. Se o mesmo nome for pedido de novo, a resposta sai da memória, sem consultar o servidor DNS outra vez.' },
  { ...dns, id: 'dns-005', tipo: 'pergunta', assunto: 'Diagnóstico de DNS', dificuldade: 3,
    enunciado: 'O ping para 8.8.8.8 funciona, mas o ping para www.exemplo.com mostra que o nome não foi encontrado. Onde está o problema?',
    alternativas: ['Na resolução de nomes: o DNS não está configurado ou não responde', 'No cabo de rede, que estaria desconectado do computador de origem', 'No gateway padrão, que estaria configurado com o endereço errado', 'Na máscara de sub-rede, que estaria impedindo qualquer tráfego de saída'],
    correta: 0, explicacao: 'Se o ping para um endereço IP da Internet funciona, o cabo, o IP, a máscara e o gateway estão certos. O que falha é a tradução de nome em endereço, ou seja, o DNS. É um bom exemplo de diagnóstico por camadas.' },
  { ...app, id: 'aplicacao-004', tipo: 'pergunta', assunto: 'SSH e Telnet', dificuldade: 2,
    enunciado: 'Por que o SSH é preferido ao Telnet para administrar equipamentos?',
    alternativas: ['O SSH criptografa a sessão, e o Telnet envia tudo em texto puro', 'O SSH é mais rápido porque nunca precisa de usuário e senha para entrar', 'O Telnet só funciona com cabo, e o SSH funciona também sem fio', 'O SSH usa o protocolo UDP, e o Telnet depende de uma conexão TCP'],
    correta: 0, explicacao: 'No Telnet, usuário e senha trafegam sem criptografia e qualquer um no caminho pode lê-los. O SSH protege a sessão inteira com criptografia, e por isso é o padrão para acesso remoto.' }
];

perguntas.push(...n11);
const n = niveis.find(x => x.id === 11);
n.categoria = 'dns';
n.resumo = ['DNS: tradução de nomes, consulta, cache e registros', 'Web, e-mail e transferência de arquivos', 'HTTP x HTTPS, SSH x Telnet e diagnóstico de nomes'];
n.desafios = n11.map(q => q.id);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 11 acrescentado:', n11.length, 'desafios.');
