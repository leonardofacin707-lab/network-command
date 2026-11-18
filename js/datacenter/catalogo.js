import { validarCamadas, validarDesafio } from './disponibilidade.js';

export async function carregarDatacenter(base = new URL('../../data/', import.meta.url)) {
  const r = await fetch(new URL('datacenter.json', base));
  if (!r.ok) throw new Error(`Falha ao carregar datacenter.json (HTTP ${r.status})`);
  return montarDatacenter(await r.json());
}

/** Descarta desafios inválidos ou repetidos; nunca derruba o app por um dado ruim. */
export function montarDatacenter(bruto) {
  const camadas = validarCamadas(bruto?.camadas);
  const vistos = new Set();
  const desafios = [];
  for (const d of Array.isArray(bruto?.desafios) ? bruto.desafios : []) {
    const ok = validarDesafio(d, camadas);
    if (ok && !vistos.has(ok.id)) { vistos.add(ok.id); desafios.push(ok); }
  }
  return { camadas, desafios };
}
