// Carrega os dados (JSON) e monta o catálogo: níveis com os desafios já resolvidos.
export async function carregarCatalogo(base = new URL('../../data/', import.meta.url)) {
  const ler = async nome => {
    const r = await fetch(new URL(nome, base));
    if (!r.ok) throw new Error(`Falha ao carregar ${nome} (HTTP ${r.status})`);
    return r.json();
  };
  const [perguntas, niveis, categorias, habilidades] = await Promise.all([
    ler('questions.json'), ler('levels.json'), ler('categories.json'), ler('skills.json')
  ]);
  return montarCatalogo({ perguntas, niveis, categorias, habilidades });
}

/** Monta o catálogo a partir dos dados já lidos (também usado nos testes). */
export function montarCatalogo({ perguntas, niveis, categorias, habilidades }) {
  const porId = new Map(perguntas.map(p => [p.id, p]));
  const niveisMontados = niveis.map(n => n.desafios
    ? { ...n, desafios: n.desafios.map(id => porId.get(id)) }
    : { ...n });
  return {
    perguntas, categorias, habilidades,
    niveis: niveisMontados,
    jogaveis: niveisMontados.filter(n => n.desafios),
    /** pontos máximos por id de nível, usado para validar o estado salvo */
    limites: Object.fromEntries(niveisMontados.filter(n => n.desafios).map(n => [n.id, n.desafios.length * 100]))
  };
}

/** Referência para validar o estado salvo: o que existe de níveis, perguntas e conquistas. */
export function criarReferencia(catalogo, idsConquistas, idsMissoes = [], idsEmpresa = []) {
  return {
    limites: catalogo.limites,
    perguntas: new Set(catalogo.perguntas.map(p => p.id)),
    conquistas: new Set(idsConquistas),
    missoes: new Set(idsMissoes),
    empresa: new Set(idsEmpresa)
  };
}
