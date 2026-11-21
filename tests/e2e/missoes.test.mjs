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

test('lista: 43 missões, todas não iniciadas, com acesso por teclado e nome acessível', async () => {
  const { pagina, erros, contexto } = await abrir();
  assert.equal(await pagina.locator('.missao').count(), 43);
  assert.match(await pagina.locator('#app').innerText(), /0 de 43 concluídas/);
  assert.match(await pagina.locator('.missao a').first().innerText(), /Sua primeira rede local\s+Fácil · 100 XP\s+Não iniciada/);
  assert.match(await pagina.locator('.missao a').nth(6).innerText(), /O cabo esquecido\s+Fácil · 100 XP\s+Não iniciada/);
  assert.equal(await pagina.locator('.missao a[aria-label]').count(), 0, 'o nome acessível vem do próprio texto visível');
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
  assert.match(await s.pagina.locator('.missao', { hasText: 'O cabo esquecido' }).innerText(), /Concluída · \+100 XP/);
  assert.match(await s.pagina.locator('#app').innerText(), /1 de 43 concluídas/);
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

test('prática: sua primeira rede local — configurar os 3 PCs pela interface conclui; o IP repetido é recusado pelo objetivo', async () => {
  const s = await abrir('missoes/primeira-rede');
  const { pagina, disp, erros } = s;
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 3);
  assert.match(await pagina.locator('#m-objetivos').innerText(), /não tem IP configurado/);
  await configurar(pagina, disp, 'pc1', { '#cfg-ip-eth0': '192.168.1.10', '#cfg-m-eth0': '/24' });
  await configurar(pagina, disp, 'pc2', { '#cfg-ip-eth0': '192.168.1.20', '#cfg-m-eth0': '/24' });
  await configurar(pagina, disp, 'pc3', { '#cfg-ip-eth0': '192.168.1.10', '#cfg-m-eth0': '/24' }); // repetido de propósito
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Ainda há objetivos/);
  await configurar(pagina, disp, 'pc3', { '#cfg-ip-eth0': '192.168.1.30' });
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+100 XP/);
  assert.equal((await s.salvo()).missoes['primeira-rede'].xp, 100);
  assert.deepEqual(erros, []);
  await s.contexto.close();
});

test('prática: duas redes, um roteador — IPs, interfaces e gateways pela interface conclui (250 XP)', async () => {
  const s = await abrir('missoes/duas-redes-um-roteador');
  const { pagina, disp, erros } = s;
  await configurar(pagina, disp, 'r1', { '#cfg-ip-gi0': '192.168.1.1', '#cfg-m-gi0': '/24', '#cfg-ip-gi1': '10.0.0.1', '#cfg-m-gi1': '/24' });
  await configurar(pagina, disp, 'pc1', { '#cfg-ip-eth0': '192.168.1.10', '#cfg-m-eth0': '/24', '#cfg-gw': '192.168.1.1' });
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Ainda há objetivos/);
  await configurar(pagina, disp, 'pc2', { '#cfg-ip-eth0': '10.0.0.10', '#cfg-m-eth0': '/24', '#cfg-gw': '10.0.0.1' });
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+250 XP/);
  assert.deepEqual(erros, []);
  await s.contexto.close();
});

test('rotas estáticas pela interface: validação, rota de ida, de volta, remoção e conclusão (280 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/rotas-estaticas');
  await disp('pc1').click();
  assert.equal(await pagina.locator('#rotas-estaticas').count(), 0, 'PC não tem tabela de rotas');
  await disp('r1').click();
  assert.match(await pagina.locator('#rotas-estaticas').innerText(), /Nenhuma rota estática/);
  const aplicar = async (rede, m, via) => {
    await pagina.fill('#cfg-rota-rede', rede); await pagina.fill('#cfg-rota-m', m); await pagina.fill('#cfg-rota-via', via);
    await pagina.locator('#form-cfg button[type=submit]').click();
  };
  await aplicar('172.16.0.0', '/24', '10.9.9.9');
  assert.match(await pagina.locator('#lab-estado').innerText(), /ligada diretamente/);
  await pagina.fill('#cfg-rota-rede', '172.16.0.0'); await pagina.fill('#cfg-rota-m', ''); await pagina.fill('#cfg-rota-via', '');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /preencha a rede, a máscara e o próximo salto/);
  await aplicar('172.16.0.0', '/24', '10.0.0.2');
  assert.match(await pagina.locator('#rotas-estaticas .regra').innerText(), /172\.16\.0\.0\/24\s+via\s+10\.0\.0\.2/);
  assert.equal((await salvo()).missoes['rotas-estaticas']?.concluida ?? false, false);
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 2, 'só a ida não basta');
  // rota errada na volta, depois removida
  await disp('r2').click();
  await aplicar('192.168.2.0', '/24', '10.0.0.1');
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.ok').count(), 0);
  await pagina.locator('[data-remover-rota="0"]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Rota removida/);
  assert.match(await pagina.locator('#rotas-estaticas').innerText(), /Nenhuma rota estática/);
  await aplicar('192.168.1.0', '255.255.255.0', '10.0.0.1');
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.ok').count(), 2);
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+280 XP/);
  const e = await salvo();
  assert.equal(e.missoes['rotas-estaticas'].concluida, true);
  assert.deepEqual(e.missoes['rotas-estaticas'].topologia.dispositivos.find(d => d.id === 'r2').rotas, [{ rede: '192.168.1.0', mascara: '255.255.255.0', via: '10.0.0.1' }]);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('DHCP pela interface: sem pool não há IP; com pool os PCs recebem endereço e a missão conclui (120 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/dhcp-sem-servidor');
  await disp('pc1').click();
  assert.equal(await pagina.locator('#cfg-dhcp').isChecked(), true);
  assert.equal(await pagina.locator('#cfg-ip-eth0').isDisabled(), true, 'com DHCP ligado os campos fixos ficam desabilitados');
  assert.match(await pagina.locator('.iface-dhcp').innerText(), /Nenhum servidor DHCP respondeu/);
  await pagina.fill('#term-entrada', 'ipconfig /renew');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Operação falhou: Nenhum servidor DHCP respondeu/);
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 2);
  // pool inválido (fora da rede) é recusado
  await disp('r1').click();
  await pagina.fill('#cfg-pool-ini-gi0', '10.0.0.5'); await pagina.fill('#cfg-pool-fim-gi0', '10.0.0.9');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /não está na sub-rede/);
  await pagina.fill('#cfg-pool-ini-gi0', '192.168.10.100'); await pagina.fill('#cfg-pool-fim-gi0', '192.168.10.150');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
  assert.match(await disp('pc2').getAttribute('aria-label'), /192\.168\.10\.101/, 'o desenho mostra o endereço recebido');
  await disp('pc1').click();
  assert.match(await pagina.locator('.iface-dhcp').innerText(), /Concessão: 192\.168\.10\.100/);
  await pagina.fill('#term-entrada', 'ipconfig /renew');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Concessão DHCP obtida[\s\S]*192\.168\.10\.100/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+120 XP/);
  // desligar o DHCP volta aos campos fixos, que continuam vazios
  await disp('pc3').click();
  await pagina.locator('#cfg-dhcp').uncheck();
  assert.equal(await pagina.locator('#cfg-ip-eth0').isDisabled(), false);
  const e = await salvo();
  assert.equal(e.missoes['dhcp-sem-servidor'].concluida, true);
  assert.deepEqual(e.missoes['dhcp-sem-servidor'].topologia.dispositivos.find(d => d.id === 'r1').pools, [{ porta: 'gi0', inicio: '192.168.10.100', fim: '192.168.10.150' }]);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('filtro de pacotes pela interface: validação, mover regra para cima e concluir (240 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/filtro-ordem');
  await disp('r1').click();
  assert.equal(await pagina.locator('#filtros-pacotes .regra').count(), 2);
  assert.match(await pagina.locator('#filtros-pacotes .regra').nth(0).innerText(), /negar de 192\.168\.1\.0\/24\s+para 192\.168\.2\.0\/24/);
  assert.equal(await pagina.locator('[data-mover-filtro="0"][data-delta="-1"]').isDisabled(), true, 'a primeira regra não sobe');
  await pagina.locator('#m-verificar').click();
  assert.deepEqual(await pagina.locator('#m-objetivos li').evaluateAll(l => l.map(x => x.className.includes('ok'))), [false, true, true]);
  // nova regra inválida é recusada com a mensagem do motor
  await pagina.selectOption('#cfg-filtro-acao', 'negar');
  await pagina.fill('#cfg-filtro-o', '192.168.1.5'); await pagina.fill('#cfg-filtro-om', '/24');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /endereço de rede seria 192\.168\.1\.0/);
  assert.equal(await pagina.locator('#filtros-pacotes .regra').count(), 2);
  await pagina.locator('[data-mover-filtro="1"][data-delta="-1"]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Regra movida/);
  assert.match(await pagina.locator('#filtros-pacotes .regra').nth(0).innerText(), /permitir/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+240 XP/);
  const e = await salvo();
  assert.deepEqual(e.missoes['filtro-ordem'].topologia.dispositivos.find(d => d.id === 'r1').filtros.map(f => f.acao), ['permitir', 'negar']);
  // acrescentar e remover uma regra pela interface
  await pagina.selectOption('#cfg-filtro-acao', 'negar');
  await pagina.fill('#cfg-filtro-d', '192.168.2.10'); await pagina.fill('#cfg-filtro-dm', '/32');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.equal(await pagina.locator('#filtros-pacotes .regra').count(), 3);
  assert.match(await pagina.locator('#filtros-pacotes .regra').nth(2).innerText(), /negar de qualquer\s+para 192\.168\.2\.10\/32/);
  await pagina.locator('[data-remover-filtro="2"]').click();
  assert.equal(await pagina.locator('#filtros-pacotes .regra').count(), 2);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('DNS pela interface: registros no servidor, DNS nos clientes, nslookup e conclusão (260 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/dns-da-empresa');
  const aplicar = async () => { await pagina.locator('#form-cfg button[type=submit]').click(); };
  // cliente sem DNS: nslookup explica
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'nslookup intranet.empresa.local');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Nenhum servidor DNS está configurado/);
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 4);
  // servidor: registros (um inválido primeiro)
  await disp('pc3').click();
  assert.match(await pagina.locator('#dns-pc').innerText(), /não responde consultas DNS/);
  await pagina.fill('#cfg-reg-nome', 'intranet empresa'); await pagina.fill('#cfg-reg-ip', '192.168.1.60');
  await aplicar();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Nome inválido/);
  await pagina.fill('#cfg-reg-nome', 'intranet.empresa.local'); await pagina.fill('#cfg-reg-ip', '192.168.1.60');
  await aplicar();
  await pagina.fill('#cfg-reg-nome', 'arquivos.empresa.local'); await pagina.fill('#cfg-reg-ip', '192.168.1.70');
  await aplicar();
  assert.equal(await pagina.locator('#dns-pc .regra').count(), 2);
  assert.match(await pagina.locator('#dns-pc .regra').first().innerText(), /intranet\.empresa\.local\s+→\s+192\.168\.1\.60/);
  // clientes
  for (const id of ['pc1', 'pc2']) { await disp(id).click(); await pagina.fill('#cfg-dns', '192.168.1.50'); await aplicar(); assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/); }
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'nslookup intranet.empresa.local');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Nome:\s+intranet\.empresa\.local\s+Address:\s+192\.168\.1\.60/);
  await pagina.fill('#term-entrada', 'ping -n 1 arquivos.empresa.local');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Disparando contra arquivos\.empresa\.local \[192\.168\.1\.70\][\s\S]*Recebidos = 1/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+260 XP/);
  const e = await salvo();
  assert.equal(e.missoes['dns-da-empresa'].concluida, true);
  assert.equal(e.missoes['dns-da-empresa'].topologia.dispositivos.find(d => d.id === 'pc1').dns, '192.168.1.50');
  // remover um registro
  await disp('pc3').click();
  await pagina.locator('[data-remover-registro="0"]').click();
  assert.equal(await pagina.locator('#dns-pc .regra').count(), 1);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('NAT pela interface: IP, rota e NAT na Borda; escolha incompleta é recusada; conclusão (260 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/nat-saida-da-empresa');
  const aplicar = async () => { await pagina.locator('#form-cfg button[type=submit]').click(); };
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'ping -n 1 200.0.1.10');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /inacessível/);
  await disp('r1').click();
  assert.match(await pagina.locator('#nat-roteador').innerText(), /NAT simplificado/);
  await pagina.fill('#cfg-ip-gi1', '200.0.0.2'); await pagina.fill('#cfg-m-gi1', '/30');
  await pagina.fill('#cfg-rota-rede', '0.0.0.0'); await pagina.fill('#cfg-rota-m', '/0'); await pagina.fill('#cfg-rota-via', '200.0.0.1');
  await aplicar();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
  // sem NAT: a ida chega ao servidor, a resposta não volta
  await pagina.locator('#m-verificar').click();
  assert.equal(await pagina.locator('#m-objetivos li.falha').count(), 2);
  assert.match(await pagina.locator('#m-objetivos').innerText(), /resposta não voltou/);
  // só um lado escolhido: recusado
  await pagina.selectOption('#cfg-nat-dentro', 'gi0');
  await aplicar();
  assert.match(await pagina.locator('#lab-estado').innerText(), /escolha a interface de dentro e a de fora/);
  // lados iguais: recusado
  await pagina.selectOption('#cfg-nat-dentro', 'gi0'); await pagina.selectOption('#cfg-nat-fora', 'gi0');
  await aplicar();
  assert.match(await pagina.locator('#lab-estado').innerText(), /diferentes/);
  // certo
  await pagina.selectOption('#cfg-nat-dentro', 'gi0'); await pagina.selectOption('#cfg-nat-fora', 'gi1');
  await aplicar();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
  await disp('pc2').click();
  await pagina.fill('#term-entrada', 'ping -n 1 200.0.1.10');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Resposta de 200\.0\.1\.10: bytes=32[\s\S]*TTL=126[\s\S]*Recebidos = 1/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+260 XP/);
  const e = await salvo();
  assert.equal(e.missoes['nat-saida-da-empresa'].concluida, true);
  assert.deepEqual(e.missoes['nat-saida-da-empresa'].topologia.dispositivos.find(d => d.id === 'r1').nat, { dentro: 'gi0', fora: 'gi1' });
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('NAT com os lados trocados: o terminal mostra o bloqueio e a troca pela interface conclui (180 XP)', async () => {
  const { pagina, erros, disp, contexto } = await abrir('missoes/nat-lados-trocados');
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'ping -n 1 200.0.1.10');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /NAT do roteador não deixa entrar/);
  await disp('r1').click();
  assert.equal(await pagina.locator('#cfg-nat-dentro').inputValue(), 'gi1');
  await pagina.selectOption('#cfg-nat-dentro', 'gi0'); await pagina.selectOption('#cfg-nat-fora', 'gi1');
  await pagina.locator('#form-cfg button[type=submit]').click();
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+180 XP/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('segurança pela interface: captura mostra as duas respostas ARP do gateway falso; tnc e filtro por porta fecham o Telnet (260 XP)', async () => {
  const s1 = await abrir('missoes/seg-gateway-falso');
  await s1.disp('pc1').click();
  await s1.pagina.locator('#captura-ligada').check();
  assert.match(await s1.pagina.locator('#captura').innerText(), /Rode um comando/);
  await s1.pagina.fill('#term-entrada', 'ping -n 1 10.0.0.10');
  await s1.pagina.press('#term-entrada', 'Enter');
  const cap = await s1.pagina.locator('#captura').innerText();
  assert.match(cap, /Captura de ping -n 1 10\.0\.0\.10 em Cliente1/);
  assert.equal((cap.match(/192\.168\.1\.1 está em/g) ?? []).length, 2, 'duas respostas para o IP do gateway');
  assert.match(cap, /Quem tem 192\.168\.1\.1\?/);
  assert.deepEqual(s1.erros, []);
  await s1.contexto.close();

  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/seg-feche-telnet');
  const aplicar = () => pagina.locator('#form-cfg button[type=submit]').click();
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'tnc 10.0.0.10 23');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /RemotePort\s+: 23 \(Telnet\)[\s\S]*TcpTestSucceeded : True/);
  // serviços do servidor aparecem marcados
  await disp('pc3').click();
  assert.equal(await pagina.locator('#servicos-pc input[value="23"]').isChecked(), true);
  assert.equal(await pagina.locator('#servicos-pc input[value="443"]').isChecked(), false);
  // regra inválida: porta em icmp
  await disp('r1').click();
  await pagina.selectOption('#cfg-filtro-acao', 'negar');
  await pagina.selectOption('#cfg-filtro-proto', 'icmp'); await pagina.fill('#cfg-filtro-porta', '23');
  await aplicar();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Porta só existe em regras tcp ou udp/);
  await pagina.selectOption('#cfg-filtro-acao', 'negar');
  await pagina.fill('#cfg-filtro-o', '192.168.1.0'); await pagina.fill('#cfg-filtro-om', '/24');
  await pagina.fill('#cfg-filtro-d', '10.0.0.10'); await pagina.fill('#cfg-filtro-dm', '/32');
  await pagina.selectOption('#cfg-filtro-proto', 'tcp'); await pagina.fill('#cfg-filtro-porta', '23');
  await aplicar();
  assert.match(await pagina.locator('#filtros-pacotes .regra').first().innerText(), /negar tcp de 192\.168\.1\.0\/24 para 10\.0\.0\.10\/32 porta 23 \(Telnet\)/);
  await disp('pc1').click();
  await pagina.fill('#term-entrada', 'tnc 10.0.0.10 23');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /bloqueou a conexão[\s\S]*TcpTestSucceeded : False/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+260 XP/);
  assert.equal((await salvo()).missoes['seg-feche-telnet'].topologia.dispositivos.find(d => d.id === 'r1').filtros[0].porta, 23);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('IPv6 pela interface: SLAAC sem anúncio, IPv6 no roteador, clientes se configuram sozinhos e ping IPv6 conclui (220 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/ipv6-slaac');
  await disp('pc1').click();
  assert.equal(await pagina.locator('#cfg-slaac').isChecked(), true);
  assert.match(await pagina.locator('#ipv6-cfg').innerText(), /nenhum roteador anunciou um prefixo IPv6/);
  await pagina.fill('#term-entrada', 'ipconfig');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Endereço IPv6 de link local[ .]*: fe80::/);
  await disp('r1').click();
  assert.equal(await pagina.locator('#cfg-rot6').isChecked(), true);
  await pagina.fill('#cfg-ip6-gi0', '2001:db8:1::'); await pagina.fill('#cfg-p6-gi0', '64');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /próprio prefixo/);
  await pagina.fill('#cfg-ip6-gi0', '2001:db8:1::1');
  await pagina.locator('#form-cfg button[type=submit]').click();
  assert.match(await pagina.locator('#lab-estado').innerText(), /Configuração aplicada/);
  await disp('pc1').click();
  assert.match(await pagina.locator('#ipv6-cfg').innerText(), /SLAAC: 2001:db8:1::[0-9a-f:]+\/64, gateway fe80::/);
  await pagina.fill('#term-entrada', 'ping -n 1 2001:db8:2::10');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /Resposta de 2001:db8:2::10: tempo<1ms/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+220 XP/);
  assert.equal((await salvo()).missoes['ipv6-slaac'].topologia.dispositivos.find(d => d.id === 'r1').interfaces[0].ip6, '2001:db8:1::1');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('Wi-Fi pela interface: rede aberta, senha fraca recusada pelo objetivo, WPA2 forte nos três e conclusão (220 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/wifi-rede-aberta');
  const aplicar = () => pagina.locator('#form-cfg button[type=submit]').click();
  assert.equal(await pagina.locator('.cabo-wifi').count(), 2, 'dois clientes associados à rede aberta');
  await disp('pc2').click();
  await pagina.fill('#term-entrada', 'netsh wlan show networks');
  await pagina.press('#term-entrada', 'Enter');
  assert.match(await pagina.locator('#term-saida').innerText(), /SSID 1 : Clinica[\s\S]*Aberta \(sem criptografia!\)/);
  await disp('ap1').click();
  assert.match(await pagina.locator('#wifi-ap').innerText(), /Conectados: Recepcao, Consultorio/);
  await pagina.selectOption('#cfg-seg', 'wpa2'); await pagina.fill('#cfg-wsenha', 'curta');
  await aplicar();
  assert.match(await pagina.locator('#lab-estado').innerText(), /8 a 63 caracteres/);
  await pagina.fill('#cfg-wsenha', 'Jaleco-Verde-2031!');
  await aplicar();
  assert.equal(await pagina.locator('.cabo-wifi').count(), 0, 'trocar a senha derruba os clientes');
  for (const id of ['pc2', 'pc3']) {
    await disp(id).click();
    assert.match(await pagina.locator('#wifi-pc').innerText(), /Desconectado: a senha não confere/);
    await pagina.fill('#cfg-wpc', 'Jaleco-Verde-2031!');
    await aplicar();
  }
  assert.equal(await pagina.locator('.cabo-wifi').count(), 2);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+220 XP/);
  assert.equal((await salvo()).missoes['wifi-rede-aberta'].topologia.dispositivos.find(d => d.id === 'ap1').wifi.seguranca, 'wpa2');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('OSPF pela interface: wildcard errada vista no painel, corrigida pelo console do R3, conclusão (240 XP)', async () => {
  const { pagina, erros, disp, salvo, contexto } = await abrir('missoes/ospf-wildcard-errada');
  await disp('r1').click();
  assert.match(await pagina.locator('#ospf-roteador').innerText(), /Vizinhos: R2 \(vizinhança completa \(FULL\)\)/);
  assert.doesNotMatch(await pagina.locator('#ospf-roteador').innerText(), /192\.168\.3\.0/);
  await disp('r3').click();
  const cmd = async c => { await pagina.fill('#term-entrada', c); await pagina.press('#term-entrada', 'Enter'); };
  for (const c of ['en', 'conf t', 'router ospf 1', 'no network 192.168.3.0 255.255.255.0 area 0', 'network 192.168.3.0 0.0.0.255 area 0', 'end']) await cmd(c);
  assert.equal(await pagina.locator('#term-prompt').innerText(), 'R3#');
  await disp('r1').click();
  assert.match(await pagina.locator('#ospf-roteador').innerText(), /192\.168\.3\.0\/24 via 10\.0\.12\.2 \(custo 3\)/);
  await cmd('en'); await cmd('show ip route');
  assert.match(await pagina.locator('#term-saida').innerText(), /O\s+192\.168\.3\.0\/24 \[110\/3\]/);
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída! \+240 XP/);
  assert.equal((await salvo()).missoes['ospf-wildcard-errada'].topologia.dispositivos.find(d => d.id === 'r3').ospf.redes[1].wildcard, '0.0.0.255');
  assert.deepEqual(erros, []);
  await contexto.close();
});
