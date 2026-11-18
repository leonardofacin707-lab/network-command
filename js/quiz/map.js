import { $, esc, reduzMovimento } from '../core/ui.js';
import { ICONES } from './icones.js';
import { statusDoNivel } from './unlock.js';

const estrelasTexto = n => '★'.repeat(n) + '☆'.repeat(3 - n);
let observador = null;

export function pararMapa() { if (observador) observador.disconnect(); }

export function desenharMapa({ app, catalogo, store }) {
  const melhor = store.obter().quiz.melhor;
  const { niveis } = catalogo;
  const status = n => statusDoNivel(n, niveis, melhor);
  const prox = niveis.find(n => status(n) === 'aberto');
  app.innerHTML = `
    <section class="mapa" aria-label="Mapa de níveis">
      <div class="trilha" id="trilha">
        <svg id="cabos" aria-hidden="true"></svg>
        ${niveis.map(n => noHTML(n, status(n), melhor[n.id])).join('')}
      </div>
    </section>
    <section class="band">
      <div class="info">
        ${prox ? proximoHTML(prox) : fimHTML()}
        <div class="painel">
          <h2>Como jogar</h2>
          <ul>
            <li>Acerte de primeira para ganhar 100 pontos. Com erros, o desafio vale menos.</li>
            <li>Faça pelo menos 1 estrela para liberar o próximo dispositivo do caminho.</li>
            <li>Rejogue quando quiser: fica salvo o seu melhor resultado.</li>
            <li>Depois de cada resposta, leia a explicação. É ali que o conteúdo fixa.</li>
          </ul>
        </div>
      </div>
    </section>`;
  pararMapa();
  observador = new ResizeObserver(() => posicionarMapa(niveis, status));
  observador.observe($('#trilha'));
}

function noHTML(n, st, m) {
  const travado = st === 'bloqueado' || st === 'embreve';
  const rodape = st === 'embreve' ? 'em breve' : st === 'bloqueado' ? 'bloqueado' : estrelasTexto(m ? m.estrelas : 0);
  return `<button class="no st-${st}" data-nivel="${n.id}" ${travado ? 'aria-disabled="true"' : ''}
            aria-label="Nível ${n.id}: ${esc(n.nome)} (${rodape})">
    <span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[n.icone]}</svg><span class="num">${n.id}</span></span>
    <span class="nome">${esc(n.nome)}</span>
    <span class="est">${rodape}</span>
  </button>`;
}

function proximoHTML(n) {
  return `<div class="painel">
    <span class="mods">${esc(n.modulos)}</span>
    <h2>Próximo destino: ${esc(n.nome)}</h2>
    <p>Nível ${n.id} · ${n.desafios.length} desafios. O que você vai praticar:</p>
    <ul>${n.resumo.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="acoes"><button class="btn" data-acao="jogar" data-nivel="${n.id}">Jogar nível ${n.id}</button></div>
  </div>`;
}

function fimHTML() {
  return `<div class="painel">
    <h2>Caminho liberado até aqui</h2>
    <p>Você completou todos os níveis disponíveis. Os próximos dispositivos do caminho (do switch ao diagnóstico final) chegam nas próximas fases.</p>
    <p>Enquanto isso, tente fazer 3 estrelas em todos os níveis.</p>
  </div>`;
}

/**
 * Cabo entre dois níveis. Na mudança de linha, o cabo sairia reto por cima do nome do nível;
 * por isso ele contorna o ícone pela lateral, voltando ao centro dele só no final.
 */
function caminho(a, b, largura) {
  if (a.x !== b.x) return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  const lado = a.x > largura / 2 ? 1 : -1; // curva para fora do mapa
  const sai = a.x + lado * 34, folga = lado * 64; // largura do rótulo é ~136px: a curva precisa passar além dele
  return `M${sai} ${a.y} C${sai + folga} ${a.y} ${sai + folga} ${b.y} ${sai} ${b.y} L${b.x} ${b.y}`;
}

/** Distribui os níveis em zigue-zague e desenha os cabos entre eles. */
function posicionarMapa(niveis, status) {
  const trilha = $('#trilha');
  if (!trilha) return;
  const W = trilha.clientWidth;
  const colunas = W < 480 ? 2 : W < 780 ? 3 : 4;
  const alturaLinha = W < 480 ? 156 : 170;
  trilha.style.height = Math.ceil(niveis.length / colunas) * alturaLinha + 'px';

  const pontos = niveis.map((n, i) => {
    const linha = Math.floor(i / colunas);
    let col = i % colunas;
    if (linha % 2 === 1) col = colunas - 1 - col; // linhas ímpares voltam da direita para a esquerda
    return { x: (col + 0.5) * W / colunas, y: linha * alturaLinha + 48 };
  });
  trilha.querySelectorAll('.no').forEach((botao, i) => {
    botao.style.left = pontos[i].x + 'px';
    botao.style.top = pontos[i].y + 'px';
  });

  let svg = '';
  for (let i = 1; i < pontos.length; i++) {
    const anteriorFeito = status(niveis[i - 1]) === 'feito';
    const classe = !anteriorFeito ? 'off' : status(niveis[i]) === 'feito' ? 'ok' : 'ativo';
    svg += `<path class="cabo ${classe}" d="${caminho(pontos[i - 1], pontos[i], W)}"/>`;
  }
  // O pacote viaja pelo cabo que leva ao próximo nível aberto
  const iProx = niveis.findIndex(n => status(n) === 'aberto');
  if (iProx > 0 && !reduzMovimento()) {
    svg += `<g class="pacote"><rect x="-10" y="-7" width="20" height="14" rx="2"/><path d="M-10 -7 L0 1 L10 -7"/>
      <animateMotion dur="2.4s" repeatCount="indefinite" path="${caminho(pontos[iProx - 1], pontos[iProx], W)}"/></g>`;
  }
  $('#cabos').innerHTML = svg;
}
