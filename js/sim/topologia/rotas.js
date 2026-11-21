// Rotas estáticas IPv4 dos roteadores.
import { lerIPv4, lerMascara, formatarIPv4, enderecoDeRede, mesmaRede } from '../ipv4.js';
import { dispositivo, trocar } from './base.js';

export const MAX_ROTAS = 16;

/**
 * Acrescenta uma rota estática a um roteador: "para chegar em rede/máscara, envie ao próximo salto (via)".
 * O próximo salto precisa estar em uma rede ligada diretamente ao roteador (alguma interface já configurada).
 */
export function adicionarRotaEstatica(t, id, { rede, mascara, via }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores têm rotas estáticas.' };
  const rN = lerIPv4(String(rede ?? '').trim()), mN = lerMascara(String(mascara ?? '').trim()), vN = lerIPv4(String(via ?? '').trim());
  if (rN === null) return { erro: 'Endereço da rede inválido. Use quatro números de 0 a 255 separados por ponto.' };
  if (mN === null) return { erro: 'Máscara inválida. Use, por exemplo, 255.255.255.0 ou /24.' };
  if (enderecoDeRede(rN, mN) !== rN) return { erro: `Isso não é um endereço de rede para essa máscara. O endereço de rede seria ${formatarIPv4(enderecoDeRede(rN, mN))}.` };
  if (vN === null) return { erro: 'Próximo salto inválido. Use o endereço IP do roteador vizinho.' };
  const minhas = d.interfaces.filter(i => i.ip);
  if (minhas.some(i => lerIPv4(i.ip) === vN)) return { erro: 'O próximo salto não pode ser um endereço deste próprio roteador.' };
  if (!minhas.some(i => mesmaRede(lerIPv4(i.ip), vN, lerMascara(i.mascara)))) {
    return { erro: 'O próximo salto precisa estar em uma rede ligada diretamente a este roteador. Configure antes o IP da interface correspondente.' };
  }
  const rotas = d.rotas ?? [];
  if (rotas.length >= MAX_ROTAS) return { erro: `Limite de ${MAX_ROTAS} rotas estáticas por roteador.` };
  const nova = { rede: formatarIPv4(rN), mascara: formatarIPv4(mN), via: formatarIPv4(vN) };
  if (rotas.some(r => r.rede === nova.rede && r.mascara === nova.mascara)) return { erro: 'Já existe uma rota para essa rede.' };
  return { topologia: trocar(t, id, x => ({ ...x, rotas: [...rotas, nova] })) };
}

export function removerRotaEstatica(t, id, indice) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador' || !Number.isInteger(indice) || indice < 0 || indice >= (d.rotas ?? []).length) return { erro: 'Rota não encontrada.' };
  return { topologia: trocar(t, id, x => ({ ...x, rotas: x.rotas.filter((_, i) => i !== indice) })) };
}

/** Máximo de registros A (nome → IP) no serviço DNS de um computador. */
