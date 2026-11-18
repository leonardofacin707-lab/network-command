// Extrai o conteúdo original (NIVEIS) de legacy/index-v0.1.html para tests/fixtures/legado.json.
// O fixture é o "oráculo" dos testes: ele registra o que o jogo original aceitava como resposta certa.
// Executado uma vez na Fase 1. Não precisa ser repetido, pois o arquivo legado não muda.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('../', import.meta.url);
const html = readFileSync(new URL('legacy/index-v0.1.html', raiz), 'utf8');

const marcador = 'const NIVEIS = ';
const inicio = html.indexOf(marcador);
const fim = html.indexOf('\n];', inicio);
if (inicio < 0 || fim < 0) throw new Error('Não encontrei o bloco NIVEIS no arquivo legado.');

const literal = html.slice(inicio + marcador.length, fim + 3);
// O bloco só contém literais (arrays, objetos e textos); roda isolado em um contexto vazio.
const niveis = vm.runInNewContext(`(${literal.replace(/;\s*$/, '')})`);

const saida = new URL('tests/fixtures/legado.json', raiz);
writeFileSync(saida, JSON.stringify(JSON.parse(JSON.stringify(niveis)), null, 1) + '\n');

const jogaveis = niveis.filter(n => n.desafios);
console.log(`Níveis: ${niveis.length} (${jogaveis.length} jogáveis) | desafios: ${jogaveis.reduce((s, n) => s + n.desafios.length, 0)}`);
