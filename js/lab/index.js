// Módulo Laboratório (protótipo): área livre para montar uma rede, configurar e testar com o terminal simulado.
import { criarEditor } from './editor.js';

export default {
  id: 'laboratorio',
  montar(raiz, { store }) {
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Laboratório <span class="selo proto">protótipo</span></h2>
      <p class="sub">Monte a rede, configure os endereços e teste no terminal. O motor simula switches (com VLANs e trunk), ARP, ping, tracert e roteamento entre redes conectadas e por rotas estáticas.
        Ele <b>não</b> simula latência, roteamento dinâmico, DHCP nem NAT (ainda). O que você monta fica salvo neste navegador.</p>
      <div id="editor"></div>
    </div></section>`;
    const editor = criarEditor(raiz.querySelector('#editor'), {
      topologia: store.obter().lab.topologia,
      aoMudar: t => store.alterar(e => ({ ...e, lab: { topologia: t } }))
    });
    return () => editor.destruir();
  }
};
