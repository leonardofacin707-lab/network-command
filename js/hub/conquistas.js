import { esc, dataHora } from '../core/ui.js';
import { CONQUISTAS } from './conquistas-regras.js';

export default {
  id: 'conquistas',
  montar(raiz, { store }) {
    const { conquistas } = store.obter();
    const n = CONQUISTAS.filter(c => conquistas[c.id]).length;
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Conquistas</h2>
      <p class="sub">${n} de ${CONQUISTAS.length} desbloqueadas. Cada conquista é concedida por uma regra verificável sobre o que você fez. Novas conquistas chegam junto com o laboratório e as missões (em desenvolvimento).</p>
      <div class="grade">${CONQUISTAS.map(c => {
        const em = conquistas[c.id];
        return `<article class="painel conquista ${em ? 'ganha' : 'trancada'}" data-conquista="${c.id}">
          <h3>${em ? '🏆' : '🔒'} ${esc(c.nome)}</h3>
          <p>${esc(c.descricao)}</p>
          <p>${em ? `<span class="ok-txt">Desbloqueada em ${dataHora(em)}</span>` : '<span class="aviso-txt">Bloqueada</span>'}</p>
        </article>`;
      }).join('')}</div>
    </div></section>`;
  }
};
