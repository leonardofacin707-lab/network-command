// Empresa (Fase 6, protótipo): planejamento de sub-redes e equipamentos.
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
  s.prefixo = (id, v) => s.pagina.selectOption(`#p-${id}`, String(v));
  s.qtd = async (id, v) => { await s.pagina.fill(`#q-${id}`, String(v)); await s.pagina.press(`#q-${id}`, 'Tab'); };
  s.itens = () => s.pagina.locator('#e-itens').innerText();
  return s;
}

test('lista: 3 projetos, nenhum iniciado, e o menu marca Empresa como protótipo', async () => {
  const { pagina, erros, contexto } = await abrir('empresa');
  assert.equal(await pagina.locator('.missao').count(), 3);
  assert.match(await pagina.locator('#app').innerText(), /0 de 3 projetos aprovados/);
  assert.match(await pagina.locator('#app').innerText(), /planejamento/);
  assert.match(await pagina.locator('.menu a[data-rota="empresa"]').innerText(), /protótipo|proto/i);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('escritório: pendências aparecem, a faixa é calculada e o plano certo é aprovado com XP único', async () => {
  const s = await abrir('empresa/escritorio-contabil');
  const { pagina, erros } = s;
  assert.equal(await pagina.locator('#e-aprovar').isDisabled(), true);
  assert.match(await s.itens(), /escolha um prefixo \(precisa de 16 endereços\)/);
  await s.prefixo('administrativo', 27);
  await s.prefixo('financeiro', 28);
  await s.prefixo('atendimento', 27);
  assert.match(await s.itens(), /Cabem no bloco 192\.168\.10\.0\/24/);
  // faixas: /27 e /27 primeiro (maiores), depois /28
  assert.match(await pagina.locator('[data-faixa="administrativo"]').innerText(), /192\.168\.10\.0\/27 · 192\.168\.10\.1 – 192\.168\.10\.30/);
  assert.match(await pagina.locator('[data-faixa="atendimento"]').innerText(), /192\.168\.10\.32\/27/);
  assert.match(await pagina.locator('[data-faixa="financeiro"]').innerText(), /192\.168\.10\.64\/28/);
  // equipamentos: ainda sem portas e sem roteador
  assert.equal(await pagina.locator('#e-aprovar').isDisabled(), true);
  await s.qtd('switch8', 5);
  await s.qtd('roteador', 1);
  assert.match(await s.itens(), /35 portas úteis \(40 − 5 de enlace\) para 38/);
  assert.equal(await pagina.locator('#e-aprovar').isDisabled(), true, '35 < 38');
  await s.qtd('switch8', 6);
  assert.equal(await pagina.locator('#e-aprovar').isDisabled(), false);
  await pagina.locator('#e-aprovar').click();
  assert.match(await pagina.locator('#e-msg').innerText(), /Projeto aprovado! \+150 XP/);
  const e = await s.salvo();
  assert.equal(e.empresa['escritorio-contabil'].concluida, true);
  assert.equal(e.empresa['escritorio-contabil'].xp, 150);
  assert.deepEqual(e.empresa['escritorio-contabil'].prefixos, { administrativo: 27, financeiro: 28, atendimento: 27 });
  assert.match(await pagina.locator('#hud').innerText(), /150/);
  assert.ok(e.conquistas.planejador);
  await pagina.locator('#e-aprovar').click();
  assert.match(await pagina.locator('#e-msg').innerText(), /já tinha sido recebido/);
  assert.equal((await s.salvo()).empresa['escritorio-contabil'].xp, 150);
  assert.deepEqual(erros, []);
  await s.contexto.close();
});

test('erros de dimensionamento são explicados: sub-rede pequena, estouro de bloco e orçamento', async () => {
  const s = await abrir('empresa/filial-apertada');
  const { pagina } = s;
  await s.prefixo('vendas', 27);
  assert.match(await s.itens(), /\/27 oferece 30 hosts, mas são necessários 31/);
  await s.prefixo('vendas', 25);
  await s.prefixo('estoque', 28); await s.prefixo('ti', 28); await s.prefixo('caixa', 29);
  assert.match(await s.itens(), /Cabem no bloco 172\.16\.5\.0\/25[\s\S]*não cabem/);
  assert.match(await pagina.locator('#e-avisos').innerText(), /Vendas: \/25 é muito maior/);
  await s.prefixo('vendas', 26);
  assert.match(await s.itens(), /104 de 128 endereços usados/);
  await s.qtd('switch24', 3); await s.qtd('roteador', 1);
  assert.match(await s.itens(), /custo 3300 de 2600/);
  assert.equal(await pagina.locator('#e-aprovar').isDisabled(), true);
  await s.contexto.close();
});

test('o plano sobrevive ao recarregar e "Limpar plano" pede confirmação', async () => {
  const s = await abrir('empresa/clinica');
  const { pagina } = s;
  await s.prefixo('recepcao', 28);
  await s.qtd('switch24', 1);
  await pagina.reload();
  await pagina.locator('#e-itens').waitFor();
  assert.equal(await pagina.inputValue('#p-recepcao'), '28');
  assert.equal(await pagina.inputValue('#q-switch24'), '1');
  await pagina.locator('#e-reiniciar-btn').click();
  await pagina.locator('#e-reiniciar-nao').click();
  assert.equal(await pagina.inputValue('#p-recepcao'), '28');
  await pagina.locator('#e-reiniciar-btn').click();
  await pagina.locator('#e-reiniciar-sim').click();
  assert.equal(await pagina.inputValue('#p-recepcao'), '');
  assert.equal(await pagina.inputValue('#q-switch24'), '');
  assert.deepEqual((await s.salvo()).empresa.clinica.prefixos, {});
  await s.contexto.close();
});

test('entradas estranhas na quantidade viram números válidos; projeto inexistente avisa; estado adulterado é saneado', async () => {
  let s = await abrir('empresa/clinica');
  await s.qtd('switch8', -4);
  assert.equal(await s.pagina.inputValue('#q-switch8'), '');
  await s.qtd('switch8', 9999);
  assert.equal(await s.pagina.inputValue('#q-switch8'), '50');
  await s.qtd('switch8', '2.9');
  assert.equal(await s.pagina.inputValue('#q-switch8'), '2');
  await s.contexto.close();

  s = await abrir('empresa/nao-existe');
  assert.match(await s.pagina.locator('#app').innerText(), /Projeto não encontrado/);
  await s.contexto.close();

  s = await novaPagina(navegador);
  await s.pagina.addInitScript(() => localStorage.setItem('network-command', JSON.stringify({ versao: 4, empresa: {
    clinica: { prefixos: { recepcao: 99, consultorios: 27 }, equip: { switch8: -1, roteador: 2 }, concluida: true, xp: 99999, em: 'x' }, fantasma: { concluida: true, xp: 5 } } })));
  await s.pagina.goto(`${servidor.url}/index.html#/empresa/clinica`);
  await s.pagina.locator('#e-itens').waitFor();
  assert.equal(await s.pagina.inputValue('#p-recepcao'), '', 'prefixo inválido (99) foi descartado');
  assert.equal(await s.pagina.inputValue('#p-consultorios'), '27');
  assert.equal(await s.pagina.locator('#e-situacao').innerText(), '', 'XP inventado não vale como aprovação');
  await s.pagina.selectOption('#p-recepcao', '28'); // qualquer mudança regrava o estado já saneado
  const e = await s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  assert.deepEqual(Object.keys(e.empresa), ['clinica']);
  assert.equal(e.empresa.clinica.xp, 0);
  assert.deepEqual(e.empresa.clinica.prefixos, { recepcao: 28, consultorios: 27 });
  assert.deepEqual(s.erros, []);
  await s.contexto.close();
});

test('tabelas têm cabeçalhos, campos têm rótulos e o celular não rola na horizontal', async () => {
  const s = await abrir('empresa/clinica', { largura: 390, altura: 800 });
  const { pagina } = s;
  assert.equal(await pagina.locator('select[data-prefixo]').count(), 4);
  for (const sel of await pagina.locator('select[data-prefixo], input[data-equip]').all()) {
    const id = await sel.getAttribute('id');
    assert.equal(await pagina.locator(`label[for="${id}"]`).count(), 1, `${id} sem rótulo`);
  }
  assert.ok(await pagina.locator('th[scope="col"]').count() >= 8);
  const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sobra <= 1, `rolagem horizontal ${sobra}px`);
  await s.contexto.close();
});
