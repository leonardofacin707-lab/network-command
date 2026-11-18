import { esc } from '../core/ui.js';
import { dominioPorHabilidade } from './dominio.js';

export default {
  id: 'habilidades',
  montar(raiz, { catalogo, store }) {
    const dominio = dominioPorHabilidade(store.obter().quiz.historico, catalogo.perguntas);
    const { niveis, trilhas } = catalogo.habilidades;
    const catsDaTrilha = id => catalogo.categorias.filter(c => c.trilha === id).map(c => c.nome);
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Árvore de habilidades <span class="selo proto">protótipo</span></h2>
      <p class="sub">Cada trilha tem três níveis de domínio: <b>Teoria</b> (quiz), <b>Prática</b> (laboratório) e <b>Diagnóstico</b> (troubleshooting).
        Hoje só a Teoria tem conteúdo e é medida de verdade; Prática e Diagnóstico ficam trancados até o laboratório existir.</p>
      <div class="grade">${trilhas.map(t => {
        const cats = catsDaTrilha(t.id);
        return `<article class="painel trilha-hab" data-trilha="${t.id}">
          <h3>${esc(t.nome)}</h3>
          <p>${esc(t.descricao)}</p>
          <p><small>Categorias: ${esc(cats.join(', ') || '—')}</small></p>
          <ol class="degraus">${niveis.map(n => {
            const d = dominio[`${t.id}.${n.id}`];
            let estado;
            if (n.id === 'teoria') {
              estado = d && d.total
                ? `<b>${d.dominadas} de ${d.total}</b> desafios dominados
                   <div class="barra-prog" role="img" aria-label="${d.dominadas} de ${d.total} dominados"><i style="width:${d.dominadas / d.total * 100}%"></i></div>`
                : '<span class="aviso-txt">Conteúdo em desenvolvimento</span>';
            } else {
              estado = '<span class="aviso-txt">🔒 Disponível com o laboratório (em desenvolvimento)</span>';
            }
            return `<li><b>${esc(n.nome)}</b><br>${estado}</li>`;
          }).join('')}</ol>
        </article>`;
      }).join('')}</div>
    </div></section>`;
  }
};
