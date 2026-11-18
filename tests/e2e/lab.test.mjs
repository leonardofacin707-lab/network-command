// Laboratório (Fases 3 e 4): editor visual, configuração, terminal simulado e persistência.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';

let servidor, navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

async function abrirLab(opcoes) {
  const s = await novaPagina(navegador, opcoes);
  await s.pagina.goto(servidor.url + '/index.html#/laboratorio');
  await s.pagina.locator('#lab-svg').waitFor();
  s.salvo = () => s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  s.disp = id => s.pagina.locator(`.disp[data-id="${id}"]`);
  s.comando = async (linha) => {
    await s.pagina.fill('#term-entrada', linha);
    await s.pagina.press('#term-entrada', 'Enter');
  };
  s.saida = () => s.pagina.locator('#term-saida').innerText();
  return s;
}

test('exemplo de 3 PCs + switch: tudo configurado e o ping funciona', async () => {
  const { pagina, erros, disp, comando, saida, salvo, contexto } = await abrirLab();
  assert.match(await pagina.locator('#lab-cfg').innerText(), /área de trabalho está vazia/);
  await pagina.locator('[data-acao="ex-lan"]').click();
  assert.equal(await pagina.locator('.disp').count(), 4);
  assert.equal(await pagina.locator('.cabo-lab').count(), 3);
  await disp('pc1').click();
  await pagina.locator('#term-entrada').waitFor();
  await comando('ping 192.168.1.30');
  assert.match(await saida(), /Resposta de 192\.168\.1\.30: bytes=32 tempo<1ms TTL=128/);
  assert.match(await saida(), /Recebidos = 4, Perdidos = 0/);
  await comando('ipconfig');
  assert.match(await saida(), /192\.168\.1\.10/);
  await comando('arp -a');
  assert.match(await saida(), /192\.168\.1\.30/);
  assert.equal((await salvo()).lab.topologia.dispositivos.length, 4, 'salvo no navegador');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('montar do zero: adicionar, ligar com cabos, configurar e testar', async () => {
  const { pagina, erros, disp, comando, saida, salvo, contexto } = await abrirLab();
  for (const tipo of ['pc', 'pc', 'switch']) await pagina.locator(`[data-add="${tipo}"]`).click();
  assert.equal(await pagina.locator('.disp').count(), 3);
  // ligar PC1-SW1 e PC2-SW1 no modo conectar
  await pagina.locator('[data-modo="conectar"]').click();
  for (const pc of ['pc1', 'pc2']) { await disp(pc).click(); await disp('sw1').click(); }
  assert.equal(await pagina.locator('.cabo-lab').count(), 2);
  assert.match(await pagina.locator('#lab-estado').innerText(), /Ligado: PC2 \(Ethernet0\) ↔ SW1 \(Fa0\/2\)/);
  await pagina.locator('[data-modo="mover"]').click();
  // sem IP: avisos e falha no ping
  assert.match(await pagina.locator('#lab-avisos').innerText(), /PC1 está ligado, mas.*não tem IP/);
  // configurar PC1 e PC2
  for (const [pc, ip] of [['pc1', '192.168.1.10'], ['pc2', '192.168.1.20']]) {
    await disp(pc).click();
    await pagina.fill('#cfg-ip-eth0', ip);
    await pagina.fill('#cfg-m-eth0', '/24');
    await pagina.locator('#form-cfg button[type=submit]').click();
    assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
  }
  assert.equal(await pagina.locator('#lab-avisos li').count(), 0, 'sem avisos');
  await disp('pc1').click();
  await comando('ping pc2');
  assert.match(await saida(), /Disparando contra PC2 \[192\.168\.1\.20\]/);
  assert.match(await saida(), /Recebidos = 4/);
  const e = await salvo();
  assert.deepEqual(e.lab.topologia.cabos.map(c => c.id), ['c1', 'c2']);
  assert.equal(e.lab.topologia.dispositivos.find(d => d.id === 'pc2').interfaces[0].mascara, '255.255.255.0');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('configuração inválida mostra o motivo e não altera nada', async () => {
  const { pagina, disp, salvo, contexto } = await abrirLab();
  await pagina.locator('[data-add="pc"]').click();
  const casos = [
    [{ ip: '300.1.1.1', m: '/24' }, /IPv4 inválido/],
    [{ ip: '192.168.1.0', m: '/24' }, /endereço de rede/],
    [{ ip: '192.168.1.255', m: '/24' }, /broadcast/],
    [{ ip: '192.168.1.10', m: '255.0.255.0' }, /Máscara inválida/],
    [{ ip: '127.0.0.1', m: '/8' }, /loopback/],
    [{ ip: '', m: '/24' }, /Informe o endereço IP/]
  ];
  for (const [{ ip, m }, esperado] of casos) {
    await pagina.fill('#cfg-ip-eth0', ip);
    await pagina.fill('#cfg-m-eth0', m);
    await pagina.locator('#form-cfg button[type=submit]').click();
    assert.match(await pagina.locator('#lab-estado').innerText(), esperado, `${ip} ${m}`);
  }
  assert.equal((await salvo()).lab.topologia.dispositivos[0].interfaces[0].ip, '');
  // nome inválido e duplicado
  await pagina.fill('#cfg-nome', 'nome com espaço');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Nome inválido/);
  await contexto.close();
});

test('remover um cabo derruba o ping; remover o dispositivo leva os cabos', async () => {
  const { pagina, disp, comando, saida, contexto } = await abrirLab();
  await pagina.locator('[data-acao="ex-lan"]').click();
  await disp('pc1').click();
  await pagina.locator('[data-remover-cabo]').first().click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Cabo removido/);
  await comando('ipconfig');
  assert.match(await saida(), /mídia desconectada/);
  await comando('ping 192.168.1.20');
  assert.match(await saida(), /Falha geral/);
  assert.match(await pagina.locator('#lab-avisos').innerText(), /PC1 está sem cabo/);
  await disp('pc2').click();
  await pagina.locator('[data-remover-disp]').click();
  assert.equal(await pagina.locator('.disp').count(), 3);
  assert.equal(await pagina.locator('.cabo-lab').count(), 1);
  await contexto.close();
});

test('duas redes com roteador: ping, tracert e TTL', async () => {
  const { pagina, erros, disp, comando, saida, contexto } = await abrirLab();
  await pagina.locator('[data-acao="ex-redes"]').click();
  await disp('pc1').click();
  await comando('ping 10.0.0.10');
  assert.match(await saida(), /TTL=127/);
  await comando('tracert 10.0.0.10');
  assert.match(await saida(), /1 .*192\.168\.1\.1/);
  assert.match(await saida(), /2 .*10\.0\.0\.10/);
  // quebra o gateway no PC1 e testa de novo
  await pagina.fill('#cfg-gw', '192.168.1.99');
  await pagina.locator('#form-cfg button[type=submit]').click();
  await disp('pc1').click();
  await comando('cls');
  await comando('ping 10.0.0.10');
  assert.match(await saida(), /Host de destino inacessível/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('terminal: histórico com setas, cls e comando desconhecido', async () => {
  const { pagina, disp, comando, saida, contexto } = await abrirLab();
  await pagina.locator('[data-acao="ex-lan"]').click();
  await disp('pc1').click();
  await comando('hostname');
  await comando('dir');
  assert.match(await saida(), /'dir' não é reconhecido/);
  await pagina.locator('#term-entrada').focus();
  await pagina.keyboard.press('ArrowUp');
  assert.equal(await pagina.inputValue('#term-entrada'), 'dir');
  await pagina.keyboard.press('ArrowUp');
  assert.equal(await pagina.inputValue('#term-entrada'), 'hostname');
  await pagina.keyboard.press('ArrowDown');
  await pagina.keyboard.press('ArrowDown');
  assert.equal(await pagina.inputValue('#term-entrada'), '');
  await comando('cls');
  assert.equal((await saida()).trim(), '');
  // switch não tem terminal
  await disp('sw1').click();
  assert.equal(await pagina.locator('#term-entrada').count(), 0);
  await contexto.close();
});

test('arrastar com o mouse e mover com as setas atualiza a posição e salva', async () => {
  const { pagina, disp, salvo, contexto } = await abrirLab({ largura: 1280, altura: 900 });
  await pagina.locator('[data-acao="ex-lan"]').click();
  const antes = (await salvo()).lab.topologia.dispositivos.find(d => d.id === 'pc1');
  const caixa = await disp('pc1').locator('.icone').boundingBox();
  await pagina.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await pagina.mouse.down();
  await pagina.mouse.move(caixa.x + caixa.width / 2 + 120, caixa.y + caixa.height / 2 - 60, { steps: 6 });
  await pagina.mouse.up();
  const depois = (await salvo()).lab.topologia.dispositivos.find(d => d.id === 'pc1');
  assert.ok(depois.x > antes.x + 40 && depois.y < antes.y - 20, `moveu de (${antes.x},${antes.y}) para (${depois.x},${depois.y})`);
  await disp('pc1').focus();
  await pagina.keyboard.press('ArrowRight');
  await pagina.keyboard.press('ArrowRight');
  assert.equal((await salvo()).lab.topologia.dispositivos.find(d => d.id === 'pc1').x, depois.x + 20);
  await contexto.close();
});

test('o laboratório sobrevive ao recarregar; limpar tudo pede confirmação', async () => {
  const { pagina, salvo, contexto } = await abrirLab();
  await pagina.locator('[data-acao="ex-lan"]').click();
  await pagina.reload();
  await pagina.locator('#lab-svg').waitFor();
  assert.equal(await pagina.locator('.disp').count(), 4);
  await pagina.locator('[data-acao="limpar"]').click();
  assert.equal(await pagina.locator('.disp').count(), 4, 'ainda não apagou');
  await pagina.locator('[data-acao="limpar-nao"]').click();
  assert.equal(await pagina.locator('.disp').count(), 4);
  await pagina.locator('[data-acao="limpar"]').click();
  await pagina.locator('[data-acao="limpar-sim"]').click();
  assert.equal(await pagina.locator('.disp').count(), 0);
  assert.deepEqual((await salvo()).lab.topologia, { dispositivos: [], cabos: [] });
  await contexto.close();
});

test('topologia salva corrompida não derruba a página', async () => {
  const s = await novaPagina(navegador);
  await s.pagina.addInitScript(() => localStorage.setItem('network-command', JSON.stringify({ versao: 4, lab: { topologia: { dispositivos: [{ id: 'pc1', tipo: 'pc', nome: '<img src=x onerror=alert(1)>', x: 'a' }, null, 5], cabos: 'x' } } })));
  await s.pagina.goto(servidor.url + '/index.html#/laboratorio');
  await s.pagina.locator('#lab-svg').waitFor();
  assert.equal(await s.pagina.locator('.disp').count(), 1);
  assert.equal(await s.pagina.locator('#lab-svg img').count(), 0, 'nome malicioso foi trocado');
  assert.deepEqual(s.erros, []);
  await s.contexto.close();
});

test('dispositivos são operáveis por teclado e têm nome acessível', async () => {
  const { pagina, disp, contexto } = await abrirLab();
  await pagina.locator('[data-acao="ex-lan"]').click();
  assert.match(await disp('pc1').getAttribute('aria-label'), /PC1, computador, 192\.168\.1\.10/);
  assert.match(await disp('sw1').getAttribute('aria-label'), /SW1, switch, sem IP/);
  await disp('pc2').focus();
  await pagina.keyboard.press('Enter');
  assert.match(await pagina.locator('#lab-cfg h3').innerText(), /PC2/);
  await contexto.close();
});

test('switch: tabela de portas, VLAN isola e trunk entre switches liga os prédios', async () => {
  const { pagina, erros, disp, comando, saida, salvo, contexto } = await abrirLab();
  for (const tipo of ['pc', 'pc', 'switch']) await pagina.locator(`[data-add="${tipo}"]`).click();
  await pagina.locator('[data-modo="conectar"]').click();
  for (const pc of ['pc1', 'pc2']) { await disp(pc).click(); await disp('sw1').click(); }
  await pagina.locator('[data-modo="mover"]').click();
  for (const [pc, ip] of [['pc1', '192.168.10.1'], ['pc2', '192.168.10.2']]) {
    await disp(pc).click();
    await pagina.fill('#cfg-ip-eth0', ip); await pagina.fill('#cfg-m-eth0', '/24');
    await pagina.locator('#form-cfg button[type=submit]').click();
  }
  await disp('sw1').click();
  assert.equal(await pagina.locator('.portas-sw tbody tr').count(), 8);
  assert.match(await pagina.locator('.portas-sw tbody tr').first().innerText(), /Fa0\/1[\s\S]*PC1/);
  // PC1 na VLAN 10 e PC2 na VLAN 20: sem ping
  await pagina.fill('#cfg-vlan-fa1', '10');
  await pagina.fill('#cfg-vlan-fa2', '20');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
  assert.match(await disp('sw1').getAttribute('aria-label'), /VLAN 10,20/);
  await disp('pc1').click();
  await comando('ping 192.168.10.2');
  assert.match(await saida(), /Recebidos = 0, Perdidos = 4/);
  // mesma VLAN: funciona
  await disp('sw1').click();
  await pagina.fill('#cfg-vlan-fa2', '10');
  await pagina.locator('#form-cfg button[type=submit]').click();
  await disp('pc1').click();
  await comando('ping 192.168.10.2');
  assert.match(await saida(), /Recebidos = 4, Perdidos = 0/);
  const sw = (await salvo()).lab.topologia.dispositivos.find(d => d.id === 'sw1');
  assert.deepEqual(sw.portas, { fa1: { modo: 'access', vlan: 10 }, fa2: { modo: 'access', vlan: 10 } });
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('VLAN inválida é recusada com mensagem e nada muda; trunk não usa VLAN', async () => {
  const { pagina, disp, salvo, contexto } = await abrirLab();
  await pagina.locator('[data-add="switch"]').click();
  await pagina.fill('#cfg-vlan-fa3', '0');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /VLAN inválida/);
  assert.deepEqual((await salvo()).lab.topologia.dispositivos[0].portas, {});
  await pagina.fill('#cfg-vlan-fa3', '4095');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /VLAN inválida/);
  await pagina.fill('#cfg-vlan-fa3', '30');
  await pagina.selectOption('#cfg-modo-fa4', 'trunk');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.deepEqual((await salvo()).lab.topologia.dispositivos[0].portas, { fa3: { modo: 'access', vlan: 30 }, fa4: { modo: 'trunk', vlan: 1 } });
  assert.equal(await pagina.inputValue('#cfg-vlan-fa4'), '');
  await contexto.close();
});

test('dois cabos entre os mesmos switches são desenhados lado a lado', async () => {
  const { pagina, disp, contexto } = await abrirLab();
  for (let i = 0; i < 2; i++) await pagina.locator('[data-add="switch"]').click();
  await pagina.locator('[data-modo="conectar"]').click();
  await disp('sw1').click(); await disp('sw2').click();
  await disp('sw1').click(); await disp('sw2').click();
  assert.equal(await pagina.locator('.cabo-lab').count(), 2);
  const ys = await pagina.locator('.cabo-lab').evaluateAll(ls => ls.map(l => [l.getAttribute('x1'), l.getAttribute('y1')].join(',')));
  assert.notEqual(ys[0], ys[1], 'não se sobrepõem');
  await contexto.close();
});
