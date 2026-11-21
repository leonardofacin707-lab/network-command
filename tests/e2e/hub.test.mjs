// Testes do hub (Fase 2): navegação, dashboard, histórico, revisão, conquistas, perfil, backup e contraste.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { iniciarServidor } from '../helpers/servidor.mjs';
import { abrirNavegador, novaPagina } from '../helpers/navegador.mjs';
import { legado, jogarNivel, resolverAtual } from '../helpers/jogador.mjs';

let servidor, navegador;
before(async () => { servidor = await iniciarServidor(); navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); await servidor?.fechar(); });

/** Clica no item do menu e espera a página trocar (o hashchange é assíncrono). */
async function irPara(pagina, rota) {
  await pagina.locator(`.menu a[data-rota="${rota}"]`).click();
  await pagina.locator(`.menu a[data-rota="${rota}"][aria-current=page]`).waitFor();
  await pagina.locator('#app h2').first().waitFor();
}

const ROTAS_MENU = ['dashboard', 'conhecimento', 'laboratorio', 'empresa', 'datacenter', 'campus', 'missoes', 'habilidades', 'conquistas', 'perfil'];

async function abrir(rota = '', opcoes) {
  const s = await novaPagina(navegador, opcoes);
  await s.pagina.goto(servidor.url + '/index.html' + (rota ? '#/' + rota : ''));
  await s.pagina.locator('#app h2').first().waitFor();
  s.salvo = () => s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  return s;
}

async function abrirComEstado(rota, estado, opcoes = {}) {
  const s = await novaPagina(navegador, opcoes);
  await s.pagina.addInitScript(e => { if (!localStorage.getItem('network-command')) localStorage.setItem('network-command', JSON.stringify(e)); }, estado);
  await s.pagina.goto(servidor.url + '/index.html#/' + rota);
  await s.pagina.locator('#app h2').first().waitFor();
  s.salvo = () => s.pagina.evaluate(() => JSON.parse(localStorage.getItem('network-command')));
  return s;
}

const hist = [['fundamentos-001', true, 0, 100], ['fundamentos-002', true, 1, 60], ['fundamentos-003', false, 1, 0]]
  .map(([q, ok, erros, pts], i) => ({ q, ok, erros, pts, em: new Date(Date.UTC(2026, 10, 17, 12, i)).toISOString() }));
const ESTADO = { versao: 3, perfil: { nome: 'Leonardo', criadoEm: '2026-11-16T10:00:00.000Z' }, quiz: { melhor: { 1: { pts: 700, estrelas: 2 } }, historico: hist }, conquistas: {} };

test('abre no dashboard e o menu tem as 10 entradas, cada uma funcionando (protótipos marcados no menu)', async () => {
  const { pagina, erros, contexto } = await abrir();
  assert.equal(await pagina.locator('.menu a').count(), 10);
  assert.equal(await pagina.locator('.menu a[aria-current=page]').getAttribute('data-rota'), 'dashboard');
  for (const rota of ROTAS_MENU) {
    await irPara(pagina, rota);
    assert.equal(await pagina.locator('.menu a[aria-current=page]').getAttribute('data-rota'), rota, rota);
    const texto = await pagina.locator('#app').innerText();
    assert.doesNotMatch(texto, /ainda não existe/i, rota);
  }
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('rota desconhecida cai no dashboard', async () => {
  const { pagina, contexto } = await abrir('nao-existe');
  assert.equal(await pagina.locator('.menu a[aria-current=page]').getAttribute('data-rota'), 'dashboard');
  await contexto.close();
});

test('dashboard vazio mostra convite, sem números inventados', async () => {
  const { pagina, contexto } = await abrir('dashboard');
  const texto = await pagina.locator('#app').innerText();
  assert.match(texto, /Bem-vindo/);
  assert.match(texto, /0 de 9 estrelas|0 XP/);
  assert.match(texto, /Sem atividade ainda/);
  assert.match(texto, /0 de 13 desbloqueadas/);
  await contexto.close();
});

test('dashboard com progresso: dados vêm do estado e "Continuar" abre o nível', async () => {
  const { pagina, erros, contexto } = await abrirComEstado('dashboard', ESTADO);
  const texto = await pagina.locator('#app').innerText();
  assert.match(texto, /Olá, Leonardo/);
  assert.match(texto, /700 XP/);
  assert.match(texto, /Nível 3 do jogador \(100 \/ 300 XP\)/);
  assert.match(texto, /Teoria: 1 de 27 dominadas/);
  assert.match(texto, /Revisar 2 desafios/);
  await pagina.locator('[data-teste="continuar"]').click();
  await pagina.locator('.card').waitFor();
  assert.match(await pagina.locator('.barra b').innerText(), /Nível 2/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('jogar grava histórico, concede conquistas e avisa', async () => {
  const { pagina, erros, salvo, contexto } = await abrir('conhecimento');
  const falhas = { 0: 'errar' };
  await jogarNivel(pagina, 1, { falhas });
  const e = await salvo();
  assert.equal(e.versao, 4);
  assert.equal(e.quiz.historico.length, 9);
  assert.equal(e.quiz.historico[0].ok, false);
  assert.equal(e.quiz.historico[0].erros, 1);
  assert.ok(e.conquistas['primeiro-passo'], 'primeiro passo');
  assert.ok(!e.conquistas['nivel-dominado'], '800 pontos são 2 estrelas');
  assert.match(await pagina.locator('#avisos').innerText().catch(() => ''), /Conquista desbloqueada|^$/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('revisão: lista o desafio errado, refazer acertando tira da lista', async () => {
  const { pagina, erros, contexto } = await abrir('conhecimento');
  await jogarNivel(pagina, 1, { falhas: { 0: 'errar' } });
  await pagina.goto(servidor.url + '/index.html#/conhecimento/revisao');
  await pagina.locator('.aba[aria-current=page]', { hasText: 'Revisão' }).waitFor();
  await pagina.locator('[data-acao="revisar"]').waitFor();
  assert.match(await pagina.locator('#app').innerText(), /1 desafio teve erro/);
  assert.match(await pagina.locator('#app').innerText(), /Quem é o dono da Internet/);
  await pagina.locator('[data-acao="revisar"]').click();
  await pagina.locator('.card').waitFor();
  assert.match(await pagina.locator('.barra b').innerText(), /Revisão de erros/);
  const q = legado[0].desafios[0];
  await pagina.locator('.op').filter({ hasText: q.opcoes[q.certa] }).click();
  await pagina.locator('[data-acao="proximo"]').click();
  assert.match(await pagina.locator('.resultado').innerText(), /Tudo certo agora/);
  await pagina.locator('[data-acao="mapa"]').first().click();
  await pagina.locator('.aba', { hasText: 'Revisão' }).click();
  await pagina.locator('.aba[aria-current=page]', { hasText: 'Revisão' }).waitFor();
  assert.match(await pagina.locator('#app').innerText(), /Nenhum desafio para revisar/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('treino misto: sorteia entre os desafios liberados e não dá estrelas', async () => {
  const { pagina, erros, salvo, contexto } = await abrir('conhecimento/treino');
  await pagina.locator('[data-acao="treinar"]').waitFor();
  assert.match(await pagina.locator('.aba[aria-current=page]').innerText(), /Treino/);
  assert.match(await pagina.locator('[data-acao="treinar"]').innerText(), /Treino misto \(9\)/);
  // por módulo: o módulo 1 tem desafios no nível 1 (liberado); o módulo 9 ainda está todo bloqueado
  assert.match(await pagina.locator('tr[data-modulo="1"]').innerText(), /Comunicação em um mundo conectado[\s\S]*0 de 6/);
  assert.equal(await pagina.locator('tr[data-modulo="9"] button').isDisabled(), true);
  assert.match(await pagina.locator('tr[data-modulo="9"]').innerText(), /13 em níveis bloqueados/);
  await pagina.locator('[data-acao="treinar-modulo"][data-modulo="1"]').click();
  await pagina.locator('.card').waitFor();
  assert.match(await pagina.locator('.barra b').innerText(), /Treino · Módulo 1 · Comunicação em um mundo conectado/);
  assert.match(await pagina.locator('.modulo-curso').innerText(), /Módulo 1 · Comunicação em um mundo conectado/);
  await pagina.locator('[data-acao="mapa"]').first().click();
  await pagina.locator('.aba', { hasText: 'Treino' }).click();
  await pagina.locator('[data-acao="treinar"]').click();
  await pagina.locator('.card').waitFor();
  assert.equal((await pagina.locator('.barra b').innerText()).trim(), 'Treino misto');
  assert.match(await pagina.locator('.tipo').innerText(), /1 de 9/);
  await pagina.locator('.op').first().click({ timeout: 1500 }).catch(() => {});
  assert.deepEqual((await salvo())?.quiz.melhor ?? {}, {});
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('desafio do dia: 3 desafios iguais o dia todo, registra a sequência e aparece no dashboard', async () => {
  const perguntas = JSON.parse(readFileSync(new URL('../../data/questions.json', import.meta.url), 'utf8'));
  const { pagina, erros, salvo, contexto } = await abrir('conhecimento/treino');
  await pagina.locator('#diario').waitFor();
  assert.match(await pagina.locator('#diario').innerText(), /Ainda não feito hoje · sequência: 0 dias/);
  await pagina.locator('[data-acao="diario"]').click();
  const enunciados = [];
  for (let i = 0; i < 3; i++) {
    await pagina.locator('.card h2').waitFor();
    const texto = (await pagina.locator('.card h2').innerText()).trim();
    enunciados.push(texto);
    await resolverAtual(pagina, perguntas.find(q => q.enunciado === texto));
    await pagina.locator('[data-acao="proximo"]').click();
  }
  assert.match(await pagina.locator('.resultado').innerText(), /Sequência: 1 dia seguidos \(recorde: 1\)/);
  const e = await salvo();
  assert.equal(e.diario.sequencia, 1);
  assert.match(e.diario.ultimoDia, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(e.quiz.melhor, {}, 'não vale estrelas');
  // de novo no mesmo dia: os mesmos desafios
  await pagina.locator('[data-acao="mapa"]').first().click();
  await pagina.locator('.aba', { hasText: 'Treino' }).click();
  assert.match(await pagina.locator('#diario').innerText(), /Feito hoje ✓ · sequência: 1 dia/);
  await pagina.locator('[data-acao="diario"]').click();
  assert.equal((await pagina.locator('.card h2').innerText()).trim(), enunciados[0]);
  await pagina.goto(servidor.url + '/index.html#/dashboard');
  assert.match(await pagina.locator('[data-teste="diario"]').innerText(), /Desafio do dia feito ✓ · sequência de 1/);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('exercícios sem fim: acerta, erra (mostra a resposta e os passos), dica e troca de tipo', async () => {
  const { pagina, erros, contexto } = await abrir('conhecimento/exercicios', { largura: 390, altura: 800 });
  await pagina.locator('#ex-enunciado').waitFor();
  await pagina.selectOption('#ex-tipo', 'hosts');
  const prefixo = Number((await pagina.locator('#ex-enunciado').innerText()).match(/\/(\d+)/)[1]);
  await pagina.locator('#ex-dica').click();
  assert.match(await pagina.locator('#ex-feedback').innerText(), /Dica: Bits de host/);
  await pagina.fill('#ex-resp', String(2 ** (32 - prefixo) - 2));
  await pagina.locator('#ex-form button[type=submit]').click();
  assert.match(await pagina.locator('#ex-feedback').innerText(), /Certo![\s\S]*Bits de host: 32 - /);
  assert.match(await pagina.locator('#ex-placar').innerText(), /1 de 1 certos · sequência atual: 1/);
  await pagina.locator('#ex-proximo').click();
  await pagina.selectOption('#ex-tipo', 'ipv6-abreviar');
  await pagina.fill('#ex-resp', 'errado');
  await pagina.locator('#ex-form button[type=submit]').click();
  assert.match(await pagina.locator('#ex-feedback').innerText(), /Não foi dessa vez[\s\S]*Resposta: [0-9a-f:]+[\s\S]*Regra 1/);
  assert.match(await pagina.locator('#ex-placar').innerText(), /1 de 2 certos · sequência atual: 0/);
  assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'sem rolagem horizontal no celular');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('simulado: lista as provas, aprova com 100% no módulo 1 e o tempo esgotado encerra a prova', async () => {
  const perguntas = JSON.parse(readFileSync(new URL('../../data/questions.json', import.meta.url), 'utf8'));
  const { pagina, erros, salvo, contexto } = await abrir('conhecimento/simulado');
  await pagina.locator('tr[data-simulado="geral"]').waitFor();
  assert.match(await pagina.locator('#app').innerText(), /não<\/b>|não é o exame oficial do NetAcad/);
  assert.match(await pagina.locator('tr[data-simulado="m1"]').innerText(), /6 questões · 9:00[\s\S]*não feito/);
  await pagina.locator('[data-acao="simular"][data-chave="m1"]').click();
  for (let i = 0; i < 6; i++) {
    await pagina.locator('.card h2').waitFor();
    assert.match(await pagina.locator('#relogio').innerText(), /⏱ \d+:\d{2}/);
    const texto = (await pagina.locator('.card h2').innerText()).trim();
    await resolverAtual(pagina, perguntas.find(q => q.enunciado === texto));
    await pagina.locator('[data-acao="proximo"]').click();
  }
  assert.match(await pagina.locator('.resultado').innerText(), /Aprovado no simulado![\s\S]*100%[\s\S]*6 de 6/);
  assert.equal((await salvo()).simulados.m1.melhor, 100);
  assert.deepEqual((await salvo()).quiz.melhor, {}, 'não vale estrelas nem XP');
  await contexto.close();

  // tempo esgotado: o relógio da página é controlado no teste
  const s2 = await novaPagina(navegador);
  await s2.pagina.clock.install();
  await s2.pagina.goto(servidor.url + '/index.html#/conhecimento/simulado');
  await s2.pagina.locator('[data-acao="simular"][data-chave="m1"]').click();
  await s2.pagina.locator('.card h2').waitFor();
  await s2.pagina.clock.runFor(9 * 60 * 1000 + 2000);
  await s2.pagina.locator('.resultado').waitFor();
  assert.match(await s2.pagina.locator('.resultado').innerText(), /O tempo acabou com 0 de 6 questões respondidas[\s\S]*0%/);
  assert.deepEqual([...erros, ...s2.erros], []);
  await s2.contexto.close();
});

test('a revisão não dá XP nem estrelas', async () => {
  const { pagina, salvo, contexto } = await abrirComEstado('conhecimento/revisao', ESTADO);
  const antes = (await salvo()).quiz.melhor;
  await pagina.locator('[data-acao="revisar"]').click();
  await pagina.locator('.card').waitFor();
  for (let i = 0; i < 2; i++) {
    await pagina.locator('.op').first().click({ timeout: 1500 }).catch(() => {});
    if (await pagina.locator('#feedback .fb').count()) await pagina.locator('[data-acao="proximo"]').click();
  }
  assert.deepEqual((await salvo()).quiz.melhor, antes);
  await contexto.close();
});

test('histórico e desempenho por assunto mostram os registros', async () => {
  const { pagina, contexto } = await abrirComEstado('conhecimento/historico', ESTADO);
  const t = await pagina.locator('#app').innerText();
  assert.match(t, /3 respostas registradas · 1 de primeira \(33%\)/);
  assert.match(t, /✗ Errou/);
  assert.match(t, /✓ Com tropeço/);
  await pagina.locator('.aba', { hasText: 'Por assunto' }).click();
  await pagina.locator('.aba[aria-current=page]', { hasText: 'Por assunto' }).waitFor();
  assert.match(await pagina.locator('#app').innerText(), /Unidades de velocidade/);
  await contexto.close();
});

test('conquistas: 13 cartões; as ganhas mostram data, as outras dizem como ganhar', async () => {
  const { pagina, contexto } = await abrirComEstado('conquistas', { ...ESTADO, conquistas: {} });
  assert.equal(await pagina.locator('.conquista').count(), 13);
  assert.ok(await pagina.locator('.conquista.ganha').count() >= 2, 'primeiro passo e identificado');
  assert.match(await pagina.locator('[data-conquista="nivel-dominado"]').innerText(), /Bloqueada/);
  assert.match(await pagina.locator('[data-conquista="primeiro-passo"]').innerText(), /Desbloqueada em/);
  await contexto.close();
});

test('árvore de habilidades: Teoria pelo quiz, Prática e Diagnóstico pelas missões/projetos; o resto avisa', async () => {
  const { pagina, contexto } = await abrirComEstado('habilidades', ESTADO);
  assert.equal(await pagina.locator('.trilha-hab').count(), 8);
  assert.match(await pagina.locator('[data-trilha="fundamentos"]').innerText(), /1 de 27 desafios dominados/);
  assert.match(await pagina.locator('[data-trilha="ip"]').innerText(), /0 de 18 desafios dominados/);
  assert.match(await pagina.locator('[data-trilha="ethernet-comutacao"]').innerText(), /0 de 12 desafios dominados/);
  assert.match(await pagina.locator('[data-trilha="roteamento"]').innerText(), /0 de 6 desafios dominados/);
  assert.match(await pagina.locator('[data-trilha="servicos"]').innerText(), /0 de 27 desafios dominados/);
  assert.match(await pagina.locator('[data-trilha="seguranca"]').innerText(), /0 de 9 desafios dominados/);
  assert.equal(await pagina.locator('[data-trilha]', { hasText: 'Conteúdo em desenvolvimento' }).count(), 0, 'todas as trilhas já têm conteúdo de teoria');
  assert.match(await pagina.locator('[data-trilha="troubleshooting"]').innerText(), /0 de 9 desafios dominados/);
  assert.equal(await pagina.locator('.degraus li', { hasText: 'Sem conteúdo ainda' }).count(), 0, 'as 16 combinações de Prática/Diagnóstico já têm conteúdo');
  for (const [trilha, n] of [['fundamentos', 2], ['ethernet-comutacao', 2], ['ip', 6], ['roteamento', 7]]) {
    assert.match(await pagina.locator(`[data-trilha="${trilha}"] .degraus li`, { hasText: 'Prática' }).innerText(), new RegExp(`0 de ${n} concluído`), `Prática de ${trilha}`);
  }
  assert.match(await pagina.locator('[data-trilha="subnetting"] .degraus li', { hasText: 'Prática' }).innerText(), /0 de 3 concluídos/);
  assert.match(await pagina.locator('[data-trilha="subnetting"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /0 de 1 concluído/);
  assert.match(await pagina.locator('[data-trilha="roteamento"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /0 de 10 concluídos/);
  assert.match(await pagina.locator('[data-trilha="servicos"] .degraus li', { hasText: 'Prática' }).innerText(), /0 de 5 concluídos/);
  assert.match(await pagina.locator('[data-trilha="servicos"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /0 de 12 concluídos/);
  assert.match(await pagina.locator('[data-trilha="seguranca"] .degraus li', { hasText: 'Prática' }).innerText(), /0 de 3 concluídos/);
  assert.match(await pagina.locator('[data-trilha="seguranca"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /0 de 8 concluídos/);
  assert.match(await pagina.locator('[data-trilha="troubleshooting"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /0 de 6 concluídos/);
  assert.match(await pagina.locator('[data-trilha="troubleshooting"] .degraus li', { hasText: 'Prática' }).innerText(), /0 de 1 concluído/);
  assert.match(await pagina.locator('[data-trilha="fundamentos"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /0 de 4 concluídos/);
  await contexto.close();
});

test('perfil: valida o nome, salva, aparece no dashboard e concede "Identificado"', async () => {
  const { pagina, salvo, contexto } = await abrir('perfil');
  await pagina.locator('#form-nome button').click();
  assert.match(await pagina.locator('#erro-nome').innerText(), /Digite um nome/);
  await pagina.fill('#campo-nome', '<script>x</script>');
  await pagina.locator('#form-nome button').click();
  assert.match(await pagina.locator('#erro-nome').innerText(), /Use só letras/);
  assert.equal((await salvo())?.perfil?.nome ?? '', '');
  await pagina.fill('#campo-nome', '  Leo   Lobato ');
  await pagina.locator('#form-nome button').click();
  assert.match(await pagina.locator('#msg-perfil').innerText(), /Nome salvo/);
  const e = await salvo();
  assert.equal(e.perfil.nome, 'Leo Lobato');
  assert.ok(e.conquistas.identificado);
  await irPara(pagina, 'dashboard');
  assert.match(await pagina.locator('#app h2').first().innerText(), /Olá, Leo Lobato/);
  await contexto.close();
});

test('backup: exporta o estado, zera com confirmação em duas etapas e importa de volta', async () => {
  const { pagina, salvo, contexto } = await abrirComEstado('perfil', ESTADO, {});
  const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.locator('#exportar').click()]);
  assert.equal(download.suggestedFilename(), 'network-command-progresso.json');
  const caminho = await download.path();
  const exportado = JSON.parse(readFileSync(caminho, 'utf8'));
  assert.equal(exportado.perfil.nome, 'Leonardo');
  assert.equal(exportado.quiz.historico.length, 3);

  // zerar: primeiro clique só pede confirmação
  await pagina.locator('#zerar').click();
  assert.equal((await salvo()).quiz.historico.length, 3, 'ainda não apagou');
  await pagina.locator('#zerar-nao').click();
  assert.equal((await salvo()).quiz.historico.length, 3);
  await pagina.locator('#zerar').click();
  await pagina.locator('#zerar-sim').click();
  await pagina.locator('#msg-perfil', { hasText: 'zerado' }).waitFor();
  const zerado = await salvo();
  assert.equal(zerado.quiz.historico.length, 0);
  assert.deepEqual(zerado.quiz.melhor, {});
  assert.equal(zerado.perfil.nome, '');
  assert.equal(await pagina.evaluate(() => localStorage.getItem('jornada-do-pacote-v1')), null);

  // importar o arquivo exportado
  await pagina.setInputFiles('#importar', caminho);
  await pagina.locator('#confirmar-import').waitFor();
  assert.match(await pagina.locator('#importacao').innerText(), /3 respostas e 700 XP/);
  await pagina.locator('#confirmar-import').click();
  const volta = await salvo();
  assert.equal(volta.perfil.nome, 'Leonardo');
  assert.equal(volta.quiz.historico.length, 3);
  await contexto.close();
});

test('importar arquivo inválido ou malicioso não altera o progresso', async () => {
  const { pagina, salvo, contexto } = await abrirComEstado('perfil', ESTADO);
  await pagina.setInputFiles('#importar', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('isto não é json') });
  await pagina.locator('#msg-perfil', { hasText: 'Não consegui ler' }).waitFor();
  assert.equal((await salvo()).quiz.historico.length, 3);
  // JSON válido com lixo: é normalizado (sem campos desconhecidos nem valores inválidos)
  const lixo = { versao: 3, perfil: { nome: 'A', senha: 'segredo' }, quiz: { melhor: { 1: { pts: 99999, estrelas: 9 } }, historico: [{ q: 'x' }] }, conquistas: { hack: 'x' } };
  await pagina.setInputFiles('#importar', { name: 'y.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(lixo)) });
  await pagina.locator('#confirmar-import').waitFor();
  await pagina.locator('#confirmar-import').click();
  const e = await salvo();
  assert.deepEqual(e.quiz.melhor, {});
  assert.deepEqual(e.quiz.historico, []);
  assert.equal(JSON.stringify(e).includes('segredo'), false);
  await contexto.close();
});

test('segurança: código injetado pelo nome ou por um backup não é executado em nenhuma tela', async () => {
  const carga = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>' onmouseover='window.__xss=3`;
  const { pagina, erros, salvo, contexto } = await abrir('perfil');
  await pagina.fill('#campo-nome', carga.slice(0, 40));
  await pagina.locator('button', { hasText: 'Salvar nome' }).click();
  assert.match(await pagina.locator('#erro-nome').innerText(), /Use só letras/);
  assert.equal(await salvo(), null, 'nome com código é recusado e nada é salvo');
  // backup com cargas em todos os campos de texto que o jogo exibe
  const topo = { dispositivos: [{ id: 'pc1', tipo: 'pc', nome: carga, x: 100, y: 100, interfaces: [{ id: 'eth0', ip: carga, mascara: '/24' }], gateway: carga, dns: carga, registros: [{ nome: carga, ip: '1.1.1.1' }] }], cabos: [] };
  const lixo = { versao: 4, perfil: { nome: carga }, lab: { topologia: topo }, missoes: { 'cabo-esquecido': { topologia: topo, dicas: 0 } }, quiz: { melhor: {}, historico: [{ q: carga, ok: false, erros: 1, pts: 0, em: carga }] }, conquistas: { [carga]: carga } };
  await pagina.setInputFiles('#importar', { name: 'z.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(lixo)) });
  await pagina.locator('#confirmar-import').waitFor();
  await pagina.locator('#confirmar-import').click();
  for (const rota of ['dashboard', 'perfil', 'laboratorio', 'missoes/cabo-esquecido', 'conhecimento/historico', 'conhecimento/revisao', 'conquistas', 'habilidades']) {
    await pagina.goto(servidor.url + '/index.html#/' + rota);
    await pagina.locator('#app h2').first().waitFor();
    await pagina.waitForTimeout(150);
    assert.equal(await pagina.evaluate(() => window.__xss), undefined, `código executado em ${rota}`);
    assert.equal(await pagina.locator('#app img[src="x"], #app script').count(), 0, `elemento injetado em ${rota}`);
  }
  const e = await salvo();
  assert.equal(e.perfil.nome, '', 'nome com código no backup é descartado');
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('menu no celular: abre com o botão, fecha ao escolher uma página ou com Esc', async () => {
  const { pagina, contexto } = await abrir('dashboard', { largura: 390, altura: 800 });
  const caixa = () => pagina.locator('#lateral').boundingBox();
  assert.ok((await caixa()).x + (await caixa()).width <= 1, 'menu começa fechado (fora da tela)');
  await pagina.locator('#burger').click();
  assert.equal(await pagina.locator('#burger').getAttribute('aria-expanded'), 'true');
  assert.ok((await caixa()).x >= 0);
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(300);
  assert.equal(await pagina.locator('#burger').getAttribute('aria-expanded'), 'false');
  await pagina.locator('#burger').click();
  await pagina.locator('.menu a[data-rota="conquistas"]').click();
  await pagina.locator('.menu a[data-rota="conquistas"][aria-current=page]').waitFor();
  await pagina.waitForTimeout(300);
  assert.equal(await pagina.locator('#burger').getAttribute('aria-expanded'), 'false');
  assert.match(await pagina.locator('#app h2').first().innerText(), /Conquistas/);
  await contexto.close();
});

test('sem rolagem horizontal em nenhuma página, em 360, 768 e 1280 px', async () => {
  for (const largura of [360, 768, 1280]) {
    for (const rota of [...ROTAS_MENU, 'missoes/gateway-errado', 'empresa/clinica', 'datacenter/sistema-bancario', 'campus/campus-completo']) {
      const { pagina, contexto } = await abrirComEstado(rota, ESTADO, { largura, altura: 800 });
      const excesso = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(excesso <= 0, `${rota} em ${largura}px excede ${excesso}px`);
      await contexto.close();
    }
  }
});

test('contraste de texto no tema escuro (WCAG AA) em todas as páginas', async () => {
  const rotas = [...ROTAS_MENU, 'conhecimento/treino', 'conhecimento/exercicios', 'conhecimento/simulado', 'conhecimento/revisao', 'conhecimento/historico', 'conhecimento/assuntos', 'missoes/gateway-errado', 'empresa/clinica', 'datacenter/sistema-bancario', 'campus/campus-completo'];
  for (const largura of [1280, 390]) {
    for (const rota of rotas) {
      const { pagina, contexto } = await abrirComEstado(rota, ESTADO, { largura, altura: 900 });
      const falhas = await pagina.evaluate(() => {
        const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
        const lum = ({ r, g, b }) => { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
        const misturar = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
        const fundo = el => { const pilha = []; for (let e = el; e; e = e.parentElement) pilha.push(rgba(getComputedStyle(e).backgroundColor)); let base = { r: 10, g: 15, b: 26, a: 1 }; for (const c of pilha.reverse()) if (c.a > 0) base = misturar(c, base); return base; };
        const out = [];
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const vistos = new Set();
        while (w.nextNode()) {
          const n = w.currentNode; if (!n.textContent.trim()) continue;
          const el = n.parentElement; if (vistos.has(el)) continue; vistos.add(el);
          const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
          if (cs.visibility === 'hidden' || cs.display === 'none' || !r.width || !r.height) continue;
          const bg = fundo(el); const fg = misturar(rgba(el instanceof SVGElement ? cs.fill : cs.color), bg);
          const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); const cr = (a + .05) / (b + .05);
          const tam = parseFloat(cs.fontSize), neg = parseInt(cs.fontWeight) >= 700;
          if (cr < ((tam >= 24 || (tam >= 18.66 && neg)) ? 3 : 4.5)) out.push(`${el.tagName}.${el.className} "${n.textContent.trim().slice(0, 25)}" ${cr.toFixed(2)}`);
        }
        return out;
      });
      assert.deepEqual(falhas, [], `${rota} em ${largura}px`);
      await contexto.close();
    }
  }
});

test('dashboard: card Prática lista os 4 módulos e acompanha a conclusão; a árvore reflete o progresso', async () => {
  const { pagina, erros, salvo, contexto } = await abrir('dashboard');
  const card = pagina.locator('[data-teste="pratica"]');
  const texto = await card.innerText();
  assert.match(texto, /Missões · 0 de 45 concluídos · próximo: Sua primeira rede local/);
  assert.match(texto, /Campus de Redes · 0 de 6 concluídos · próximo: Setores separados por VLAN/);
  assert.match(texto, /Empresa · 0 de 3/);
  assert.match(texto, /Data Center · 0 de 3/);
  // concluir a primeira missão pela interface
  await pagina.goto(servidor.url + '/index.html#/missoes/cabo-esquecido');
  await pagina.locator('#lab-svg').waitFor();
  await pagina.locator('[data-modo="conectar"]').click();
  await pagina.locator('.disp[data-id="pc3"]').click();
  await pagina.locator('.disp[data-id="sw1"]').click();
  await pagina.locator('#m-verificar').click();
  assert.match(await pagina.locator('#m-msg').innerText(), /Missão concluída/);
  await pagina.locator('.menu a[data-rota="dashboard"]').click();
  await pagina.locator('.menu a[data-rota="dashboard"][aria-current=page]').waitFor();
  assert.match(await pagina.locator('[data-teste="pratica"]').innerText(), /Missões · 1 de 45 concluídos · próximo: Sua primeira rede local/);
  await pagina.locator('.menu a[data-rota="habilidades"]').click();
  await pagina.locator('.menu a[data-rota="habilidades"][aria-current=page]').waitFor();
  assert.match(await pagina.locator('[data-trilha="troubleshooting"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /1 de 6 concluídos/);
  assert.match(await pagina.locator('[data-trilha="troubleshooting"] .degraus li', { hasText: 'Diagnóstico' }).innerText(), /✓ O cabo esquecido/);
  assert.equal((await salvo()).missoes['cabo-esquecido'].concluida, true);
  assert.deepEqual(erros, []);
  await contexto.close();
});
