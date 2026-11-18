// Data Center (Fase 6, protótipo): redundância, disponibilidade, custo.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';

let servidor, navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

async function abrir(rota, opcoes) {
  const s = await novaPagina(navegador, opcoes);
  await s.pagina.goto(`${servidor.url}/index.html#/${rota}`);
  await s.pagina.locator('#app h2').first().waitFor();
  s.salvo = () => s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  s.un = async (id, v) => { await s.pagina.fill(`#u-${id}`, String(v)); await s.pagina.press(`#u-${id}`, 'Tab'); };
  s.plano = async (p) => { for (const [k, v] of Object.entries(p)) await s.un(k, v); };
  s.itens = () => s.pagina.locator('#d-itens').innerText();
  return s;
}

test('lista: 3 desafios, nenhum iniciado, menu como protótipo e aviso de que é cálculo', async () => {
  const { pagina, erros, contexto } = await abrir('datacenter');
  assert.equal(await pagina.locator('.missao').count(), 3);
  assert.match(await pagina.locator('#app').innerText(), /0 de 3 desafios aprovados/);
  assert.match(await pagina.locator('#app').innerText(), /fictícios/);
  assert.match(await pagina.locator('.menu a[data-rota="datacenter"]').innerText(), /protótipo|proto/i);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('loja virtual: o elo fraco aparece, o plano certo é aprovado e o XP é pago uma vez', async () => {
  const s = await abrir('datacenter/loja-virtual');
  const { pagina, erros } = s;
  assert.equal(await pagina.locator('#d-aprovar').isDisabled(), true);
  assert.match(await s.itens(), /falta: .*Switches de acesso/);
  await s.plano({ acesso: 1, agregacao: 1, nucleo: 1, energia: 1, internet: 1 });
  assert.match(await s.itens(), /entrega 99,54\d*% \(\d+(,\d)? h\/ano fora do ar\)/);
  assert.equal(await pagina.locator('#d-aprovar').isDisabled(), true);
  await s.plano({ acesso: 2, energia: 2, internet: 2 });
  assert.match(await pagina.locator('[data-camada-disp="internet"]').innerText(), /99,9996%/, '1 − 0,002² = 99,9996%');
  assert.match(await s.itens(), /96 portas para 40 \(20 servidores, cada um ligado a 2 switches\)/);
  assert.equal(await pagina.locator('#d-aprovar').isDisabled(), false);
  await pagina.locator('#d-aprovar').click();
  assert.match(await pagina.locator('#d-msg').innerText(), /Projeto aprovado! \+150 XP/);
  const e = await s.salvo();
  assert.equal(e.datacenter['loja-virtual'].xp, 150);
  assert.deepEqual(e.datacenter['loja-virtual'].unidades, { acesso: 2, agregacao: 1, nucleo: 1, energia: 2, internet: 2 });
  assert.ok(e.conquistas['alta-disponibilidade']);
  assert.match(await pagina.locator('#hud').innerText(), /150/);
  await pagina.locator('#d-aprovar').click();
  assert.match(await pagina.locator('#d-msg').innerText(), /já tinha sido recebido/);
  assert.equal((await s.salvo()).datacenter['loja-virtual'].xp, 150);
  assert.deepEqual(erros, []);
  await s.contexto.close();
});

test('orçamento e meta: tudo no máximo estoura o orçamento; duplicar tudo cumpre o banco', async () => {
  const s = await abrir('datacenter/sistema-bancario');
  await s.plano({ acesso: 4, agregacao: 4, nucleo: 4, energia: 4, internet: 4 });
  assert.match(await s.itens(), /custo 160\.000 de 85\.000/);
  assert.equal(await s.pagina.locator('#d-aprovar').isDisabled(), true);
  await s.plano({ acesso: 2, agregacao: 2, nucleo: 2, energia: 2, internet: 2 });
  assert.equal(await s.pagina.locator('#d-aprovar').isDisabled(), false);
  await s.plano({ internet: 1 });
  assert.equal(await s.pagina.locator('#d-aprovar').isDisabled(), true, 'um elo fraco derruba a meta');
  await s.contexto.close();
});

test('o plano sobrevive ao recarregar, limpar pede confirmação e entradas estranhas são corrigidas', async () => {
  const s = await abrir('datacenter/pronto-socorro');
  const { pagina } = s;
  await s.un('acesso', 2);
  await pagina.reload();
  await pagina.locator('#d-itens').waitFor();
  assert.equal(await pagina.inputValue('#u-acesso'), '2');
  await s.un('acesso', 99);
  assert.equal(await pagina.inputValue('#u-acesso'), '4');
  await s.un('acesso', -3);
  assert.equal(await pagina.inputValue('#u-acesso'), '0');
  await s.un('acesso', '2.9');
  assert.equal(await pagina.inputValue('#u-acesso'), '2');
  await pagina.locator('#d-reiniciar-btn').click();
  await pagina.locator('#d-reiniciar-nao').click();
  assert.equal(await pagina.inputValue('#u-acesso'), '2');
  await pagina.locator('#d-reiniciar-btn').click();
  await pagina.locator('#d-reiniciar-sim').click();
  assert.equal(await pagina.inputValue('#u-acesso'), '');
  assert.deepEqual((await s.salvo()).datacenter['pronto-socorro'].unidades, {});
  await s.contexto.close();
});

test('desafio inexistente avisa; estado adulterado não concede aprovação', async () => {
  let s = await abrir('datacenter/nao-existe');
  assert.match(await s.pagina.locator('#app').innerText(), /Desafio não encontrado/);
  await s.contexto.close();

  s = await novaPagina(navegador);
  await s.pagina.addInitScript(() => localStorage.setItem('network-command', JSON.stringify({ versao: 4, datacenter: {
    'loja-virtual': { unidades: { acesso: 99, energia: 2 }, concluida: true, xp: 99999, em: 'x' }, fantasma: { concluida: true, xp: 5 } } })));
  await s.pagina.goto(`${servidor.url}/index.html#/datacenter/loja-virtual`);
  await s.pagina.locator('#d-itens').waitFor();
  assert.equal(await s.pagina.inputValue('#u-acesso'), '', 'valor 99 descartado');
  assert.equal(await s.pagina.inputValue('#u-energia'), '2');
  assert.equal(await s.pagina.locator('#d-situacao').innerText(), '');
  assert.deepEqual(s.erros, []);
  await s.contexto.close();
});

test('acessibilidade e celular: rótulos, cabeçalhos e sem rolagem horizontal', async () => {
  const s = await abrir('datacenter/loja-virtual', { largura: 390, altura: 800 });
  const { pagina } = s;
  for (const inp of await pagina.locator('input[data-camada]').all()) {
    const id = await inp.getAttribute('id');
    assert.equal(await pagina.locator(`label[for="${id}"]`).count(), 1, `${id} sem rótulo`);
  }
  assert.equal(await pagina.locator('input[data-camada]').count(), 5);
  assert.ok(await pagina.locator('th[scope="col"]').count() >= 5);
  const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sobra <= 1, `rolagem horizontal ${sobra}px`);
  await s.contexto.close();
});
