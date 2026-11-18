import { esc } from '../core/ui.js';

/** Páginas dos módulos ainda não construídos: dizem com clareza que não existem e o que está planejado. */
const PLANOS = {
  empresa: { titulo: 'Empresa', fase: 'Fase 6', texto: 'Gerenciamento da infraestrutura de uma empresa: orçamento, equipamentos, falhas e crescimento da rede.' },
  datacenter: { titulo: 'Data Center', fase: 'Fase 6', texto: 'Cenário de redes de data center: redundância, disponibilidade e capacidade.' },
  campus: { titulo: 'Campus de Redes', fase: 'Fase 6', texto: 'Cenário de rede de campus com vários prédios, VLANs e roteamento.' },
  missoes: { titulo: 'Missões', fase: 'Fase 5', texto: 'Desafios de troubleshooting no laboratório: diagnosticar e corrigir problemas de rede em cenários guiados.' }
};

export const emDesenvolvimento = id => ({
  id,
  montar(raiz) {
    const p = PLANOS[id];
    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">${esc(p.titulo)} <span class="selo emdev">em desenvolvimento</span></h2>
      <div class="painel">
        <p><b>Este módulo ainda não existe.</b> Nada aqui funciona por enquanto, e nenhuma conquista ou progresso depende dele.</p>
        <p>Planejado (${esc(p.fase)}): ${esc(p.texto)}</p>
        <div class="acoes"><a class="btn" href="#/conhecimento">Ir para o Conhecimento</a><a class="btn-sec" href="#/dashboard">Voltar ao dashboard</a></div>
      </div>
    </div></section>`;
  }
});
