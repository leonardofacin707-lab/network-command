// Campus de Redes (Fase 6/8, protótipo): missões com VLAN, trunk e roteamento entre VLANs.
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
  s.disp = id => s.pagina.locator(`.disp[data-id="${id}"]`);
  s.aplicarSwitch = async (sw, campos) => {
    await s.disp(sw).click();
    for (const [sel, valor] of Object.entries(campos)) {
      if (sel.startsWith('#cfg-modo')) await s.pagina.selectOption(sel, valor); else await s.pagina.fill(sel, valor);
    }
    await s.pagina.locator('#form-cfg button[type=submit]').click();
    assert.match(await s.pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
  };
  return s;
}

test('lista do Campus: 6 missões próprias, separadas das de Missões, e o menu marca protótipo', async () => {
  const { pagina, erros, contexto } = await abrir('campus');
  assert.match(await pagina.locator('#app h2').first().innerText(), /Campus de Redes/);
  assert.equal(await pagina.locator('.missao').count(), 6);
  assert.match(await pagina.locator('#app').innerText(), /0 de 6 concluídas/);
  assert.match(await pagina.locator('.menu a[data-rota="campus"]').innerText(), /protótipo|proto/i);
  assert.match(await pagina.locator('.menu a[aria-current=page]').innerText(), /Campus/);
  await pagina.goto(`${servidor.url}/index.html#/missoes`);
  await pagina.locator('.missao').first().waitFor();
  assert.equal(await pagina.locator('.missao').count(), 18, 'a lista de Missões não ganhou as do campus');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('porta na VLAN errada: o terminal mostra a falha e corrigir a VLAN da porta conclui', async () => {
  const s = await abrir('campus/porta-na-vlan-errada');
  const { pagina, erros } = s;
  await s.disp('pc3').click();
  await pagina.fill('#term-entrada', 'ping 192.168.10.1');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Recebidos = 0, Perdidos = 4/);
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 2);
  await s.aplicarSwitch('sw1', { '#cfg-vlan-fa3': '10' });
  await s.disp('pc3').click();
  await pagina.fill('#term-entrada', 'ping 192.168.10.1');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Recebidos = 4, Perdidos = 0/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+120 XP/);
  const e = await s.salvo();
  assert.equal(e.missoes['porta-na-vlan-errada'].xp, 120);
  assert.ok(e.conquistas['primeira-missao']);
  assert.match(await pagina.locator('#hud').innerText(), /120/);
  assert.deepEqual(erros, []);
  await s.contexto.close();
});

test('trunk esquecido: trunk em um lado só não resolve; nos dois lados conclui', async () => {
  const s = await abrir('campus/trunk-esquecido');
  const { pagina } = s;
  assert.match(await s.disp('sw1').getAttribute('aria-label'), /VLAN 1,10,20|VLAN 10,20/);
  await s.aplicarSwitch('sw1', { '#cfg-modo-fa8': 'trunk' });
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.ok').count(), 0);
  await s.aplicarSwitch('sw2', { '#cfg-modo-fa8': 'trunk' });
  assert.match(await s.disp('sw1').getAttribute('aria-label'), /trunk×1/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+180 XP/);
  await s.contexto.close();
});

test('o campus inteiro: três objetivos, dois defeitos, dica custa XP', async () => {
  const s = await abrir('campus/campus-completo');
  const { pagina, erros } = s;
  assert.equal(await pagina.locator('.disp').count(), 7);
  assert.equal(await pagina.locator('#m-objetivos li').count(), 3);
  await pagina.locator('#m-dica').click();
  await s.aplicarSwitch('sw1', { '#cfg-modo-fa8': 'trunk' });
  await s.aplicarSwitch('sw2', { '#cfg-modo-fa8': 'trunk' });
  await pagina.locator('#m-verificar').click();
  assert.ok(await pagina.locator('#m-objetivos li.falha').count() >= 1, 'ainda falta a VLAN do PC4');
  await s.aplicarSwitch('sw2', { '#cfg-vlan-fa2': '20' });
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.ok').count(), 3);
  assert.match(await pagina.locator('#m-msg').innerText(), /\+240 XP \(1 dica usada\)/);
  assert.deepEqual(erros, []);
  await s.contexto.close();
});

test('a missão de outro módulo não abre no Campus e vice-versa', async () => {
  let s = await abrir('campus/cabo-esquecido');
  assert.match(await s.pagina.locator('#app').innerText(), /Missão não encontrada/);
  await s.contexto.close();
  s = await abrir('missoes/trunk-esquecido');
  assert.match(await s.pagina.locator('#app').innerText(), /Missão não encontrada/);
  await s.contexto.close();
});

test('celular: sem rolagem horizontal e tabela de portas do switch acessível', async () => {
  const s = await abrir('campus/trunk-esquecido', { largura: 390, altura: 800 });
  await s.disp('sw1').click();
  assert.equal(await s.pagina.locator('.portas-sw tbody tr').count(), 8);
  for (const sel of await s.pagina.locator('.portas-sw select, .portas-sw input').all()) {
    const id = await sel.getAttribute('id');
    assert.equal(await s.pagina.locator(`label[for="${id}"]`).count(), 1, `${id} sem rótulo`);
  }
  const sobra = await s.pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sobra <= 1, `rolagem horizontal ${sobra}px`);
  await s.contexto.close();
});

test('prática: setores separados — objetivos de isolamento começam falhando e passam com VLANs; XP e habilidade registrados', async () => {
  const s = await abrir('campus/setores-separados');
  const { pagina, erros } = s;
  await pagina.locator('#m-verificar').click();
  const antes = await pagina.locator('#m-objetivos').innerText();
  assert.match(antes, /PC1 não alcança PC3/);
  assert.match(antes, /ainda se comunicam, mas deveriam estar isolados/);
  assert.equal(await pagina.locator('#m-objetivos li.ok').count(), 2, 'a comunicação dentro dos setores já funcionava');
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 2);
  await s.aplicarSwitch('sw1', { '#cfg-vlan-fa1': '10', '#cfg-vlan-fa2': '10', '#cfg-vlan-fa3': '20', '#cfg-vlan-fa4': '20' });
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+150 XP/);
  const e = await s.salvo();
  assert.equal(e.missoes['setores-separados'].xp, 150);
  // a árvore de habilidades passa a mostrar a prática de Ethernet e comutação
  await pagina.locator('.menu a[data-rota="habilidades"]').click();
  await pagina.locator('.menu a[data-rota="habilidades"][aria-current=page]').waitFor();
  assert.match(await pagina.locator('[data-trilha="ethernet-comutacao"] .degraus li', { hasText: 'Prática' }).innerText(), /1 de 2 concluído[\s\S]*✓ Setores separados por VLAN/);
  assert.deepEqual(erros, []);
  await s.contexto.close();
});

test('prática: dois andares — VLANs sem trunk não bastam; com trunk nos dois lados conclui', async () => {
  const s = await abrir('campus/dois-andares-mesmas-vlans');
  const { pagina } = s;
  await s.aplicarSwitch('sw1', { '#cfg-vlan-fa1': '10', '#cfg-vlan-fa2': '20' });
  await s.aplicarSwitch('sw2', { '#cfg-vlan-fa1': '10', '#cfg-vlan-fa2': '20' });
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.ok').count(), 2, 'só os dois isolamentos passam sem o trunk');
  await s.aplicarSwitch('sw1', { '#cfg-modo-fa8': 'trunk' });
  await s.aplicarSwitch('sw2', { '#cfg-modo-fa8': 'trunk' });
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+220 XP/);
  await s.contexto.close();
});
