// Casca da aplicação: menu lateral, botão de abrir/fechar no celular e título da página.
import { MENU, SELOS } from './menu.js';
import { esc } from '../core/ui.js';

export function montarShell() {
  const lateral = document.getElementById('lateral');
  lateral.innerHTML = `<div class="marca">NETWORK <span>COMMAND</span></div>
    <nav aria-label="Menu principal"><ul class="menu">${MENU.map(m => `
      <li><a href="#/${m.id}" data-rota="${m.id}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${m.icone}</svg>
        <span class="rot">${esc(m.rotulo)}</span>${SELOS[m.estado] ? `<span class="selo ${m.estado}">${SELOS[m.estado]}</span>` : ''}
      </a></li>`).join('')}</ul></nav>`;

  const burger = document.getElementById('burger');
  const fundo = document.getElementById('fundo-menu');
  const abrir = aberto => {
    lateral.classList.toggle('aberta', aberto);
    fundo.hidden = !aberto;
    burger.setAttribute('aria-expanded', String(aberto));
  };
  burger.addEventListener('click', () => abrir(!lateral.classList.contains('aberta')));
  fundo.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') abrir(false); });
  lateral.addEventListener('click', e => { if (e.target.closest('a')) abrir(false); });

  return {
    marcarAtual(id) {
      lateral.querySelectorAll('a').forEach(a => {
        if (a.dataset.rota === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      const item = MENU.find(m => m.id === id);
      document.title = `${item ? item.rotulo + ' · ' : ''}Network Command`;
      document.getElementById('titulo-pagina').textContent = item ? item.rotulo : 'Network Command';
    }
  };
}
