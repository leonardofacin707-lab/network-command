// Acrescenta o nível 12 (Chefão: diagnóstico) ao quiz. Não sobrescreve: se já existir, não faz nada.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('troubleshooting-'))) { console.log('Nível 12 já existe; nada a fazer.'); process.exit(0); }

const base = { nivel: 12, categoria: 'troubleshooting', habilidade: 'troubleshooting.teoria' };
const n12 = [
  { id: 'troubleshooting-001', tipo: 'ordenar', assunto: 'Método de diagnóstico', dificuldade: 2,
    enunciado: 'Coloque em ordem as etapas do método de diagnóstico de problemas de rede.',
    itens: ['Identificar o problema', 'Estabelecer uma teoria da causa provável', 'Testar a teoria para confirmar a causa', 'Planejar e executar a correção', 'Verificar o funcionamento completo', 'Documentar o que foi feito'],
    explicacao: 'Primeiro se entende o problema, depois se levanta uma teoria e se testa. Confirmada a causa, planeja-se e aplica-se a correção, verifica-se se tudo voltou a funcionar e, por fim, documenta-se para ajudar nos próximos casos.' },
  { id: 'troubleshooting-002', tipo: 'ligar', assunto: 'Ferramentas de diagnóstico', dificuldade: 2,
    enunciado: 'Ligue cada ferramenta ao que ela mostra ou testa.',
    pares: [
      { esquerda: 'ping', direita: 'Testa se um destino responde' },
      { esquerda: 'ipconfig', direita: 'Mostra o IP, a máscara e o gateway do computador' },
      { esquerda: 'tracert', direita: 'Mostra os roteadores do caminho até o destino' },
      { esquerda: 'nslookup', direita: 'Consulta um servidor DNS' }],
    explicacao: 'O ping verifica a conectividade. O ipconfig (ip addr no Linux) mostra a configuração IP. O tracert (traceroute no Linux) lista os saltos até o destino, e o nslookup testa a resolução de nomes.' },
  { id: 'troubleshooting-003', tipo: 'classificar', assunto: 'Sintoma e camada', dificuldade: 3,
    enunciado: 'Em qual camada fica a causa mais provável de cada sintoma?',
    grupos: ['Física', 'Enlace de dados', 'Rede', 'Aplicação'],
    itens: [
      { texto: 'O cabo está solto e o LED da porta está apagado', grupo: 0 },
      { texto: 'A porta do switch está na VLAN errada', grupo: 1 },
      { texto: 'O gateway padrão está configurado com o endereço errado', grupo: 2 },
      { texto: 'O site abre pelo endereço IP, mas não pelo nome', grupo: 3 }],
    explicacao: 'Cabo e LED são da camada física. Uma porta na VLAN errada é um problema de comutação, na camada de enlace. Gateway errado é endereçamento, na camada de rede. Falha só no nome indica o DNS, um serviço da camada de aplicação.' },
  { id: 'troubleshooting-004', tipo: 'numero', assunto: 'Começar pela camada física', dificuldade: 1,
    enunciado: 'O LED da placa de rede está apagado. Em qual camada do modelo OSI (número) você começa a investigar?', resposta: 1, unidade: '', dica: 'É a camada dos cabos, conectores e sinais.',
    explicacao: 'LED apagado costuma indicar cabo solto, defeituoso ou porta desligada. Isso é da camada 1, a física. Por isso se começa por ela antes de mexer em endereços e configurações.' },
  { id: 'troubleshooting-005', tipo: 'pergunta', assunto: 'Estratégias de diagnóstico', dificuldade: 2,
    enunciado: 'Como se chama a estratégia de começar pela camada física e subir camada por camada até achar o problema?',
    alternativas: ['De baixo para cima (bottom-up)', 'De cima para baixo (top-down)', 'Divisão e conquista, começando pela camada do meio', 'Substituição, trocando peças até o problema sumir'],
    correta: 0, explicacao: 'Na abordagem de baixo para cima (bottom-up) se parte da camada física. A de cima para baixo (top-down) começa pela aplicação. A divisão e conquista começa por uma camada intermediária, e a substituição troca componentes suspeitos por outros que funcionam.' },
  { id: 'troubleshooting-006', tipo: 'pergunta', assunto: 'Ping de loopback', dificuldade: 2,
    enunciado: 'O ping para 127.0.0.1 funciona. O que isso comprova?',
    alternativas: ['A pilha TCP/IP do próprio computador está funcionando', 'O cabo e o switch estão funcionando e ligados corretamente', 'O gateway padrão e o roteador estão respondendo na rede', 'O servidor DNS está resolvendo os nomes de forma correta'],
    correta: 0, explicacao: 'O endereço 127.0.0.1 é o loopback: o pacote nem sai da placa de rede. Funcionar comprova apenas o TCP/IP do computador. Cabo, switch, gateway e DNS precisam ser testados à parte.' },
  { id: 'troubleshooting-007', tipo: 'pergunta', assunto: 'Isolando o ponto da falha', dificuldade: 3,
    enunciado: 'O ping para o gateway funciona, mas o ping para 8.8.8.8 falha. Onde investigar?',
    alternativas: ['Depois do gateway: rota padrão do roteador, NAT ou o link do provedor', 'No cabo do computador, que obviamente não está ligado ao switch', 'No DNS, porque o teste foi feito por endereço IP e não por nome', 'Na placa de rede, que não consegue enviar nenhum pacote para fora'],
    correta: 0, explicacao: 'Se o gateway responde, o cabo, a placa, o IP e a máscara do computador estão bons. O pacote morre depois dele: pode faltar a rota padrão no roteador, o NAT pode estar desligado ou o link do provedor pode ter caído. Como o teste usou o IP, o DNS não entra.' },
  { id: 'troubleshooting-008', tipo: 'pergunta', assunto: 'Primeiro passo do diagnóstico', dificuldade: 1,
    enunciado: 'Um usuário diz "a Internet caiu". Qual é o melhor primeiro passo?',
    alternativas: ['Coletar informações: quem é afetado, desde quando e o que mudou', 'Reiniciar o roteador principal antes de qualquer outra coisa', 'Trocar todos os cabos do andar para eliminar a camada física', 'Reconfigurar o endereço IP de todos os computadores do setor'],
    correta: 0, explicacao: 'O primeiro passo é identificar o problema: quantos usuários, que serviços, desde quando e o que mudou. Ações apressadas, como reiniciar ou trocar tudo, escondem a causa e podem piorar a situação.' },
  { id: 'troubleshooting-009', tipo: 'pergunta', assunto: 'Conflito de endereço IP', dificuldade: 2,
    enunciado: 'Dois computadores da mesma rede estão com o mesmo endereço IP. Qual é o sintoma típico?',
    alternativas: ['A conexão de um ou dos dois fica intermitente, com possível aviso de conflito', 'Os dois computadores ficam sem nenhum cabo de rede funcionando', 'O switch desliga a porta de um dos dois para proteger o resto da rede', 'Os dois passam a usar o mesmo endereço MAC para resolver o conflito'],
    correta: 0, explicacao: 'Com o mesmo IP, as respostas ARP se alternam e o tráfego vai ora para um, ora para outro. O resultado é conexão instável, e o sistema costuma avisar do conflito. A solução é dar um endereço diferente a um deles. Há uma missão assim no laboratório.' }
].map(q => ({ ...base, ...q }));

perguntas.push(...n12);
const n = niveis.find(x => x.id === 12);
n.categoria = 'troubleshooting';
n.resumo = ['O método de diagnóstico em seis etapas', 'Ferramentas: ping, ipconfig, tracert e nslookup', 'Isolar o ponto da falha, camada por camada'];
n.desafios = n12.map(q => q.id);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 12 acrescentado:', n12.length, 'desafios.');
