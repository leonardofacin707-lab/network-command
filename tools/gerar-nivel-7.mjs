// Acrescenta o nível 7 (IPv6) ao quiz. Não sobrescreve: se já existir, não faz nada.
import { readFileSync, writeFileSync } from 'node:fs';
const caminho = c => new URL('../data/' + c, import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho('questions.json'), 'utf8'));
const niveis = JSON.parse(readFileSync(caminho('levels.json'), 'utf8'));
if (perguntas.some(p => p.id.startsWith('ipv6-'))) { console.log('Nível 7 já existe; nada a fazer.'); process.exit(0); }

const base = { nivel: 7, categoria: 'ipv6', habilidade: 'ip.teoria' };
const n7 = [
  { id: 'ipv6-001', tipo: 'numero', assunto: 'Tamanho do endereço IPv6', dificuldade: 1,
    enunciado: 'Quantos bits tem um endereço IPv6?', resposta: 128, unidade: 'bits', dica: 'É quatro vezes o tamanho de um endereço IPv4.',
    explicacao: 'Um endereço IPv6 tem 128 bits, escritos como 8 grupos de 16 bits em hexadecimal. O IPv4 tem 32 bits, por isso o espaço de endereços do IPv6 é incomparavelmente maior.' },
  { id: 'ipv6-002', tipo: 'pergunta', assunto: 'Por que o IPv6', dificuldade: 1,
    enunciado: 'Qual é a principal razão para a criação do IPv6?',
    alternativas: ['Os endereços IPv4 estão se esgotando, e o IPv6 oferece um espaço muito maior', 'O IPv4 não funciona em redes sem fio e precisava ser substituído', 'Os cabos novos só aceitam endereços escritos em hexadecimal', 'O IPv6 elimina a necessidade de qualquer equipamento de rede'],
    correta: 0, explicacao: 'O espaço de 32 bits do IPv4 não comporta tantos dispositivos. O IPv6 usa 128 bits, o que permite dar endereços a praticamente qualquer dispositivo, além de simplificar alguns processos de rede.' },
  { id: 'ipv6-003', tipo: 'pergunta', assunto: 'Formato do endereço', dificuldade: 1,
    enunciado: 'Como um endereço IPv6 completo é escrito?',
    alternativas: ['Oito grupos de quatro dígitos hexadecimais separados por dois-pontos', 'Quatro números decimais de 0 a 255 separados por pontos', 'Seis pares de dígitos hexadecimais separados por dois-pontos', 'Um único número decimal de 128 dígitos sem separadores'],
    correta: 0, explicacao: 'Um endereço IPv6 tem 8 grupos de 16 bits (4 dígitos hexadecimais cada), como 2001:0db8:acad:0001:0000:0000:0000:0010. Os quatro números decimais são o formato do IPv4, e os seis pares são o do endereço MAC.' },
  { id: 'ipv6-004', tipo: 'pergunta', assunto: 'Abreviação de endereços', dificuldade: 2,
    enunciado: 'Qual é a forma abreviada correta de 2001:0db8:0000:0000:0000:0000:0000:0001?',
    alternativas: ['2001:db8::1', '2001:db8:1', '2001:db8::0::1', '2001:db8:::1'],
    correta: 0, explicacao: 'Zeros à esquerda de cada grupo podem ser omitidos, e uma sequência de grupos só de zeros pode virar "::", mas uma única vez no endereço. Por isso a forma correta é 2001:db8::1.' },
  { id: 'ipv6-005', tipo: 'classificar', assunto: 'Tipos de endereço IPv6', dificuldade: 3,
    enunciado: 'Que tipo de endereço IPv6 é cada um destes?',
    grupos: ['Global unicast', 'Link-local', 'Multicast', 'Loopback'],
    itens: [
      { texto: '2001:db8:acad:1::10', grupo: 0 },
      { texto: 'fe80::a00:27ff:fe4e:66a1', grupo: 1 },
      { texto: 'fe80::1', grupo: 1 },
      { texto: 'ff02::1', grupo: 2 },
      { texto: 'ff02::2', grupo: 2 },
      { texto: '::1', grupo: 3 }],
    explicacao: 'Global unicast começa com 2000::/3 (o 2001 do exemplo está nele). Link-local começa com fe80::/10 e só vale no enlace local. Multicast começa com ff00::/8. ::1 é o loopback, equivalente ao 127.0.0.1 do IPv4.' },
  { id: 'ipv6-006', tipo: 'pergunta', assunto: 'Broadcast no IPv6', dificuldade: 2,
    enunciado: 'O que o IPv6 usa no lugar do broadcast do IPv4?',
    alternativas: ['Multicast (e também anycast), sem broadcast', 'Um broadcast mais rápido, enviado só aos roteadores', 'Nada: o IPv6 não permite falar com mais de um destino', 'O mesmo broadcast, mas com o endereço ff:ff:ff:ff'],
    correta: 0, explicacao: 'O IPv6 não tem broadcast. Para falar com vários destinos usa multicast, e o anycast entrega ao destino mais próximo de um grupo. Funções que no IPv4 usavam broadcast passam a usar endereços multicast, como o ff02::1 (todos os nós do enlace).' },
  { id: 'ipv6-007', tipo: 'numero', assunto: 'Prefixo de uma LAN IPv6', dificuldade: 2,
    enunciado: 'Qual é o comprimento de prefixo (o número depois da barra) normalmente usado em uma LAN IPv6?', resposta: 64, unidade: 'bits', dica: 'Metade do endereço de 128 bits é a parte da interface.',
    explicacao: 'Em redes locais usa-se /64: 64 bits identificam a rede e 64 bits identificam a interface (host). Isso deixa um espaço gigantesco para hosts em cada sub-rede.' },
  { id: 'ipv6-008', tipo: 'ligar', assunto: 'Prefixos IPv6', dificuldade: 3,
    enunciado: 'Ligue cada prefixo ao seu tipo de endereço.',
    pares: [
      { esquerda: '2000::/3', direita: 'Global unicast' },
      { esquerda: 'fe80::/10', direita: 'Link-local' },
      { esquerda: 'ff00::/8', direita: 'Multicast' },
      { esquerda: '::1/128', direita: 'Loopback' }],
    explicacao: 'Global unicast: 2000::/3 (roteável na Internet). Link-local: fe80::/10 (só no enlace local). Multicast: ff00::/8. O loopback é um único endereço, ::1/128.' },
  { id: 'ipv6-009', tipo: 'ordenar', assunto: 'Estrutura do global unicast', dificuldade: 3,
    enunciado: 'Monte um endereço global unicast com sub-rede /64, da esquerda para a direita.',
    itens: ['Prefixo de roteamento global (48 bits)', 'ID da sub-rede (16 bits)', 'ID da interface (64 bits)'],
    explicacao: 'Os 48 primeiros bits são o prefixo de roteamento global (dado pelo provedor), os 16 seguintes identificam a sub-rede dentro da organização e os 64 últimos identificam a interface. 48 + 16 + 64 = 128 bits.' }
].map(q => ({ ...base, ...q }));

perguntas.push(...n7);
const n = niveis.find(x => x.id === 7);
n.categoria = 'ipv6';
n.resumo = ['Por que o IPv6 existe e como o endereço é escrito', 'Abreviar endereços e reconhecer os tipos', 'Prefixo /64 e a estrutura do global unicast'];
n.desafios = n7.map(q => q.id);
writeFileSync(caminho('questions.json'), JSON.stringify(perguntas, null, 2) + '\n');
writeFileSync(caminho('levels.json'), JSON.stringify(niveis, null, 2) + '\n');
console.log('Nível 7 acrescentado:', n7.length, 'desafios.');
