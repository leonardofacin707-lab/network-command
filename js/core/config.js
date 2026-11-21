// Preferências deste aparelho (sem DOM). Ficam no estado salvo, mas não viajam na sincronização entre aparelhos:
// cada aparelho pode ter as suas (ex.: animações reduzidas só no celular).
export const OPCOES_CONFIG = {
  movimento: ['sistema', 'reduzir'],  // animações: seguir a preferência do sistema ou reduzir sempre
  inicio: ['inicio', 'dashboard']     // o que abre quando o endereço não indica uma página
};
export const configPadrao = () => ({ movimento: 'sistema', inicio: 'inicio' });

/** Mantém só chaves e valores conhecidos; o resto volta ao padrão. */
export function limparConfig(bruto) {
  const limpo = configPadrao();
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return limpo;
  for (const [chave, valores] of Object.entries(OPCOES_CONFIG)) if (valores.includes(bruto[chave])) limpo[chave] = bruto[chave];
  return limpo;
}
