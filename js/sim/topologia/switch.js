// Switches no modelo: portas access e trunk, VLANs.
import { TIPOS, dispositivo, vizinhos, trocar } from './base.js';

export const VLAN_MIN = 1, VLAN_MAX = 4094;
export const PORTA_PADRAO = Object.freeze({ modo: 'access', vlan: 1 });

/** Configuração de uma porta de switch: { modo: 'access'|'trunk', vlan }. Padrão: access na VLAN 1. */
export const configDaPortaSwitch = (d, portaId) => d.portas?.[portaId] ?? PORTA_PADRAO;

/** VLANs em uso nas portas de acesso que têm cabo (para o desenho do switch). */
export function vlansDoSwitch(t, id) {
  const d = dispositivo(t, id);
  const usadas = new Set();
  for (const v of vizinhos(t, id)) { const c = configDaPortaSwitch(d, v.minhaPorta); if (c.modo === 'access') usadas.add(c.vlan); }
  return [...usadas].sort((a, b) => a - b);
}

/** Configura uma porta de switch como access (com VLAN) ou trunk (leva todas as VLANs; VLAN nativa 1). */
export function configurarPortaSwitch(t, id, portaId, { modo, vlan }) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'switch') return { erro: 'Só switches têm portas configuráveis.' };
  if (!TIPOS.switch.portas.some(p => p.id === portaId)) return { erro: 'Porta inexistente.' };
  if (modo !== 'access' && modo !== 'trunk') return { erro: 'Modo inválido. Use access ou trunk.' };
  let nova;
  if (modo === 'trunk') nova = { modo: 'trunk', vlan: 1 };
  else {
    const txt = String(vlan ?? '').trim();
    if (!/^\d{1,4}$/.test(txt) || Number(txt) < VLAN_MIN || Number(txt) > VLAN_MAX) return { erro: `VLAN inválida. Use um número de ${VLAN_MIN} a ${VLAN_MAX}.` };
    nova = { modo: 'access', vlan: Number(txt) };
  }
  const portas = { ...(d.portas ?? {}) };
  if (nova.modo === 'access' && nova.vlan === 1) delete portas[portaId]; else portas[portaId] = nova;
  return { topologia: trocar(t, id, x => ({ ...x, portas })) };
}
