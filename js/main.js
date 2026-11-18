// Ponto de entrada: carrega dados e estado salvo, liga a persistência e abre o módulo inicial.
import { $ } from './core/ui.js';
import { store } from './core/store.js';
import { carregar, salvar, normalizar } from './core/storage.js';
import { carregarCatalogo } from './quiz/catalog.js';
import { criarQuiz } from './quiz/index.js';

async function iniciar() {
  const app = $('#app');
  let catalogo;
  try {
    catalogo = await carregarCatalogo();
  } catch (erro) {
    app.innerHTML = `<section class="band"><div class="painel"><h2>Não foi possível carregar os dados</h2>
      <p>${String(erro.message)}</p></div></section>`;
    throw erro;
  }

  // No ambiente de pré-visualização do Claude, o estado vem do gancho "hot"; no navegador comum, do localStorage.
  const hot = window.claude?.hot;
  const recebido = await new Promise(resolver => {
    if (hot?.ready) hot.ready(dados => resolver(dados?.estado ?? null));
    else resolver(hot?.data?.estado ?? null);
  });
  store.substituir(recebido ? normalizar(recebido, catalogo.limites) : carregar(catalogo.limites));

  store.ouvir(salvar);
  hot?.snapshot?.(() => ({ estado: store.obter() }));

  criarQuiz({ app, catalogo, store }).abrirMapa();
}

iniciar();
