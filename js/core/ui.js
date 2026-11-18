// Utilitários de interface compartilhados por todos os módulos.
export const $ = sel => document.querySelector(sel);

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
/** Escapa texto para uso seguro dentro de HTML. */
export const esc = s => String(s).replace(/[&<>"]/g, c => ENTIDADES[c]);

export const reduzMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
