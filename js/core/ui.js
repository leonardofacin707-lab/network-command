// Utilitários de interface compartilhados por todos os módulos.
export const $ = sel => document.querySelector(sel);

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto para uso seguro dentro de HTML. */
export const esc = s => String(s).replace(/[&<>"']/g, c => ENTIDADES[c]);

/** Animações reduzidas: pela configuração do jogo (Configurações) ou pela preferência do sistema. */
export const reduzMovimento = () => document.documentElement.dataset.movimento === 'reduzir' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Embaralha uma cópia da lista (Fisher-Yates). */
export function embaralhar(lista, aleatorio = Math.random) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Faz um elemento "tremer" (feedback de erro). */
export function tremer(el) {
  if (!el) return;
  el.classList.remove('treme');
  void el.offsetWidth; // reinicia a animação
  el.classList.add('treme');
}

/** Aviso curto e discreto (leitores de tela anunciam; some sozinho). */
export function avisar(texto, ms = 4500) {
  const area = document.getElementById('avisos');
  if (!area) return;
  const el = document.createElement('div');
  el.className = 'aviso';
  el.textContent = texto;
  area.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Data e hora no formato brasileiro. */
export const dataHora = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
