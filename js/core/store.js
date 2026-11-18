// Estado central da aplicação. Os módulos leem com obter() e mudam com alterar(); quem quiser reagir usa ouvir().
// A persistência não fica aqui: quem chama ouvir(salvar) decide o que fazer a cada mudança (ver main.js).
export function criarStore(inicial = {}) {
  let estado = inicial;
  let pos = e => e;
  const ouvintes = new Set();
  return {
    obter: () => estado,
    /** fn recebe o estado atual e devolve o novo (sem mutar o antigo). */
    alterar(fn) {
      estado = pos(fn(estado));
      ouvintes.forEach(o => o(estado));
      return estado;
    },
    substituir(novo) { return this.alterar(() => novo); },
    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    /** Regra aplicada a todo estado novo antes de avisar os ouvintes (ex.: conceder conquistas). */
    definirPos(fn) { pos = fn; }
  };
}

export const store = criarStore();
