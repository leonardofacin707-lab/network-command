// Acrescenta o nível 13 (Bônus: segurança) ao quiz. Não sobrescreve: se já existir, não faz nada.
// É um nível bônus, depois do chefão, para não renumerar os níveis (o progresso salvo usa o número do nível como chave).
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('seguranca-'))) { console.log('Nível 13 já existe; nada a fazer.'); process.exit(0); }

const base = { nivel: 13, categoria: 'seguranca', habilidade: 'seguranca.teoria' };
const n13 = [
  { id: 'seguranca-001', tipo: 'classificar', assunto: 'Tipos de ameaça', dificuldade: 2,
    enunciado: 'A que tipo de ameaça pertence cada caso?',
    grupos: ['Malware', 'Engenharia social', 'Ataque à rede'],
    itens: [
      { texto: 'Ransomware que sequestra os arquivos', grupo: 0 },
      { texto: 'Cavalo de Troia escondido em um programa gratuito', grupo: 0 },
      { texto: 'E-mail falso do banco pedindo a senha', grupo: 1 },
      { texto: 'Ligação de um falso "suporte técnico" pedindo acesso', grupo: 1 },
      { texto: 'DDoS que derruba um site com milhões de requisições', grupo: 2 },
      { texto: 'Invasor que intercepta a comunicação entre duas pontas', grupo: 2 }],
    explicacao: 'Malware é software malicioso (ransomware, cavalo de Troia, vírus). Engenharia social engana a pessoa, e não o sistema (phishing, golpes por telefone). Ataques à rede, como o DDoS e o man-in-the-middle, miram a comunicação e a disponibilidade.' },
  { id: 'seguranca-002', tipo: 'pergunta', assunto: 'Phishing', dificuldade: 1,
    enunciado: 'O que é phishing?',
    alternativas: ['Uma mensagem falsa que imita uma instituição para roubar dados da vítima', 'Um programa que apaga os arquivos do computador sem ser percebido', 'Um ataque que derruba um site com excesso de acessos simultâneos', 'Um defeito do cabo de rede que causa perda de pacotes na conexão'],
    correta: 0, explicacao: 'No phishing o golpista se passa por banco, loja ou empresa conhecida, normalmente por e-mail, mensagem ou site falso, para convencer a vítima a entregar senhas ou dados. Desconfie de urgência, de links estranhos e de erros no endereço do remetente.' },
  { id: 'seguranca-003', tipo: 'pergunta', assunto: 'Firewall', dificuldade: 2,
    enunciado: 'Qual é a função de um firewall?',
    alternativas: ['Filtrar o tráfego entre redes, permitindo ou bloqueando conforme regras', 'Traduzir nomes de sites em endereços IP para o navegador abrir', 'Entregar endereços IP automaticamente aos aparelhos da rede local', 'Guardar uma cópia dos arquivos do usuário em outro lugar seguro'],
    correta: 0, explicacao: 'O firewall fica entre redes (por exemplo, a rede local e a Internet) e aplica regras: o que corresponde a uma regra de permissão passa, o resto é bloqueado. Traduzir nomes é o DNS, e entregar endereços é o DHCP.' },
  { id: 'seguranca-004', tipo: 'ligar', assunto: 'Confidencialidade, integridade e disponibilidade', dificuldade: 2,
    enunciado: 'Ligue cada princípio da segurança da informação ao seu significado.',
    pares: [
      { esquerda: 'Confidencialidade', direita: 'Só quem tem autorização consegue acessar' },
      { esquerda: 'Integridade', direita: 'Os dados não são alterados de forma indevida' },
      { esquerda: 'Disponibilidade', direita: 'O serviço está acessível quando for preciso' }],
    explicacao: 'São os três pilares da segurança da informação. Criptografia protege a confidencialidade, somas de verificação ajudam a integridade, e redundância e backups sustentam a disponibilidade.' },
  { id: 'seguranca-005', tipo: 'pergunta', assunto: 'Senhas e autenticação', dificuldade: 2,
    enunciado: 'Qual combinação protege melhor uma conta?',
    alternativas: ['Senha longa e exclusiva, mais verificação em duas etapas', 'Uma senha curta e fácil de lembrar, repetida em todas as contas', 'Uma senha com a data de nascimento, trocada a cada semana', 'Uma senha qualquer, guardada em um bilhete colado no monitor'],
    correta: 0, explicacao: 'Senhas longas e diferentes em cada conta limitam o estrago de um vazamento, e a verificação em duas etapas exige um segundo fator além da senha. Senhas curtas, repetidas ou com dados pessoais são fáceis de adivinhar.' },
  { id: 'seguranca-006', tipo: 'ordenar', assunto: 'Resposta a um dispositivo infectado', dificuldade: 3,
    enunciado: 'Um computador da rede foi infectado. Coloque em ordem o que fazer.',
    itens: ['Isolar o dispositivo da rede', 'Identificar o tipo de ameaça', 'Remover a ameaça', 'Restaurar o sistema a partir de uma cópia confiável', 'Registrar o que aconteceu'],
    explicacao: 'Primeiro se contém o problema, para que não se espalhe. Depois se identifica e remove a ameaça, restaura-se o sistema a partir de uma cópia confiável e, por fim, registra-se o incidente para evitar que se repita.' },
  { id: 'seguranca-007', tipo: 'numero', assunto: 'Regra 3-2-1 de backup', dificuldade: 2,
    enunciado: 'Na regra de backup 3-2-1, quantas cópias dos dados você deve ter no total?', resposta: 3, unidade: 'cópias', dica: 'O primeiro número da regra 3-2-1.',
    explicacao: 'A regra 3-2-1 diz: 3 cópias dos dados (a original e duas de backup), em 2 tipos de mídia diferentes, com 1 cópia guardada fora do local.' },
  { id: 'seguranca-008', tipo: 'pergunta', assunto: 'VPN', dificuldade: 2,
    enunciado: 'O que uma VPN faz?',
    alternativas: ['Cria um túnel criptografado entre o dispositivo e outra rede', 'Aumenta a velocidade do plano de Internet contratado', 'Troca o endereço MAC do dispositivo a cada nova conexão', 'Remove vírus que já estejam instalados no computador'],
    correta: 0, explicacao: 'A VPN (rede privada virtual) protege os dados em trânsito com criptografia, o que é útil em redes públicas ou para acessar a rede da empresa. Ela não aumenta a velocidade nem substitui um antivírus.' },
  { id: 'seguranca-009', tipo: 'pergunta', assunto: 'Atualizações', dificuldade: 1,
    enunciado: 'Por que manter sistemas e equipamentos de rede atualizados?',
    alternativas: ['As atualizações corrigem vulnerabilidades conhecidas que atacantes exploram', 'As atualizações apagam o histórico e liberam espaço para novos arquivos', 'As atualizações dispensam o uso de senhas e de qualquer autenticação', 'As atualizações mudam o endereço IP do equipamento para um mais seguro'],
    correta: 0, explicacao: 'Quando uma falha é descoberta, o fabricante publica a correção, e os atacantes passam a procurar equipamentos que ainda não a aplicaram. Atualizar fecha essa porta.' }
].map(q => ({ ...base, ...q }));

perguntas.push(...n13);
niveis.push({ id: 13, nome: 'Bônus: segurança', icone: 'escudo', modulos: 'Bônus', categoria: 'seguranca',
  resumo: ['Malware, engenharia social e ataques à rede', 'Firewall, VPN, senhas e autenticação em duas etapas', 'Confidencialidade, integridade e disponibilidade'],
  desafios: n13.map(q => q.id) });
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 13 acrescentado:', n13.length, 'desafios.');
