// Tela inicial ("Jogar"), engrenagem de Configurações, tutorial guiado e sincronização entre aparelhos.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';

let servidor, navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

async function abrir(rota = '', opcoes) {
  const s = await novaPagina(navegador, opcoes);
  await s.pagina.goto(servidor.url + '/index.html' + (rota ? '#/' + rota : ''));
  await s.pagina.locator('#app h2').first().waitFor();
  s.salvo = () => s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  return s;
}

test('tela inicial: "Jogar" abre os modos de jogo, todos levando a páginas que existem', async () => {
  const { pagina, erros, contexto } = await abrir();
  const jogar = pagina.getByRole('button', { name: 'Jogar' });
  assert.equal(await jogar.getAttribute('aria-expanded'), 'false');
  assert.equal(await pagina.locator('#modos').isVisible(), false);
  await jogar.click();
  assert.equal(await jogar.getAttribute('aria-expanded'), 'true');
  const links = await pagina.locator('#modos a.modo').evaluateAll(as => as.map(a => a.getAttribute('href')));
  assert.ok(links.length >= 8, 'modos de jogo');
  assert.ok(links.includes('#/tutorial'));
  assert.match(await pagina.locator('#modos .modo.destaque').innerText(), /Tutorial[\s\S]*Comece por aqui/);
  for (const href of links) {
    await pagina.goto(servidor.url + '/index.html' + href);
    await pagina.locator('#app h2').first().waitFor();
    assert.doesNotMatch(await pagina.locator('#titulo-pagina').innerText(), /^Início$/, `${href} não caiu na tela inicial`);
  }
  assert.match(await pagina.locator('#app').innerText(), /.+/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('engrenagem no canto superior direito abre Configurações; as preferências valem e ficam salvas', async () => {
  for (const largura of [1280, 375]) {
    const { pagina, erros, salvo, contexto } = await abrir('', { largura, altura: 800 });
    const eng = pagina.getByRole('link', { name: 'Configurações' });
    const caixa = await eng.boundingBox();
    assert.ok(caixa.x + caixa.width > largura - 40 && caixa.y < 80, `canto superior direito em ${largura}px (${caixa.x}, ${caixa.y})`);
    assert.equal(await pagina.locator('.menu a[href="#/config"]').count(), 0, 'Configurações não fica no menu lateral');
    await eng.click();
    await pagina.locator('#form-config').waitFor();
    assert.equal(await eng.getAttribute('aria-current'), 'page');
    assert.match(await pagina.locator('#app').innerText(), /Login|login/);
    await pagina.getByRole('radio', { name: /Reduzir sempre/ }).check();
    await pagina.getByRole('radio', { name: /Dashboard/ }).check();
    await pagina.locator('#cfg-msg', { hasText: 'salva' }).waitFor();
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.movimento), 'reduzir');
    assert.deepEqual((await salvo()).config, { movimento: 'reduzir', inicio: 'dashboard' });
    // ao abrir de novo sem página no endereço, vai direto ao dashboard
    await pagina.goto(servidor.url + '/index.html');
    await pagina.locator('.menu a[data-rota="dashboard"][aria-current=page]').waitFor();
    assert.equal(await pagina.evaluate(() => document.documentElement.dataset.movimento), 'reduzir');
    assert.deepEqual(erros, []);
    await contexto.close();
  }
});

test('tutorial: os passos se marcam sozinhos e o ping confirmado pelo simulador conclui', async () => {
  const { pagina, erros, salvo, contexto } = await abrir('tutorial');
  const disp = id => pagina.locator(`.disp[data-id="${id}"]`);
  const atual = () => pagina.locator('#tut-atual').innerText();
  assert.match(await atual(), /Ligue o PC1 ao switch/);
  assert.equal(await pagina.locator('[data-add]').count(), 0, 'no tutorial não se adicionam dispositivos');
  await pagina.locator('[data-modo="conectar"]').click();
  await disp('pc1').click(); await disp('sw1').click();
  assert.match(await atual(), /Ligue o PC2/);
  await disp('pc2').click(); await disp('sw1').click();
  assert.match(await atual(), /endereço IP ao PC1/);
  await pagina.locator('[data-modo="mover"]').click();
  for (const [pc, ip] of [['pc1', '192.168.1.10'], ['pc2', '192.168.1.20']]) {
    await disp(pc).click();
    await pagina.fill('#cfg-ip-eth0', ip);
    await pagina.fill('#cfg-m-eth0', '255.255.255.0');
    await pagina.locator('#form-cfg button[type=submit]').click();
  }
  assert.match(await atual(), /Teste com ping/);
  // recarregar mantém o que foi feito
  await pagina.reload();
  await pagina.locator('#tut-atual').waitFor();
  assert.match(await atual(), /Teste com ping/);
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'ping 192.168.1.20');
  await pagina.press('#term-entrada', 'Enter');
  await pagina.locator('#tut-atual', { hasText: 'Tutorial concluído' }).waitFor();
  assert.equal(await pagina.locator('#tut-passos li.ok').count(), 5);
  assert.equal((await salvo()).tutorial.concluido, true);
  await pagina.goto(servidor.url + '/index.html#/inicio');
  await pagina.getByRole('button', { name: 'Jogar' }).click();
  assert.match(await pagina.locator('#modos a[href="#/tutorial"]').innerText(), /Concluído/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

const NIVEL1 = async pagina => pagina.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('network-command')).quiz.melhor));

test('sincronizar: código do celular colado no computador junta os dois progressos', async () => {
  const agora = new Date().toISOString();
  const celular = await abrir('', { largura: 390, altura: 844, antes: `localStorage.setItem('network-command', JSON.stringify({ versao: 4, perfil: { nome: 'Leo', criadoEm: '${agora}' }, quiz: { melhor: { 1: { pts: 120, estrelas: 1 } }, historico: [] }, conquistas: {}, config: { movimento: 'reduzir', inicio: 'inicio' } }))` });
  await celular.pagina.goto(servidor.url + '/index.html#/sincronizar');
  await celular.pagina.getByRole('button', { name: 'Gerar código' }).click();
  await celular.pagina.locator('#sinc-saida').waitFor();
  const codigo = await celular.pagina.locator('#sinc-codigo').inputValue();
  assert.match(codigo, /^NC[01]\.[A-Za-z0-9_-]+$/);
  assert.equal(await celular.pagina.locator('#sinc-compartilhar').isVisible(), await celular.pagina.evaluate(() => typeof navigator.share === 'function'), 'compartilhar só aparece se o navegador tiver');

  const pc = await abrir('sincronizar');
  await pc.pagina.fill('#sinc-entrada', 'NC1.isso-nao-e-um-codigo');
  await pc.pagina.getByRole('button', { name: 'Ler código' }).click();
  await pc.pagina.locator('#sinc-msg.ruim-txt').waitFor();
  await pc.pagina.fill('#sinc-entrada', codigo);
  await pc.pagina.getByRole('button', { name: 'Ler código' }).click();
  await pc.pagina.locator('.tabela-sinc').waitFor();
  assert.match(await pc.pagina.locator('.tabela-sinc').innerText(), /Nome de exibição\s+\(sem nome\)\s+Leo/);
  await pc.pagina.getByRole('button', { name: /Juntar os dois/ }).click();
  await pc.pagina.locator('#sinc-msg', { hasText: 'juntados' }).waitFor();
  const salvo = await pc.salvo();
  assert.equal(salvo.perfil.nome, 'Leo');
  assert.deepEqual(await NIVEL1(pc.pagina), ['1']);
  assert.equal(salvo.config.movimento, 'sistema', 'a configuração do celular não veio junto');
  assert.deepEqual([...celular.erros, ...pc.erros], []);
  await celular.contexto.close();
  await pc.contexto.close();
});

test('sincronizar por link: o código sai do endereço e substituir pede confirmação', async () => {
  const origem = await abrir('', { antes: `localStorage.setItem('network-command', JSON.stringify({ versao: 4, perfil: { nome: 'Ana', criadoEm: '${new Date().toISOString()}' }, quiz: { melhor: {}, historico: [] } }))` });
  await origem.pagina.goto(servidor.url + '/index.html#/sincronizar');
  await origem.pagina.getByRole('button', { name: 'Gerar código' }).click();
  await origem.pagina.locator('#sinc-saida').waitFor();
  const codigo = await origem.pagina.locator('#sinc-codigo').inputValue();

  const destino = await abrir('', { antes: `localStorage.setItem('network-command', JSON.stringify({ versao: 4, perfil: { nome: 'Outro', criadoEm: '${new Date().toISOString()}' }, quiz: { melhor: {}, historico: [] } }))` });
  await destino.pagina.goto(servidor.url + '/index.html#/sincronizar/' + codigo);
  await destino.pagina.locator('.tabela-sinc').waitFor();
  assert.equal(await destino.pagina.evaluate(() => location.hash), '#/sincronizar', 'o código não fica no endereço nem no histórico');
  await destino.pagina.getByRole('button', { name: 'Substituir o deste aparelho' }).click();
  await destino.pagina.getByRole('button', { name: 'Cancelar' }).click();
  assert.equal((await destino.salvo()).perfil.nome, 'Outro');
  await destino.pagina.getByRole('button', { name: 'Substituir o deste aparelho' }).click();
  await destino.pagina.getByRole('button', { name: 'Substituir', exact: true }).click();
  await destino.pagina.locator('#sinc-msg', { hasText: 'agora está neste aparelho' }).waitFor();
  assert.equal((await destino.salvo()).perfil.nome, 'Ana');
  assert.deepEqual([...origem.erros, ...destino.erros], []);
  await origem.contexto.close();
  await destino.contexto.close();
});
