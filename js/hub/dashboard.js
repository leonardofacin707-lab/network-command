import { esc, dataHora } from '../core/ui.js';
import { xpDoEstado, cargoDe, nivelDoJogador, estrelasTotal } from '../core/progression.js';
import { statusDoNivel } from '../quiz/unlock.js';
import { listaRevisao, estatisticas, foiPerfeita } from '../quiz/historico.js';
import { dominioPorHabilidade, desempenhoPorAssunto, pontosFracos, resumoPratica } from './dominio.js';
import { CONQUISTAS } from './conquistas-regras.js';
import { diaLocal, sequenciaAtual } from '../quiz/diario.js';

export default {
  id: 'dashboard',
  montar(raiz, { catalogo, store, missoes, empresa, datacenter }) {
    const estado = store.obter();
    const { melhor, historico } = estado.quiz;
    const xp = xpDoEstado(estado);
    const nivel = nivelDoJogador(xp);
    const proximo = catalogo.niveis.find(n => statusDoNivel(n, catalogo.niveis, melhor) === 'aberto');
    const dominio = dominioPorHabilidade(historico, catalogo.perguntas);
    const trilhas = catalogo.habilidades.trilhas
      .map(t => ({ t, d: dominio[`${t.id}.teoria`] }))
      .filter(x => x.d && x.d.total > 0);
    const fracos = pontosFracos(desempenhoPorAssunto(historico, catalogo.perguntas));
    const revisao = listaRevisao(historico);
    const est = estatisticas(historico);
    const recentes = [...historico].reverse().slice(0, 5);
    const porId = new Map(catalogo.perguntas.map(q => [q.id, q]));
    const desbloqueadas = CONQUISTAS.filter(c => estado.conquistas[c.id])
      .sort((a, b) => estado.conquistas[b.id].localeCompare(estado.conquistas[a.id]));
    const nome = estado.perfil.nome;
    const pratica = resumoPratica(estado, { missoes, empresa, datacenter });

    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">${nome ? `Olá, ${esc(nome)}` : 'Bem-vindo ao Network Command'}</h2>
      <p class="sub">${nome ? 'Este é o seu painel de controle.' : 'Escolha um nome de exibição no <a href="#/perfil">perfil</a> para personalizar o painel.'} Tudo aqui vem do que você já respondeu neste dispositivo.</p>
      <div class="grade">
        <article class="painel">
          <h3>Progressão</h3>
          <p><b>${cargoDe(xp)}</b> · ${xp.toLocaleString('pt-BR')} XP · ${estrelasTotal(melhor)} de ${catalogo.jogaveis.length * 3} estrelas</p>
          <p>Nível ${nivel.nivel} do jogador (${nivel.xpNoNivel} / ${nivel.xpParaProximo} XP)</p>
          <div class="barra-prog" role="progressbar" aria-label="Progresso até o próximo nível do jogador" aria-valuemin="0" aria-valuemax="${nivel.xpParaProximo}" aria-valuenow="${nivel.xpNoNivel}"><i style="width:${nivel.xpNoNivel / nivel.xpParaProximo * 100}%"></i></div>
        </article>

        <article class="painel">
          <h3>Continuar</h3>
          ${proximo
            ? `<p>Próximo destino: <b>${esc(proximo.nome)}</b> (${esc(proximo.modulos)}).</p>
               <div class="acoes"><a class="btn" data-teste="continuar" href="#/conhecimento/nivel/${proximo.id}">Jogar nível ${proximo.id}</a></div>`
            : `<p>Você completou todos os níveis disponíveis do quiz. Rejogue para chegar a 3 estrelas em todos.</p>
               <div class="acoes"><a class="btn-sec" href="#/conhecimento">Abrir o mapa</a></div>`}
        </article>

        <article class="painel" data-teste="pratica">
          <h3>Prática</h3>
          <ul class="resumo-pratica">${pratica.map(r => `<li><a href="#/${r.modulo}"><b>${esc(r.rotulo)}</b></a> · ${r.feitos} de ${r.total} concluídos${r.proximo
            ? ` · próximo: <a href="#/${r.modulo}/${r.proximo.id}">${esc(r.proximo.titulo)}</a>` : ' · <span class="ok-txt">tudo concluído</span>'}</li>`).join('')}</ul>
          <div class="acoes"><a class="btn-sec" href="#/laboratorio">Abrir o laboratório livre</a></div>
        </article>

        <article class="painel">
          <h3>Trilhas de aprendizagem</h3>
          ${trilhas.length ? trilhas.map(({ t, d }) => `
            <p>${esc(t.nome)} · Teoria: ${d.dominadas} de ${d.total} dominadas</p>
            <div class="barra-prog" role="img" aria-label="${d.dominadas} de ${d.total} desafios dominados"><i style="width:${d.dominadas / d.total * 100}%"></i></div>`).join('')
            : '<p class="vazio-msg">Nenhuma trilha com conteúdo ainda.</p>'}
          <div class="acoes"><a class="btn-sec" href="#/habilidades">Ver árvore de habilidades</a></div>
        </article>

        <article class="painel">
          <h3>Pontos de atenção</h3>
          ${fracos.length ? `<ul>${fracos.map(a => `<li>${esc(a.assunto)}: ${Math.round(a.taxa * 100)}% de acertos de primeira (${a.tentativas} ${a.tentativas === 1 ? 'tentativa' : 'tentativas'})</li>`).join('')}</ul>`
            : `<p class="vazio-msg">${historico.length ? 'Nenhum assunto abaixo de 100% de acertos de primeira.' : 'Responda alguns desafios e os assuntos mais difíceis aparecem aqui.'}</p>`}
          <div class="acoes">${revisao.length ? `<a class="btn-sec" data-teste="revisao" href="#/conhecimento/revisao">Revisar ${revisao.length} ${revisao.length === 1 ? 'desafio' : 'desafios'}</a>` : ''}
            <a class="btn-sec" href="#/conhecimento/assuntos">Desempenho por assunto</a>
            <a class="btn-sec" data-teste="diario" href="#/conhecimento/treino">${estado.diario?.ultimoDia === diaLocal() ? 'Desafio do dia feito ✓' : 'Desafio do dia'}${sequenciaAtual(estado.diario, diaLocal()) ? ` · sequência de ${sequenciaAtual(estado.diario, diaLocal())}` : ''}</a></div>
        </article>

        <article class="painel">
          <h3>Atividade recente</h3>
          ${recentes.length ? `<ul>${recentes.map(r => `<li>${foiPerfeita(r) ? '<span class="ok-txt">✓</span>' : r.ok ? '<span class="aviso-txt">✓</span>' : '<span class="ruim-txt">✗</span>'}
              ${esc(porId.get(r.q).assunto)} <small>· ${dataHora(r.em)}</small></li>`).join('')}</ul>
              <p>${est.total} respostas no total, ${est.perfeitas} de primeira.</p>`
            : '<p class="vazio-msg">Sem atividade ainda.</p>'}
        </article>

        <article class="painel">
          <h3>Conquistas</h3>
          <p>${desbloqueadas.length} de ${CONQUISTAS.length} desbloqueadas.</p>
          ${desbloqueadas.length ? `<ul>${desbloqueadas.slice(0, 3).map(c => `<li>${esc(c.nome)}</li>`).join('')}</ul>` : ''}
          <div class="acoes"><a class="btn-sec" href="#/conquistas">Ver todas</a></div>
        </article>
      </div>
    </div></section>`;
  }
};
