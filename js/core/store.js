// Estado central da aplicação. Os módulos leem com obter() e mudam com alterar(); quem quiser reagir usa ouvir().
// A persistência não fica aqui: quem chama iniciar() decide o que fazer a cada mudança (ver main.js).
export function criarStore(inicial = {}) {
  let estado = inicial;
  const ouvintes = new Set();
  return {
    obter: () => estado,
    /** fn recebe o estado atual e devolve o novo (sem mutar o antigo). */
    alterar(fn) {
      estado = fn(estado);
      ouvintes.forEach(o => o(estado));
      return estado;
    },
    substituir(novo) { return this.alterar(() => novo); },
    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
  };
}

export const store = criarStore();
