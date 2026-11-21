// DHCP (IPv4): pool do roteador e cliente; gateway padrão do computador.
import { lerIPv4, lerMascara, validarEnderecoDeHost, formatarIPv4, enderecoDeRede, mesmaRede } from '../ipv4.js';
import { dispositivo, trocar } from './base.js';

/** Máximo de endereços num pool DHCP do laboratório. */
export const MAX_POOL = 254;

/**
 * Define (ou remove, com início e fim vazios) o pool DHCP de uma interface de roteador. A máscara e o gateway entregues aos
 * clientes vêm da própria interface; o pool precisa estar dentro da sub-rede dela, fora do endereço de rede e de broadcast.
 */
export function configurarPoolDhcp(t, id, portaId, { inicio, fim }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'roteador') return { erro: 'Só roteadores têm servidor DHCP nesta simulação.' };
  const interf = d.interfaces.find(i => i.id === portaId);
  if (!interf) return { erro: 'Interface não encontrada.' };
  const iTxt = String(inicio ?? '').trim(), fTxt = String(fim ?? '').trim();
  const semPool = x => ({ ...x, pools: (x.pools ?? []).filter(q => q.porta !== portaId) });
  if (!iTxt && !fTxt) return { topologia: trocar(t, id, semPool) };
  if (!iTxt || !fTxt) return { erro: 'Informe o primeiro e o último endereço do pool (ou limpe os dois).' };
  const ip = lerIPv4(interf.ip), m = lerMascara(interf.mascara);
  if (ip === null || m === null) return { erro: 'Configure primeiro o IP e a máscara da interface que vai atender o DHCP.' };
  const iN = lerIPv4(iTxt), fN = lerIPv4(fTxt);
  if (iN === null || fN === null) return { erro: 'Endereço do pool inválido. Use quatro números de 0 a 255 separados por ponto.' };
  for (const n of [iN, fN]) {
    if (!mesmaRede(n, ip, m)) return { erro: `${formatarIPv4(n)} não está na sub-rede da interface (${formatarIPv4(enderecoDeRede(ip, m))}).` };
    const erro = validarEnderecoDeHost(n, m);
    if (erro) return { erro };
  }
  if (iN > fN) return { erro: 'O primeiro endereço do pool não pode ser maior que o último.' };
  if (fN - iN + 1 > MAX_POOL) return { erro: `O pool pode ter no máximo ${MAX_POOL} endereços.` };
  const novo = { porta: portaId, inicio: formatarIPv4(iN), fim: formatarIPv4(fN) };
  return { topologia: trocar(t, id, x => ({ ...semPool(x), pools: [...semPool(x).pools, novo] })) };
}

/** Liga ou desliga "obter endereço automaticamente (DHCP)" num computador. Os campos manuais ficam guardados. */
export function configurarDhcpPc(t, id, ativo) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores podem ser clientes DHCP.' };
  return { topologia: trocar(t, id, x => { const { dhcp, ...resto } = x; return ativo ? { ...resto, dhcp: true } : resto; }) };
}

export function configurarGateway(t, id, gateway) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores têm gateway padrão.' };
  const txt = String(gateway ?? '').trim();
  if (!txt) return { topologia: trocar(t, id, x => ({ ...x, gateway: '' })) };
  const n = lerIPv4(txt);
  if (n === null) return { erro: 'Gateway inválido. Use quatro números de 0 a 255 separados por ponto.' };
  return { topologia: trocar(t, id, x => ({ ...x, gateway: formatarIPv4(n) })) };
}
