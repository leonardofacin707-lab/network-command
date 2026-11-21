// Converte o conteúdo original da v0.1 (tests/fixtures/legado.json) para o formato de dados do Network Command.
// Rode uma única vez: depois disso os arquivos em data/ passam a ser editados à mão.
// Por segurança, recusa sobrescrever data/questions.json sem --forcar.
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const destinoPerguntas = new URL('data/questions.json', raiz);
// Sem --forcar, a gravação usa a flag 'wx' (falha se o arquivo já existe), sem checar antes e gravar depois.
const FLAG = process.argv.includes('--forcar') ? 'w' : 'wx';

const legado = JSON.parse(readFileSync(new URL('tests/fixtures/legado.json', raiz), 'utf8'));

// assunto e dificuldade (1 a 3) de cada desafio, na ordem original de cada nível
const META = {
  1: { categoria: 'fundamentos', prefixo: 'fundamentos', inicio: 1, itens: [
    ['Internet', 1], ['Tipos de rede', 1], ['Unidades de velocidade', 1], ['Largura de banda e taxa real', 2], ['Latência', 1],
    ['Tecnologias sem fio', 2], ['Privacidade de dados', 1], ['Segurança Wi-Fi', 2], ['Wi-Fi público', 1]] },
  2: { categoria: 'fundamentos', prefixo: 'fundamentos', inicio: 10, itens: [
    ['Componentes da infraestrutura', 1], ['Cliente e servidor', 1], ['Redes ponto a ponto', 2], ['Roteador doméstico', 1],
    ['Roteador doméstico: portas LAN e WAN', 2], ['Meios físicos', 1], ['Interferência sem fio', 2], ['Conexões com o provedor', 2],
    ['Escolha do meio de transmissão', 2]] },
  3: { categoria: 'osi-tcpip', prefixo: 'osi-tcpip', inicio: 1, itens: [
    ['Protocolos', 1], ['Características de protocolos', 2], ['Modelo OSI', 2], ['Modelo TCP/IP', 2], ['OSI x TCP/IP', 3],
    ['Funções por camada OSI', 2], ['Padronização da Internet', 2], ['Modelo em camadas', 1], ['Interoperabilidade', 2]] }
};

const rotuloId = (prefixo, n) => `${prefixo}-${String(n).padStart(3, '0')}`;
const perguntas = [];
const niveis = [];

for (const nivel of legado) {
  const meta = META[nivel.id];
  const ids = [];
  (nivel.desafios || []).forEach((d, i) => {
    const [assunto, dificuldade] = meta.itens[i];
    const base = {
      id: rotuloId(meta.prefixo, meta.inicio + i), nivel: nivel.id,
      tipo: d.tipo === 'quiz' ? 'pergunta' : d.tipo, categoria: meta.categoria, assunto, dificuldade,
      habilidade: 'fundamentos.teoria', enunciado: d.pergunta
    };
    let carga;
    switch (d.tipo) {
      case 'quiz': carga = { alternativas: d.opcoes, correta: d.certa }; break;
      case 'ligar': carga = { pares: d.pares.map(([esquerda, direita]) => ({ esquerda, direita })) }; break;
      case 'classificar': carga = { grupos: d.grupos, itens: d.itens.map(([texto, grupo]) => ({ texto, grupo })) }; break;
      case 'ordenar': carga = { itens: d.itens }; break;
      case 'numero': carga = { resposta: d.resposta, unidade: d.unidade || '', dica: d.dica }; break;
      default: throw new Error('tipo desconhecido: ' + d.tipo);
    }
    perguntas.push({ ...base, ...carga, explicacao: d.explica });
    ids.push(base.id);
  });
  const entrada = { id: nivel.id, nome: nivel.nome, icone: nivel.icone, modulos: nivel.modulos };
  if (meta) { entrada.categoria = meta.categoria; entrada.resumo = nivel.resumo; entrada.desafios = ids; }
  niveis.push(entrada);
}

try {
  writeFileSync(destinoPerguntas, JSON.stringify(perguntas, null, 2) + '\n', { flag: FLAG });
  writeFileSync(new URL('data/levels.json', raiz), JSON.stringify(niveis, null, 2) + '\n', { flag: FLAG });
} catch (e) {
  if (e.code !== 'EEXIST') throw e;
  console.error('data/questions.json já existe. Use --forcar para sobrescrever (edições manuais serão perdidas).');
  process.exit(1);
}
console.log(`Perguntas: ${perguntas.length} | Níveis: ${niveis.length}`);
