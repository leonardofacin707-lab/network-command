// Tela inicial: botão "Jogar" que abre os modos de jogo. Não há login nesta versão: o progresso é deste aparelho.
import { esc } from '../core/ui.js';
import { diaLocal } from '../quiz/diario.js';
import { provedorAtivo } from '../conta/provedores.js';

/** Modos de jogo (todos levam a páginas que existem). */
function modos(estado, ctx) {
  const feitas = id => ctx.missoes.filter(m => m.modulo === id && estado.missoes[m.id]?.concluida).length;
  const total = id => ctx.missoes.filter(m => m.modulo === id).length;
  const lista = [
    { href: '#/tutorial', nome: 'Tutorial', desc: 'Monte sua primeira rede passo a passo: cabos, endereços IP e ping.', meta: estado.tutorial?.concluido ? 'Concluído ✓' : 'Comece por aqui', destaque: !estado.tutorial?.concluido },
    { href: '#/conhecimento', nome: 'Quiz por níveis', desc: 'Perguntas dos módulos do curso, com explicação em cada resposta.', meta: `${Object.keys(estado.quiz.melhor).length} de ${ctx.catalogo.niveis.length} níveis jogados` },
    { href: '#/conhecimento/treino', nome: 'Treino e desafio do dia', desc: 'Treino misto ou por módulo e 3 desafios novos por dia.', meta: estado.diario?.ultimoDia === diaLocal() ? 'Desafio de hoje feito ✓' : 'Desafio de hoje disponível' },
    { href: '#/conhecimento/simulado', nome: 'Simulado', desc: 'Prova cronometrada para treinar para o exame do curso (não é o exame oficial).', meta: `${Object.keys(estado.simulados ?? {}).length} simulados feitos` },
    { href: '#/missoes', nome: 'Missões', desc: 'Redes com defeito para diagnosticar e consertar no simulador.', meta: `${feitas('missoes')} de ${total('missoes')} concluídas` },
    { href: '#/campus', nome: 'Campus de Redes', desc: 'VLANs, trunks e roteamento entre VLANs em uma rede de campus.', meta: `${feitas('campus')} de ${total('campus')} concluídas` },
    { href: '#/laboratorio', nome: 'Laboratório livre', desc: 'Monte qualquer rede e teste no terminal simulado.', meta: 'Sem objetivo: experimente' },
    { href: '#/empresa', nome: 'Empresa', desc: 'Planeje a rede de uma empresa: sub-redes e equipamentos.', meta: `${ctx.empresa.projetos.length} projetos` },
    { href: '#/datacenter', nome: 'Data Center', desc: 'Dimensione as camadas de um data center para cada desafio.', meta: `${ctx.datacenter.desafios.length} desafios` }
  ];
  return lista;
}

export default {
  id: 'inicio',
  montar(raiz, ctx) {
    const { store } = ctx;
    let aberto = false;
    const desenhar = () => {
      const estado = store.obter();
      const nome = estado.perfil.nome;
      raiz.innerHTML = `<section class="band inicio"><div class="wrap">
        <div class="painel inicio-capa">
          <h2 class="inicio-marca">NETWORK <span>COMMAND</span></h2>
          <p class="sub">Jogo de estudo de redes: quiz, simulador e missões de diagnóstico.${nome ? ` Bem-vindo de volta, <b>${esc(nome)}</b>.` : ''}</p>
          <button class="btn btn-jogar" id="jogar" type="button" aria-expanded="${aberto}" aria-controls="modos">Jogar</button>
          <p class="inicio-conta">Modo: <b>${esc(provedorAtivo().nome)}</b> (sem login). Para continuar em outro aparelho, use
            <a href="#/sincronizar">Sincronizar progresso</a>. Login com conta: não disponível nesta versão.</p>
        </div>
        <div id="modos" class="inicio-modos" ${aberto ? '' : 'hidden'}>
          <h2>Escolha como jogar</h2>
          <ul class="modos">${modos(estado, ctx).map(m => `<li><a class="modo${m.destaque ? ' destaque' : ''}" href="${m.href}">
            <b>${esc(m.nome)}</b><span>${esc(m.desc)}</span><small>${esc(m.meta)}</small></a></li>`).join('')}</ul>
          <p class="sub"><a href="#/dashboard">Ver o painel com todo o seu progresso</a></p>
        </div>
      </div></section>`;
      raiz.querySelector('#jogar').addEventListener('click', () => {
        aberto = !aberto;
        const botao = raiz.querySelector('#jogar');
        botao.setAttribute('aria-expanded', String(aberto));
        raiz.querySelector('#modos').hidden = !aberto;
        if (aberto) raiz.querySelector('#modos .modo')?.focus();
      });
    };
    desenhar();
    return store.ouvir(desenhar);
  }
};
