// Abas do módulo Conhecimento além do mapa: revisão de erros, histórico e desempenho por assunto.
import { esc, dataHora } from '../core/ui.js';
import { revisaoDeHoje, ultimaPorPergunta, estatisticas, foiPerfeita, INTERVALOS_DIAS } from './historico.js';
import { desempenhoPorAssunto } from '../hub/dominio.js';
import { desafiosLiberados, TAMANHO_TREINO, resumoPorModulo } from './treino.js';
import { diaLocal, sequenciaAtual, TAMANHO_DIARIO } from './diario.js';
import { opcoesSimulado, NOTA_APROVACAO, SEGUNDOS_POR_QUESTAO, formatarTempo } from './simulado.js';

const resumo = (t, n = 90) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const rotuloResultado = r => (foiPerfeita(r) ? '<span class="ok-txt">✓ De primeira</span>'
  : r.ok ? '<span class="aviso-txt">✓ Com tropeço</span>' : '<span class="ruim-txt">✗ Errou</span>');

export function telaRevisao(app, { catalogo, store }) {
  const historico = store.obter().quiz.historico;
  const { erros, reforcos, ids, futuras } = revisaoDeHoje(historico);
  const porId = new Map(catalogo.perguntas.map(q => [q.id, q]));
  const ultimas = ultimaPorPergunta(historico);
  const proximas = futuras.length ? `<p class="motivo">${futuras.length} ${futuras.length === 1 ? 'desafio volta' : 'desafios voltam'} nos próximos dias para reforço (o próximo em ${dataHora(futuras[0].venceEm.toISOString())}).</p>` : '';
  const explica = `<p class="motivo">Repetição espaçada: depois de acertar um desafio que você tinha errado, ele volta para reforço depois de ${INTERVALOS_DIAS.join(', ')} dias. Depois de ${INTERVALOS_DIAS.length} acertos espaçados, sai da lista.</p>`;
  if (!ids.length) {
    app.innerHTML = `<section class="band"><div class="wrap painel">
      <h2>Revisão de erros</h2>
      <p class="vazio-msg">${historico.length ? 'Nenhum desafio para revisar agora.' : 'Ainda não há respostas. Jogue um nível no mapa e os desafios com erro aparecerão aqui.'}</p>
      ${proximas}${historico.length ? explica : ''}
    </div></section>`;
    return;
  }
  const linha = (id, tipo) => { const q = porId.get(id); const r = ultimas.get(id); return `<tr>
    <td>${esc(resumo(q.enunciado))}</td><td>${esc(q.assunto)}</td><td>${tipo === 'reforco' ? '<span class="aviso-txt">↻ Reforço</span>' : rotuloResultado(r)}<br><small>${dataHora(r.em)}</small></td></tr>`; };
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Revisão de erros</h2>
    <p>${erros.length ? `${erros.length} ${erros.length === 1 ? 'desafio teve' : 'desafios tiveram'} erro na última tentativa.` : ''}${reforcos.length ? ` ${reforcos.length} ${reforcos.length === 1 ? 'desafio volta' : 'desafios voltam'} hoje para reforço.` : ''} Refazer não vale pontos.</p>
    <table class="tabela"><thead><tr><th>Desafio</th><th>Assunto</th><th>Situação</th></tr></thead><tbody>
      ${erros.map(id => linha(id, 'erro')).join('')}${reforcos.map(id => linha(id, 'reforco')).join('')}
    </tbody></table>
    <div class="acoes"><button class="btn" data-acao="revisar">Revisar agora (${ids.length})</button></div>
    ${proximas}${explica}
  </div></section>`;
}

export function telaHistorico(app, { catalogo, store }) {
  const historico = store.obter().quiz.historico;
  const porId = new Map(catalogo.perguntas.map(q => [q.id, q]));
  const est = estatisticas(historico);
  if (!historico.length) {
    app.innerHTML = `<section class="band"><div class="wrap painel"><h2>Histórico de respostas</h2>
      <p class="vazio-msg">Nada por aqui ainda. Cada desafio que você responder fica registrado neste dispositivo.</p></div></section>`;
    return;
  }
  const recentes = [...historico].reverse().slice(0, 40);
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Histórico de respostas</h2>
    <p>${est.total} respostas registradas · ${est.perfeitas} de primeira (${Math.round(est.taxa * 100)}%). Mostrando as ${recentes.length} mais recentes.</p>
    <table class="tabela"><thead><tr><th>Quando</th><th>Desafio</th><th>Resultado</th><th>Pontos</th></tr></thead><tbody>
      ${recentes.map(r => `<tr><td>${dataHora(r.em)}</td><td>${esc(resumo(porId.get(r.q).enunciado, 70))}</td><td>${rotuloResultado(r)}</td><td>${r.pts}</td></tr>`).join('')}
    </tbody></table>
  </div></section>`;
}

export function telaAssuntos(app, { catalogo, store }) {
  const lista = desempenhoPorAssunto(store.obter().quiz.historico, catalogo.perguntas)
    .sort((a, b) => a.taxa - b.taxa || b.tentativas - a.tentativas);
  const nomeCat = Object.fromEntries(catalogo.categorias.map(c => [c.id, c.nome]));
  if (!lista.length) {
    app.innerHTML = `<section class="band"><div class="wrap painel"><h2>Desempenho por assunto</h2>
      <p class="vazio-msg">O desempenho aparece aqui depois das primeiras respostas. Da pior para a melhor taxa de acertos de primeira.</p></div></section>`;
    return;
  }
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Desempenho por assunto</h2>
    <p>Acertos de primeira em relação às tentativas, do assunto que mais precisa de atenção para o mais firme.</p>
    <table class="tabela"><thead><tr><th>Assunto</th><th>Categoria</th><th>Tentativas</th><th>De primeira</th></tr></thead><tbody>
      ${lista.map(a => `<tr><td>${esc(a.assunto)}</td><td>${esc(nomeCat[a.categoria] ?? a.categoria)}</td><td>${a.tentativas}</td>
        <td><div class="barra-prog" role="img" aria-label="${Math.round(a.taxa * 100)}% de acertos de primeira"><i style="width:${a.taxa * 100}%"></i></div>${Math.round(a.taxa * 100)}%</td></tr>`).join('')}
    </tbody></table>
  </div></section>`;
}

export function telaTreino(app, { catalogo, store }) {
  const { melhor, historico } = store.obter().quiz;
  const pool = desafiosLiberados(catalogo.niveis, melhor);
  const quantos = Math.min(TAMANHO_TREINO, pool.length);
  const resumo = resumoPorModulo(catalogo.niveis, melhor, historico, catalogo.modulos);
  const diario = store.obter().diario, hoje = diaLocal(), feito = diario?.ultimoDia === hoje, seq = sequenciaAtual(diario, hoje);
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Treino</h2>
    <div class="diario" id="diario">
      <h3>Desafio do dia</h3>
      <p>${TAMANHO_DIARIO} desafios rápidos, os mesmos o dia todo, sorteados entre os níveis liberados. Bom para uma pausa curta.</p>
      <p><b>${feito ? 'Feito hoje ✓' : 'Ainda não feito hoje'}</b> · sequência: ${seq} ${seq === 1 ? 'dia' : 'dias'}${diario?.melhor ? ` (recorde: ${diario.melhor})` : ''}</p>
      <div class="acoes"><button class="btn" data-acao="diario" ${pool.length ? '' : 'disabled'}>${feito ? 'Refazer o de hoje' : 'Fazer o desafio do dia'}</button></div>
    </div>
    <h3>Treino livre</h3>
    <p>Sorteia até ${TAMANHO_TREINO} desafios dos níveis que você já liberou. Não vale pontos nem estrelas, mas as respostas entram no histórico: o que você errar vai para a revisão de erros.</p>
    <div class="acoes"><button class="btn" data-acao="treinar" ${quantos ? '' : 'disabled'}>Treino misto (${quantos})</button></div>
    <h3>Por módulo do curso</h3>
    <p>Treine só um módulo do curso Conceitos Básicos de Redes, enquanto estuda ele no NetAcad. "Dominados" são os desafios cuja última tentativa foi certa de primeira.</p>
    <table class="tabela modulos"><thead><tr><th scope="col">Módulo</th><th scope="col">Dominados</th><th scope="col"><span class="sr-only">Ação</span></th></tr></thead><tbody>
      ${resumo.map(m => `<tr data-modulo="${m.id}"><th scope="row">${m.id ? `<small>Módulo ${m.id}</small><br>` : ''}${esc(m.nome)}</th>
        <td>${m.dominados} de ${m.total}${m.liberados < m.total ? `<br><small class="motivo">${m.total - m.liberados} em níveis bloqueados</small>` : ''}</td>
        <td><button class="btn-sec" data-acao="treinar-modulo" data-modulo="${m.id}" ${m.liberados ? '' : 'disabled'} aria-label="Treinar ${m.id ? 'o módulo ' + m.id : 'o bônus'} (${Math.min(TAMANHO_TREINO, m.liberados)} desafios)">Treinar (${Math.min(TAMANHO_TREINO, m.liberados)})</button></td></tr>`).join('')}
    </tbody></table>
  </div></section>`;
}

export function telaSimulado(app, { catalogo, store }) {
  const feitos = store.obter().simulados ?? {};
  const opcoes = opcoesSimulado(catalogo.perguntas, catalogo.modulos);
  app.innerHTML = `<section class="band"><div class="wrap painel">
    <h2>Simulado com tempo</h2>
    <p>Prova cronometrada no estilo dos exames de módulo: ${formatarTempo(SEGUNDOS_POR_QUESTAO)} por questão, vale só o acerto de primeira e a aprovação é com ${Math.round(NOTA_APROVACAO * 100)}%. Inclui desafios de níveis ainda bloqueados no mapa.</p>
    <p class="motivo">Simulado de estudo, com perguntas escritas para o jogo: <b>não</b> é o exame oficial do NetAcad e não vale certificado. Não dá XP; os erros vão para a revisão.</p>
    <table class="tabela modulos"><thead><tr><th scope="col">Prova</th><th scope="col">Melhor nota</th><th scope="col"><span class="sr-only">Ação</span></th></tr></thead><tbody>
      ${opcoes.map(o => { const f = feitos[o.chave]; return `<tr data-simulado="${o.chave}"><th scope="row">${esc(o.nome)}<br><small>${o.total} questões · ${formatarTempo(o.total * SEGUNDOS_POR_QUESTAO)}</small></th>
        <td>${f ? `${f.melhor}% ${f.melhor >= NOTA_APROVACAO * 100 ? '<span class="ok-txt">✓ aprovado</span>' : ''}<br><small>${f.tentativas} ${f.tentativas === 1 ? 'tentativa' : 'tentativas'}</small>` : '<small>não feito</small>'}</td>
        <td><button class="btn-sec" data-acao="simular" data-chave="${o.chave}" aria-label="Começar ${esc(o.nome)}">Começar</button></td></tr>`; }).join('')}
    </tbody></table>
  </div></section>`;
}
