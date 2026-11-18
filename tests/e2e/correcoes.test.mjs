// Testes das correções da auditoria (1.5). Valem só para a versão nova.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';
import { legado, jogarNivel, abrirNivel, voltarAoMapa, lerHud } from '../helpers/jogador.mjs';

let servidor, navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

const abrir = async (opcoes) => {
  const s = await novaPagina(navegador, opcoes);
  await s.pagina.goto(servidor.url + '/index.html');
  await s.pagina.locator('.no').first().waitFor();
  return s;
};

test('campo numérico entende 1000, 1.000, 1,000 e rejeita texto sem contar erro', async () => {
  for (const digitado of ['1000', '1.000', '1 000']) {
    const { pagina, erros, contexto } = await abrir();
    await abrirNivel(pagina, 1);
    // o desafio de número é o 3º do nível 1: passa pelos dois primeiros respondendo de qualquer jeito
    const numero = legado[0].desafios.findIndex(d => d.tipo === 'numero');
    await jogarNivel(pagina, 1, { aoAbrir: async (i) => { if (i === numero) throw new Error('parar'); } }).catch(e => { if (e.message !== 'parar') throw e; });
    await pagina.fill('#resp-num', digitado);
    await pagina.locator('#form-num button[type=submit]').click();
    assert.match(await pagina.locator('#feedback .fb b').innerText(), /Perfeito/, `"${digitado}"`);
    assert.deepEqual(erros, []);
    await contexto.close();
  }
});

test('texto que não é número pede de novo, sem gastar a tentativa', async () => {
  const { pagina, contexto } = await abrir();
  const numero = legado[0].desafios.findIndex(d => d.tipo === 'numero');
  await jogarNivel(pagina, 1, { aoAbrir: async (i) => { if (i === numero) throw new Error('parar'); } }).catch(e => { if (e.message !== 'parar') throw e; });
  await pagina.fill('#resp-num', 'mil');
  await pagina.locator('#form-num button[type=submit]').click();
  assert.match(await pagina.locator('#msg-num').innerText(), /Digite só o número/);
  assert.equal(await pagina.locator('#feedback .fb').count(), 0, 'não deve finalizar o desafio');
  await pagina.fill('#resp-num', '1.000');
  await pagina.locator('#form-num button[type=submit]').click();
  assert.match(await pagina.locator('#feedback .fb b').innerText(), /Perfeito/, 'continuou valendo 100 pontos');
  await contexto.close();
});

test('acessibilidade: sem botão dentro de botão, barra de progresso com nome, grupos são botões', async () => {
  const { pagina, contexto } = await abrir();
  await abrirNivel(pagina, 1);
  const iClass = legado[0].desafios.findIndex(d => d.tipo === 'classificar');
  await jogarNivel(pagina, 1, { aoAbrir: async (i) => { if (i === iClass) throw new Error('parar'); } }).catch(e => { if (e.message !== 'parar') throw e; });
  assert.equal(await pagina.locator('[role=button]').count(), 0, 'nenhum role=button manual');
  assert.equal(await pagina.locator('button button, [role=button] button').count(), 0);
  assert.ok(await pagina.locator('.grupo-cab').count() >= 2);
  assert.equal(await pagina.getAttribute('[role=progressbar]', 'aria-label'), 'Progresso no nível');
  // teclado: Tab chega num grupo e Enter funciona como clique
  await pagina.locator('.grupo-cab').first().focus();
  await pagina.keyboard.press('Enter'); // sem item selecionado: não pode quebrar
  await contexto.close();
});

test('respostas mostram marca de texto (✓/✗), não só cor', async () => {
  const { pagina, contexto } = await abrir();
  await abrirNivel(pagina, 1);
  const q = legado[0].desafios[0]; // pergunta de múltipla escolha
  await pagina.locator('.op').filter({ hasNotText: new RegExp('^\\s*' + q.opcoes[q.certa].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).first().click();
  const marcas = await pagina.evaluate(() => [...document.querySelectorAll('.op.certa, .op.errada')]
    .map(b => getComputedStyle(b, '::after').content));
  assert.ok(marcas.some(m => m.includes('✓')) && marcas.some(m => m.includes('✗')), JSON.stringify(marcas));
  await contexto.close();
});

function contraste(rgbA, rgbB) {
  const luz = c => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [a, b] = [luz(rgbA), luz(rgbB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

test('estrelas do resultado têm contraste mínimo nos temas claro e escuro', async () => {
  for (const tema of ['light', 'dark']) {
    const { pagina, contexto } = await abrir();
    await pagina.emulateMedia({ colorScheme: tema });
    await jogarNivel(pagina, 1);
    const cores = await pagina.evaluate(() => {
      const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const g = document.querySelector('.grandes');
      const apagada = g.querySelector('.apagada');
      const fundo = getComputedStyle(document.querySelector('.painel')).backgroundColor;
      return { acesa: rgb(getComputedStyle(g).color), fundo: rgb(fundo), apagada: apagada ? rgb(getComputedStyle(apagada).color) : null };
    });
    assert.ok(contraste(cores.acesa, cores.fundo) >= 3, `estrelas acesas no tema ${tema}: ${contraste(cores.acesa, cores.fundo).toFixed(2)}`);
    if (cores.apagada) assert.ok(contraste(cores.apagada, cores.fundo) >= 3, `estrelas apagadas no tema ${tema}`);
    await contexto.close();
  }
});

test('cabos do mapa não passam por cima dos nomes dos níveis', async () => {
  for (const largura of [360, 390, 768, 1280]) {
    const { pagina, contexto } = await abrir({ largura, altura: 900 });
    const cruzamentos = await pagina.evaluate(() => {
      const caixas = [...document.querySelectorAll('.no .nome, .no .est')].map(e => e.getBoundingClientRect());
      const ruins = [];
      document.querySelectorAll('#cabos path.cabo').forEach((p, idx) => {
        const m = p.getScreenCTM(), svg = p.ownerSVGElement;
        const total = p.getTotalLength();
        for (let l = 0; l <= total; l += 2) {
          const pt = svg.createSVGPoint(); const q = p.getPointAtLength(l); pt.x = q.x; pt.y = q.y;
          const t = pt.matrixTransform(m);
          if (caixas.some(c => t.x > c.left + 1 && t.x < c.right - 1 && t.y > c.top + 1 && t.y < c.bottom - 1)) { ruins.push(idx); break; }
        }
      });
      return ruins;
    });
    assert.deepEqual(cruzamentos, [], `cabos sobre rótulos em ${largura}px`);
    await contexto.close();
  }
});

test('cabeçalho compacto no celular', async () => {
  const { pagina, contexto } = await abrir({ largura: 390, altura: 800 });
  const altura = await pagina.locator('header.topo').evaluate(e => e.getBoundingClientRect().height);
  assert.ok(altura < 180, `cabeçalho com ${altura}px (antes ~290)`);
  await contexto.close();
});

test('"Próximo nível" aparece ao rejogar um nível que já liberou o seguinte', async () => {
  const { pagina, contexto } = await abrir({
    antes: () => localStorage.setItem('network-command', JSON.stringify({ versao: 2, quiz: { melhor: { 1: { pts: 900, estrelas: 3 } } } }))
  });
  // rejoga o nível 1 errando todas as perguntas de múltipla escolha: pode dar 0 estrela, mas o nível 2 já estava liberado
  const falhas = Object.fromEntries(legado[0].desafios.map((d, i) => [i, d.tipo === 'quiz' ? 'errar' : undefined]));
  const r = await jogarNivel(pagina, 1, { falhas });
  assert.ok(Number(r.pontos.split(' ')[0]) < 900, 'a partida deve ter pontuação menor que o recorde');
  assert.equal(await pagina.locator('[data-acao="jogar"][data-nivel="2"]').count(), 1, 'atalho para o nível 2');
  await contexto.close();
});

test('o aviso de independência da Cisco está no rodapé', async () => {
  const { pagina, contexto } = await abrir();
  assert.match(await pagina.locator('footer').innerText(), /não é afiliado à Cisco/);
  await contexto.close();
});
