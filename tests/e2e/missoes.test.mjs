// Missões (Fase 5): cenários com defeito, verificação pelo motor, dicas, XP e conquistas.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';

let servidor, navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

async function abrir(rota = 'missoes', opcoes) {
  const s = await novaPagina(navegador, opcoes);
  await s.pagina.goto(`${servidor.url}/index.html#/${rota}`);
  await s.pagina.locator('#app h2').first().waitFor();
  s.salvo = () => s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  s.disp = id => s.pagina.locator(`.disp[data-id="${id}"]`);
  s.hud = () => s.pagina.locator('#hud').innerText();
  return s;
}
async function configurar(pagina, disp, id, campos) {
  await disp(id).click();
  for (const [campo, valor] of Object.entries(campos)) await pagina.fill(campo, valor);
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
}

test('lista: 5 missões, todas não iniciadas, com acesso por teclado e nome acessível', async () => {
  const { pagina, erros, contexto } = await abrir();
  assert.equal(await pagina.locator('.missao').count(), 5);
  assert.match(await pagina.locator('#app').innerText(), /0 de 5 concluídas/);
  assert.match(await pagina.locator('.missao a').first().getAttribute('aria-label'), /O cabo esquecido, Fácil, não iniciada/);
  assert.match(await pagina.locator('.menu a[aria-current=page]').innerText(), /Missões/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('cabo esquecido: verificar falha com motivo, ligar o cabo cumpre e dá XP uma vez só', async () => {
  const { pagina, erros, disp, salvo, hud, contexto } = await abrir('missoes/cabo-esquecido');
  assert.equal(await pagina.locator('[data-add]').count(), 0, 'missão não permite adicionar dispositivos');
  assert.equal(await pagina.locator('[data-acao="ex-lan"]').count(), 0, 'sem exemplos prontos');
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 2);
  assert.match(await pagina.locator('#m-msg').innerText(), /Ainda há objetivos/);
  assert.equal((await salvo()).missoes['cabo-esquecido'].concluida, false);
  // investigar pelo terminal, como o jogador faria
  await disp('pc3').click();
  await pagina.fill('#term-entrada', 'ping 192.168.1.10');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Falha geral|Esgotado/);
  // corrigir: ligar o PC3 ao SW1
  await pagina.locator('[data-modo="conectar"]').click();
  await disp('pc3').click();
  await disp('sw1').click();
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.ok').count(), 2);
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+100 XP/);
  const e = await salvo();
  assert.equal(e.missoes['cabo-esquecido'].concluida, true);
  assert.equal(e.missoes['cabo-esquecido'].xp, 100);
  assert.match(await hud(), /100/);
  assert.ok(e.conquistas['primeira-missao']);
  // verificar de novo não dá XP de novo
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /já foi recebido/);
  assert.equal((await salvo()).missoes['cabo-esquecido'].xp, 100);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('dicas custam XP; o progresso da missão sobrevive ao recarregar', async () => {
  const { pagina, disp, salvo, contexto } = await abrir('missoes/ip-duplicado');
  await pagina.locator('#m-dica').click();
  assert.equal(await pagina.locator('#m-dicas li').count(), 1);
  assert.equal((await salvo()).missoes['ip-duplicado'].dicas, 1);
  await configurar(pagina, disp, 'pc3', { '#cfg-ip-eth0': '192.168.1.77' });
  await pagina.reload();
  await pagina.locator('#lab-svg').waitFor();
  assert.equal(await pagina.locator('#m-dicas li').count(), 1, 'dica continua revelada');
  assert.match(await disp('pc3').getAttribute('aria-label'), /192\.168\.1\.77/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /\+80 XP \(1 dica usada\)/);
  assert.equal((await salvo()).missoes['ip-duplicado'].xp, 80);
  await contexto.close();
});

test('IP duplicado: usar outra sub-rede não resolve', async () => {
  const { pagina, disp, contexto } = await abrir('missoes/ip-duplicado');
  await configurar(pagina, disp, 'pc3', { '#cfg-ip-eth0': '172.16.0.5' });
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Ainda há objetivos/);
  assert.ok(await pagina.locator('#m-objetivos li.falha').count() >= 1);
  await contexto.close();
});

test('máscara errada e gateway errado: corrigidos pelo formulário', async () => {
  let s = await abrir('missoes/mascara-errada');
  await configurar(s.pagina, s.disp, 'pc2', { '#cfg-m-eth0': '255.255.255.0' });
  await s.pagina.locator('#m-verificar').click();
  assert.match(await s.pagina.locator('#m-msg').innerText(), /\+150 XP/);
  await s.contexto.close();

  s = await abrir('missoes/gateway-errado');
  await s.pagina.locator('#m-verificar').click();
  assert.match(await s.pagina.locator('#m-objetivos').innerText(), /não sabe como chegar|expirou|ninguém respondeu/);
  await configurar(s.pagina, s.disp, 'pc1', { '#cfg-gw': '192.168.1.1' });
  await s.pagina.locator('#m-verificar').click();
  assert.match(await s.pagina.locator('#m-msg').innerText(), /\+200 XP/);
  await s.contexto.close();
});

test('roteador pela metade: tracert ajuda a achar e configurar gi1 conclui', async () => {
  const { pagina, disp, salvo, contexto } = await abrir('missoes/interface-sem-ip');
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'ping 10.0.0.10');
  await pagina.press('#term-entrada', 'Enter');
  assert.doesNotMatch(await pagina.locator('#term-saida').innerText(), /Recebidos = 4/);
  await configurar(pagina, disp, 'r1', { '#cfg-ip-gi1': '10.0.0.1', '#cfg-m-gi1': '/24' });
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'ping 10.0.0.10');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Recebidos = 4, Perdidos = 0/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /\+250 XP/);
  assert.equal((await salvo()).missoes['interface-sem-ip'].xp, 250);
  await contexto.close();
});

test('reiniciar o cenário volta ao defeito mas mantém a conclusão e o XP', async () => {
  const { pagina, disp, salvo, contexto } = await abrir('missoes/gateway-errado');
  await configurar(pagina, disp, 'pc1', { '#cfg-gw': '192.168.1.1' });
  await pagina.locator('#m-verificar').click();
  await pagina.locator('#m-reiniciar-btn').click();
  await pagina.locator('#m-reiniciar-nao').click();
  assert.equal((await salvo()).missoes['gateway-errado'].topologia.dispositivos.find(d => d.id === 'pc1').gateway, '192.168.1.1');
  await pagina.locator('#m-reiniciar-btn').click();
  await pagina.locator('#m-reiniciar-sim').click();
  const e = await salvo();
  assert.equal(e.missoes['gateway-errado'].topologia.dispositivos.find(d => d.id === 'pc1').gateway, '192.168.1.254');
  assert.equal(e.missoes['gateway-errado'].concluida, true);
  assert.equal(e.missoes['gateway-errado'].xp, 200);
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 2, 'defeito voltou');
  await contexto.close();
});

test('missão inexistente mostra aviso; progresso aparece na lista; XP soma ao perfil e ao nível', async () => {
  let s = await abrir('missoes/nao-existe');
  assert.match(await s.pagina.locator('#app').innerText(), /Missão não encontrada/);
  await s.contexto.close();

  s = await abrir('missoes/cabo-esquecido');
  await s.pagina.locator('[data-modo="conectar"]').click();
  await s.disp('pc3').click(); await s.disp('sw1').click();
  await s.pagina.locator('#m-verificar').click();
  await s.pagina.goto(`${servidor.url}/index.html#/missoes`);
  await s.pagina.locator('.missao').first().waitFor();
  assert.match(await s.pagina.locator('.missao').first().innerText(), /Concluída · \+100 XP/);
  assert.match(await s.pagina.locator('#app').innerText(), /1 de 5 concluídas/);
  await s.pagina.goto(`${servidor.url}/index.html#/perfil`);
  await s.pagina.locator('#app h2').first().waitFor();
  assert.match(await s.pagina.locator('#app').innerText(), /100\s*XP|XP.*100/);
  assert.deepEqual(s.erros, []);
  await s.contexto.close();
});

test('estado de missão adulterado é saneado (XP inventado, missão desconhecida, topologia lixo)', async () => {
  const s = await novaPagina(navegador);
  await s.pagina.addInitScript(() => localStorage.setItem('network-command', JSON.stringify({ versao: 4, missoes: {
    'cabo-esquecido': { concluida: true, em: 'ontem', xp: 999999, dicas: 'x', topologia: 'lixo' },
    'missao-fantasma': { concluida: true, xp: 100 }
  } })));
  await s.pagina.goto(`${servidor.url}/index.html#/missoes/cabo-esquecido`);
  await s.pagina.locator('#lab-svg').waitFor();
  const e = await s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  assert.equal(e.missoes['missao-fantasma'], undefined);
  assert.equal(e.missoes['cabo-esquecido'].xp, 0);
  assert.equal(e.missoes['cabo-esquecido'].em, null);
  assert.equal(await s.pagina.locator('.disp').count(), 4, 'topologia inicial restaurada');
  assert.deepEqual(s.erros, []);
  await s.contexto.close();
});

test('layout no celular: sem rolagem horizontal da página e objetivos legíveis', async () => {
  const { pagina, contexto } = await abrir('missoes/cabo-esquecido', { largura: 390, altura: 800 });
  const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sobra <= 1, `rolagem horizontal de ${sobra}px`);
  await contexto.close();
});
