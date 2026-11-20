// Marca cada desafio de data/questions.json com o módulo do curso Conceitos Básicos de Redes em que o assunto aparece
// (pelas notas de docs/mapa-curso.md) e gera docs/revisao-quiz.md, a lista para conferir os desafios contra o curso.
// modulo 0 = conteúdo bônus, além do curso. Idempotente.
import { readFileSync, writeFileSync } from 'node:fs';

const caminho = new URL('../data/questions.json', import.meta.url);
const perguntas = JSON.parse(readFileSync(caminho, 'utf8'));
const modulos = JSON.parse(readFileSync(new URL('../data/modulos.json', import.meta.url), 'utf8'));

const POR_ASSUNTO = {
  'Internet': 1, 'Tipos de rede': 1, 'Unidades de velocidade': 1, 'Largura de banda e taxa real': 1, 'Latência': 1,
  'Tecnologias sem fio': 3, 'Privacidade de dados': 1, 'Segurança Wi-Fi': 3, 'Wi-Fi público': 3,
  'Componentes da infraestrutura': 2, 'Cliente e servidor': 2, 'Redes ponto a ponto': 2, 'Roteador doméstico': 4,
  'Roteador doméstico: portas LAN e WAN': 4, 'Meios físicos': 6, 'Interferência sem fio': 4, 'Conexões com o provedor': 2,
  'Escolha do meio de transmissão': 6,
  'Protocolos': 5, 'Características de protocolos': 5, 'Modelo OSI': 5, 'Modelo TCP/IP': 5, 'OSI x TCP/IP': 5,
  'Funções por camada OSI': 5, 'Padronização da Internet': 5, 'Modelo em camadas': 5, 'Interoperabilidade': 5,
  'Encaminhamento do switch': 7, 'Endereço MAC': 7, 'Quadro Ethernet': 7, 'Subcamadas do enlace de dados': 0,
  'Aprendizado de endereços': 7, 'Decisão do switch': 7, 'Tipos de comunicação': 9, 'Full-duplex': 7, 'Formato do endereço MAC': 7,
  'Tamanho do endereço IPv4': 8, 'Binário para decimal': 8, 'Endereços públicos, privados e especiais': 9, 'Máscara e prefixo': 8,
  'Função da máscara': 8, 'Endereço 169.254.x.x': 9, 'Tamanho das redes': 8, 'Endereço de broadcast': 9, 'Mesma rede ou não': 8,
  'Bits de host': 9, 'Hosts úteis': 9, 'Máscara de um prefixo': 9, 'Prefixo e hosts úteis': 9, 'Em que sub-rede o host está': 9,
  'Escolha do prefixo': 9, 'Quantidade de sub-redes': 9, 'Planejamento com VLSM': 0, 'Endereço de rede': 9,
  'Tamanho do endereço IPv6': 10, 'Por que o IPv6': 10, 'Formato do endereço': 10, 'Abreviação de endereços': 10,
  'Tipos de endereço IPv6': 10, 'Broadcast no IPv6': 10, 'Prefixo de uma LAN IPv6': 0, 'Prefixos IPv6': 0, 'Estrutura do global unicast': 0,
  'Função do DHCP': 11, 'Etapas do DHCP': 12, 'DHCPDISCOVER em broadcast': 12, 'Porta do servidor DHCP': 15, 'Tempo de concessão': 11,
  'Por que usar NAT': 12, 'Tipos de NAT': 0, 'DHCP ou NAT': 12, 'Informações entregues pelo DHCP': 11,
  'Função do ARP': 13, 'Passos do ARP': 13, 'ARP e o gateway': 13, 'TTL': 0, 'Tipos de rota': 14, 'Prefixo mais específico': 0,
  'Direto ou pelo gateway': 14, 'Sem gateway padrão': 12, 'Roteador sem rota': 14,
  'TCP': 15, 'TCP ou UDP': 15, 'Three-way handshake': 0, 'Portas conhecidas': 15, 'Quantidade de portas': 15, 'Função da porta': 15,
  'Soquete': 15, 'Confiabilidade do TCP': 15, 'Faixas de portas': 15,
  'Função do DNS': 16, 'Consulta DNS': 16, 'Registros DNS': 0, 'Protocolos de aplicação': 16, 'Porta do FTP': 16, 'HTTP e HTTPS': 16,
  'Cache DNS': 0, 'Diagnóstico de DNS': 17, 'SSH e Telnet': 16,
  'Método de diagnóstico': 17, 'Ferramentas de diagnóstico': 17, 'Sintoma e camada': 0, 'Começar pela camada física': 0,
  'Estratégias de diagnóstico': 0, 'Ping de loopback': 9, 'Isolando o ponto da falha': 17, 'Primeiro passo do diagnóstico': 17,
  'Conflito de endereço IP': 17,
  'Tipos de ameaça': 0, 'Phishing': 0, 'Firewall': 0, 'Confidencialidade, integridade e disponibilidade': 0,
  'Senhas e autenticação': 0, 'Resposta a um dispositivo infectado': 0, 'Regra 3-2-1 de backup': 0, 'VPN': 3, 'Atualizações': 0
};

const semMapa = perguntas.filter(q => !(q.assunto in POR_ASSUNTO)).map(q => `${q.id} (${q.assunto})`);
if (semMapa.length) throw new Error('Assuntos sem módulo: ' + semMapa.join(', '));
const marcadas = perguntas.map(q => ({ ...q, modulo: POR_ASSUNTO[q.assunto] }));
writeFileSync(caminho, JSON.stringify(marcadas, null, 2) + '\n');

// Lista de revisão: agrupada por módulo, com a resposta certa, para conferir com o material do curso.
const resposta = q => {
  switch (q.tipo) {
    case 'pergunta': return q.alternativas[q.correta];
    case 'numero': return `${q.resposta}${q.unidade ? ' ' + q.unidade : ''}`;
    case 'ordenar': return q.itens.join(' → ');
    case 'ligar': return q.pares.map(p => `${p.esquerda} = ${p.direita}`).join('; ');
    case 'classificar': return q.itens.map(i => `${i.texto} → ${q.grupos[i.grupo]}`).join('; ');
    default: return '';
  }
};
let md = '# Revisão do quiz contra o curso\n\nGerado por `tools/marcar-modulos.mjs`. Os desafios foram escritos para o jogo (não são cópia do curso) e o módulo foi atribuído pelas notas de `docs/mapa-curso.md`. Ao estudar cada módulo no NetAcad, confira a resposta e a explicação e marque a caixa. Encontrou algo errado? Anote o id do desafio.\n\n"Bônus" = assunto que vai além do curso Conceitos Básicos de Redes.\n';
for (const m of [...modulos, { id: 0, nome: 'Bônus (além do curso)' }]) {
  const lista = marcadas.filter(q => q.modulo === m.id);
  if (!lista.length) continue;
  md += `\n## ${m.id ? `Módulo ${m.id} — ` : ''}${m.nome} (${lista.length})\n\n`;
  for (const q of lista) md += `- [ ] \`${q.id}\` **${q.enunciado}**\n  - Resposta: ${resposta(q)}\n  - Explicação: ${q.explicacao}\n`;
}
writeFileSync(new URL('../docs/revisao-quiz.md', import.meta.url), md);
const cont = {};
for (const q of marcadas) cont[q.modulo] = (cont[q.modulo] ?? 0) + 1;
console.log('Desafios por módulo:', JSON.stringify(cont));
