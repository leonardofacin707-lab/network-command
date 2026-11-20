import { esc, dataHora } from '../core/ui.js';
import { xpDoEstado, cargoDe, nivelDoJogador } from '../core/progression.js';
import { normalizar, apagar, estadoInicial, MAX_NOME, NOME_VALIDO } from '../core/storage.js';
import { estatisticas } from '../quiz/historico.js';
import { CONQUISTAS } from './conquistas-regras.js';


/** Valida o nome de exibição. Devolve { nome } ou { erro }. */
export function validarNome(texto) {
  const nome = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!nome) return { erro: 'Digite um nome.' };
  if (nome.length > MAX_NOME) return { erro: `Use no máximo ${MAX_NOME} caracteres.` };
  if (!NOME_VALIDO.test(nome)) return { erro: 'Use só letras, números, espaço, ponto, hífen, apóstrofo ou sublinhado.' };
  return { nome };
}

export default {
  id: 'perfil',
  montar(raiz, { catalogo, referencia, store }) {
    const controle = new AbortController();
    const { signal } = controle;
    let pendente = null; // estado lido de um arquivo, aguardando confirmação

    function desenhar(mensagem = '') {
      const estado = store.obter();
      const xp = xpDoEstado(estado);
      const nivel = nivelDoJogador(xp);
      const est = estatisticas(estado.quiz.historico);
      raiz.innerHTML = `<section class="band"><div class="wrap">
        <h2 class="titulo-pagina">Perfil</h2>
        <p class="sub">Seus dados ficam só neste navegador (localStorage). Não há conta, senha nem envio para servidor.</p>
        <div class="grade">
          <article class="painel">
            <h3>Nome de exibição</h3>
            <form id="form-nome" novalidate>
              <label for="campo-nome">Como devo te chamar?</label><br>
              <input id="campo-nome" class="campo" type="text" maxlength="${MAX_NOME}" autocomplete="off" value="${esc(estado.perfil.nome)}" aria-describedby="erro-nome">
              <button class="btn" type="submit">Salvar nome</button>
              <p id="erro-nome" class="ruim-txt" role="alert"></p>
            </form>
            <p><small>Jogando desde ${dataHora(estado.perfil.criadoEm)}</small></p>
          </article>
          <article class="painel">
            <h3>Resumo</h3>
            <ul>
              <li>Cargo: <b>${cargoDe(xp)}</b></li>
              <li>XP: <b>${xp.toLocaleString('pt-BR')}</b> · Nível ${nivel.nivel} do jogador</li>
              <li>Respostas: <b>${est.total}</b> (${est.perfeitas} de primeira)</li>
              <li>Conquistas: <b>${CONQUISTAS.filter(c => estado.conquistas[c.id]).length} de ${CONQUISTAS.length}</b></li>
            </ul>
          </article>
          <article class="painel">
            <h3>Backup do progresso</h3>
            <p>Exporte um arquivo para guardar ou levar o progresso para outro navegador.</p>
            <div class="acoes"><button class="btn-sec" id="exportar">Exportar progresso</button></div>
            <p><label for="importar">Importar progresso</label><br><input id="importar" type="file" accept="application/json,.json"></p>
            <div id="importacao" aria-live="polite">${pendente ? `<p>Arquivo lido: <b>${pendente.quiz.historico.length}</b> respostas e <b>${xpDoEstado(pendente).toLocaleString('pt-BR')}</b> XP. Isso <b>substitui</b> o progresso atual.</p>
              <div class="acoes"><button class="btn" id="confirmar-import">Substituir meu progresso</button><button class="btn-sec" id="cancelar-import">Cancelar</button></div>` : ''}</div>
          </article>
          <article class="painel">
            <h3>Zerar progresso</h3>
            <p>Apaga XP, estrelas, histórico e conquistas deste navegador. Não dá para desfazer (exporte antes, se quiser guardar).</p>
            <div class="acoes" id="zerar-area"><button class="btn-sec btn-perigo" id="zerar">Zerar progresso</button></div>
          </article>
        </div>
        <p id="msg-perfil" class="ok-txt" role="status">${esc(mensagem)}</p>
      </div></section>`;
    }

    desenhar();

    raiz.addEventListener('submit', e => {
      if (e.target.id !== 'form-nome') return;
      e.preventDefault();
      const r = validarNome(raiz.querySelector('#campo-nome').value);
      if (r.erro) { raiz.querySelector('#erro-nome').textContent = r.erro; raiz.querySelector('#campo-nome').setAttribute('aria-invalid', 'true'); return; }
      store.alterar(s => ({ ...s, perfil: { ...s.perfil, nome: r.nome } }));
      desenhar('Nome salvo.');
    }, { signal });

    raiz.addEventListener('click', e => {
      const id = e.target.closest('button')?.id;
      if (!id) return;
      if (id === 'exportar') {
        const blob = new Blob([JSON.stringify(store.obter(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: 'network-command-progresso.json' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        raiz.querySelector('#msg-perfil').textContent = 'Arquivo gerado.';
      } else if (id === 'confirmar-import') {
        store.substituir(pendente); pendente = null; desenhar('Progresso importado.');
      } else if (id === 'cancelar-import') {
        pendente = null; desenhar();
      } else if (id === 'zerar') {
        raiz.querySelector('#zerar-area').innerHTML = `<p class="ruim-txt">Tem certeza? Isso apaga todo o progresso deste navegador.</p>
          <button class="btn btn-perigo" id="zerar-sim">Sim, apagar tudo</button><button class="btn-sec" id="zerar-nao">Cancelar</button>`;
      } else if (id === 'zerar-nao') {
        desenhar();
      } else if (id === 'zerar-sim') {
        apagar();
        store.substituir(estadoInicial());
        desenhar('Progresso zerado.');
      }
    }, { signal });

    raiz.addEventListener('change', async e => {
      if (e.target.id !== 'importar' || !e.target.files[0]) return;
      const arquivo = e.target.files[0];
      try {
        if (arquivo.size > 1_000_000) throw new Error('grande');
        const bruto = JSON.parse(await arquivo.text());
        if (!bruto || typeof bruto !== 'object') throw new Error('formato');
        pendente = normalizar(bruto, referencia);
        desenhar();
      } catch {
        desenhar();
        raiz.querySelector('#msg-perfil').className = 'ruim-txt';
        raiz.querySelector('#msg-perfil').textContent = 'Não consegui ler esse arquivo. Use um arquivo exportado pelo próprio Network Command.';
      }
    }, { signal });

    return () => controle.abort();
  }
};
