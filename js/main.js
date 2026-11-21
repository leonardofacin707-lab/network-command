// Ponto de entrada: carrega dados e estado salvo, liga a persistência e abre o roteador.
import { $, avisar } from './core/ui.js';
import { store } from './core/store.js';
import { carregar, salvar, normalizar } from './core/storage.js';
import { carregarCatalogo, criarReferencia } from './quiz/catalog.js';
import { iniciarHud } from './quiz/hud.js';
import { criarRoteador } from './app/router.js';
import { montarShell } from './app/shell.js';
import { IDS_CONQUISTAS, CONQUISTAS, concederNovas } from './hub/conquistas-regras.js';
import quiz from './quiz/index.js';
import dashboard from './hub/dashboard.js';
import perfil from './hub/perfil.js';
import conquistas from './hub/conquistas.js';
import habilidades from './hub/habilidades.js';
import laboratorio from './lab/index.js';
import missoesModulo, { criarModuloMissoes } from './missoes/index.js';
import { carregarMissoes } from './missoes/catalogo.js';
import empresaModulo from './empresa/index.js';
import { carregarEmpresa } from './empresa/catalogo.js';
import datacenterModulo from './datacenter/index.js';
import { carregarDatacenter } from './datacenter/catalogo.js';

async function iniciar() {
  const app = $('#app');
  const shell = montarShell();
  let catalogo, missoes, empresa, datacenter;
  try {
    catalogo = await carregarCatalogo();
    missoes = await carregarMissoes();
    empresa = await carregarEmpresa();
    datacenter = await carregarDatacenter();
    catalogo = { ...catalogo, missoes };
  } catch (erro) {
    app.innerHTML = `<section class="band"><div class="painel"><h2>Não foi possível carregar os dados</h2><p>${String(erro.message)}</p></div></section>`;
    throw erro;
  }
  const referencia = criarReferencia(catalogo, IDS_CONQUISTAS, missoes.map(m => m.id), empresa.projetos.map(p => p.id), datacenter.desafios.map(d => d.id));

  // No ambiente de pré-visualização do Claude, o estado vem do gancho "hot"; no navegador comum, do localStorage.
  const hot = window.claude?.hot;
  const recebido = await new Promise(resolver => {
    if (hot?.ready) hot.ready(dados => resolver(dados?.estado ?? null));
    else resolver(hot?.data?.estado ?? null);
  });
  const inicial = recebido ? normalizar(recebido, referencia) : carregar(referencia);

  // Conquistas são concedidas por regra, em todo estado novo, e avisadas uma vez.
  store.definirPos(estado => concederNovas(estado, catalogo));
  store.substituir(inicial);
  let conhecidas = new Set(Object.keys(store.obter().conquistas));
  store.ouvir(estado => {
    for (const id of Object.keys(estado.conquistas)) {
      if (!conhecidas.has(id)) avisar(`Conquista desbloqueada: ${CONQUISTAS.find(c => c.id === id).nome}`);
    }
    conhecidas = new Set(Object.keys(estado.conquistas));
  });
  store.ouvir(salvar);
  hot?.snapshot?.(() => ({ estado: store.obter() }));
  iniciarHud(store, catalogo);

  const rotas = {
    dashboard, conhecimento: quiz, perfil, conquistas, habilidades,
    laboratorio, empresa: empresaModulo,
    datacenter: datacenterModulo, campus: criarModuloMissoes({ id: 'campus', titulo: 'Campus de Redes', intro: 'Cenários de rede de campus com VLANs, trunks e roteamento entre VLANs. Cada um traz defeitos de configuração para você achar e corrigir.' }), missoes: missoesModulo
  };
  criarRoteador({
    raiz: app, rotas, padrao: 'dashboard',
    ctx: { catalogo, referencia, store, missoes, empresa, datacenter },
    aoTrocar: id => shell.marcarAtual(id)
  }).iniciar();
}

iniciar();

// Modo offline (PWA): só na versão publicada (dist/, marcada pelo build). Em desenvolvimento e na prévia nada é registrado.
if ('serviceWorker' in navigator && document.querySelector('meta[name="nc-publicado"]')) {
  const jaTinhaVersao = !!navigator.serviceWorker.controller;
  // quando uma versão nova assume (depois de publicada), avisa uma vez: o jogo atual continua funcionando até recarregar
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (jaTinhaVersao) avisar('Há uma versão nova do jogo. Recarregue a página para usar.'); });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
}
