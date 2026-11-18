// Roteador por hash: "#/modulo/sub/parametro". Cada módulo expõe montar(raiz, ctx, params) e devolve desmontar().
export function criarRoteador({ raiz, rotas, padrao, ctx, aoTrocar }) {
  let desmontar = null;

  function ler() {
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const id = rotas[partes[0]] ? partes[0] : padrao;
    return { id, params: partes.slice(1) };
  }

  function ir() {
    const { id, params } = ler();
    if (desmontar) { try { desmontar(); } catch (e) { console.error(e); } desmontar = null; }
    raiz.replaceChildren();
    desmontar = rotas[id].montar(raiz, ctx, params) || null;
    aoTrocar?.(id, rotas[id]);
    window.scrollTo({ top: 0 });
  }

  window.addEventListener('hashchange', ir);
  return { iniciar: ir, atual: () => ler().id };
}

/** Leva para uma rota sem recarregar (ex.: ir('conhecimento/revisao')). */
export const ir = destino => { location.hash = '#/' + destino; };
/** Troca o hash sem disparar a navegação (usado depois de abrir um atalho). */
export const limparHash = destino => { try { history.replaceState(null, '', '#/' + destino); } catch { /* ambientes isolados (iframe sandbox) */ } };
