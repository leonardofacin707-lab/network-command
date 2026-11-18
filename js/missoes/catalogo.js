import { validarMissao } from './verificar.js';

export async function carregarMissoes(base = new URL('../../data/', import.meta.url)) {
  const r = await fetch(new URL('missions.json', base));
  if (!r.ok) throw new Error(`Falha ao carregar missions.json (HTTP ${r.status})`);
  return montarMissoes(await r.json());
}

/** Descarta missões inválidas ou com id repetido (nunca derruba o app por um dado ruim). */
export function montarMissoes(bruto) {
  const vistos = new Set();
  const lista = [];
  for (const m of Array.isArray(bruto) ? bruto : []) {
    const ok = validarMissao(m);
    if (ok && !vistos.has(ok.id)) { vistos.add(ok.id); lista.push(ok); }
  }
  return lista;
}
