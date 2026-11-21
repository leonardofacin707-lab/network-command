// Configurações (aberta pela engrenagem no canto superior direito). Só mostra opções que funcionam nesta versão.
import { esc } from '../core/ui.js';
import { limparConfig } from '../core/config.js';
import { aplicarConfig } from '../app/aparencia.js';
import { PROVEDORES, provedorAtivo } from '../conta/provedores.js';

const radio = (grupo, valor, atual, rotulo, ajuda) => `<label class="opcao">
  <input type="radio" name="${grupo}" value="${valor}" ${atual === valor ? 'checked' : ''}>
  <span><b>${esc(rotulo)}</b>${ajuda ? `<small>${esc(ajuda)}</small>` : ''}</span></label>`;

export default {
  id: 'config',
  montar(raiz, { store }) {
    const cfg = store.obter().config;
    const ativo = provedorAtivo();
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Configurações</h2>
      <p class="sub">Estas preferências valem só para este aparelho e são salvas na hora.</p>
      <form id="form-config" class="grade" novalidate>
        <fieldset class="painel">
          <legend><h3>Animações</h3></legend>
          ${radio('movimento', 'sistema', cfg.movimento, 'Seguir o sistema', 'Reduz as animações se o aparelho pedir movimento reduzido.')}
          ${radio('movimento', 'reduzir', cfg.movimento, 'Reduzir sempre', 'Sem animação de pacotes, tremidas e transições.')}
        </fieldset>
        <fieldset class="painel">
          <legend><h3>Ao abrir o jogo</h3></legend>
          ${radio('inicio', 'inicio', cfg.inicio, 'Tela inicial', 'Com o botão "Jogar" e os modos de jogo.')}
          ${radio('inicio', 'dashboard', cfg.inicio, 'Dashboard', 'Direto no painel com o seu progresso.')}
        </fieldset>
      </form>
      <p id="cfg-msg" class="ok-txt" role="status"></p>
      <div class="grade">
        <article class="painel">
          <h3>Conta</h3>
          <p>Em uso: <b>${esc(ativo.nome)}</b>. ${esc(ativo.descricao)}</p>
          <p class="motivo">Entrar com conta (login) ainda não existe nesta versão. O jogo já está organizado para receber essa opção no futuro;
            quando ela existir, vai aparecer aqui. Nenhuma senha é pedida nem guardada pelo jogo.</p>
          <p class="meta">Formas de salvar disponíveis: ${PROVEDORES.map(p => esc(p.nome)).join(', ')}.</p>
        </article>
        <article class="painel">
          <h3>Progresso em outro aparelho</h3>
          <p>Leve o progresso do celular para o computador (ou o contrário) com um código, sem cadastro e sem servidor.</p>
          <div class="acoes"><a class="btn" href="#/sincronizar">Sincronizar progresso</a> <a class="btn-sec" href="#/perfil">Backup em arquivo</a></div>
        </article>
        <article class="painel">
          <h3>Privacidade</h3>
          <p>O progresso fica no armazenamento deste navegador. O jogo não usa cookies de rastreamento nem envia dados.</p>
          <div class="acoes"><a class="btn-sec" href="privacidade.html">Ler a política de privacidade</a></div>
        </article>
      </div>
    </div></section>`;
    const form = raiz.querySelector('#form-config');
    const aoMudar = () => {
      const f = new FormData(form);
      const nova = limparConfig({ movimento: f.get('movimento'), inicio: f.get('inicio') });
      store.alterar(e => ({ ...e, config: nova }));
      aplicarConfig(nova);
      raiz.querySelector('#cfg-msg').textContent = 'Preferência salva.';
    };
    form.addEventListener('change', aoMudar);
    return () => form.removeEventListener('change', aoMudar);
  }
};
