import { validarProjeto, validarEquipamentos } from './planejamento.js';

export async function carregarEmpresa(base = new URL('../../data/', import.meta.url)) {
  const r = await fetch(new URL('empresa.json', base));
  if (!r.ok) throw new Error(`Falha ao carregar empresa.json (HTTP ${r.status})`);
  return montarEmpresa(await r.json());
}

/** Descarta projetos inválidos ou com id repetido; nunca derruba o app por um dado ruim. */
export function montarEmpresa(bruto) {
  const equipamentos = validarEquipamentos(bruto?.equipamentos);
  const vistos = new Set();
  const projetos = [];
  for (const p of Array.isArray(bruto?.projetos) ? bruto.projetos : []) {
    const ok = validarProjeto(p);
    if (ok && !vistos.has(ok.id)) { vistos.add(ok.id); projetos.push(ok); }
  }
  return { equipamentos, projetos };
}
