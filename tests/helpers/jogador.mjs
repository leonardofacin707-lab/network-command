// Robô jogador: resolve os desafios pela interface (cliques e digitação), como uma pessoa faria.
// As respostas certas vêm de tests/fixtures/legado.json, o conteúdo original congelado do jogo (v0.1).
// Assim, o mesmo robô valida a versão original e a refatorada: se uma resposta que valia antes deixar
// de valer, o teste quebra.
import { readFileSync } from 'node:fs';

export const legado = JSON.parse(readFileSync(new URL('../fixtures/legado.json', import.meta.url), 'utf8'));

const exato = texto => new RegExp('^\\s*' + texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');

/** falha: 'errar' (pergunta) ou 'par-errado' (ligar): provoca um erro de propósito antes de acertar. */
async function resolver(pagina, d, falha) {
  switch (d.tipo) {
    case 'quiz': {
      // "errar" clica em qualquer alternativa que não seja a certa (os distratores foram reescritos na 1.5)
      const certa = pagina.locator('.op').filter({ hasText: exato(d.opcoes[d.certa]) });
      await (falha === 'errar' ? pagina.locator('.op').filter({ hasNotText: exato(d.opcoes[d.certa]) }).first() : certa).click();
      break;
    }
    case 'ligar':
      if (falha === 'par-errado') {
        await pagina.locator('[data-esq]').filter({ hasText: exato(d.pares[0][0]) }).click();
        await pagina.locator('[data-dir]').filter({ hasText: exato(d.pares[1][1]) }).click();
      }
      for (const [esquerda, direita] of d.pares) {
        await pagina.locator('[data-esq]').filter({ hasText: exato(esquerda) }).click();
        await pagina.locator('[data-dir]').filter({ hasText: exato(direita) }).click();
      }
      break;
    case 'classificar':
      for (const [texto, grupo] of d.itens) {
        await pagina.locator('#pool .chip').filter({ hasText: exato(texto) }).click();
        await pagina.locator(process.env.ALVO === 'legacy'
          ? `.grupo[data-grupo="${grupo}"] b` : `.grupo-cab[data-grupo="${grupo}"]`).first().click();
      }
      break;
    case 'ordenar':
      for (const texto of d.itens) await pagina.locator('[data-ord]').filter({ hasText: exato(texto) }).click();
      break;
    case 'numero':
      await pagina.fill('#resp-num', String(d.resposta));
      await pagina.locator('#form-num button[type=submit]').click();
      break;
    default:
      throw new Error(`Tipo de desafio desconhecido: ${d.tipo}`);
  }
}

export async function abrirJogo(pagina, base, alvo) {
  await pagina.goto(base + alvo);
  await pagina.locator('.no').first().waitFor();
}

export async function abrirNivel(pagina, id) {
  const voltar = pagina.locator('[data-acao="mapa"]');
  if (await voltar.count()) await voltar.first().click();
  await pagina.locator(`.no[data-nivel="${id}"]`).click();
  await pagina.locator('.card').waitFor();
}

/** Joga um nível inteiro. falhas = { indiceDoDesafio: 'errar' | 'par-errado' }. aoAbrir roda a cada desafio. */
export async function jogarNivel(pagina, id, { falhas = {}, aoAbrir } = {}) {
  await abrirNivel(pagina, id);
  const desafios = legado.find(n => n.id === id).desafios;
  for (let i = 0; i < desafios.length; i++) {
    if (aoAbrir) await aoAbrir(i, desafios[i]);
    await resolver(pagina, desafios[i], falhas[i]);
    await pagina.locator('#feedback .fb').waitFor();
    await pagina.locator('[data-acao="proximo"]').click();
  }
  return lerResultado(pagina);
}

export async function lerResultado(pagina) {
  await pagina.locator('.resultado').waitFor();
  const [pontos, acertos, melhor] = await pagina.locator('.resumo b').allInnerTexts();
  const estrelas = await pagina.locator('.grandes').getAttribute('aria-label');
  return { pontos, acertos, melhor, estrelas };
}

export async function lerHud(pagina) {
  const [cargo, xp, estrelas] = await pagina.locator('#hud b').allInnerTexts();
  return { cargo, xp, estrelas };
}

export const voltarAoMapa = async pagina => {
  await pagina.locator('[data-acao="mapa"]').first().click();
  await pagina.locator('.no').first().waitFor();
};

export const larguraExcedente = pagina =>
  pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

export const nosSobrepostos = pagina => pagina.evaluate(() => {
  const r = [...document.querySelectorAll('.no')].map(n => n.getBoundingClientRect());
  let c = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) c++;
  }
  return c;
});
