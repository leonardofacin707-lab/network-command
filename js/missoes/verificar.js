// Regras das missões (sem DOM): validar dados, verificar objetivos com o motor e calcular o XP.
import { criarSimulacao, configDaInterface } from '../sim/motor.js';
import { dispositivo, normalizarTopologia } from '../sim/topologia.js';

export const PENALIDADE_DICA = 0.2;  // cada dica usada tira 20% do XP...
export const XP_MINIMO = 0.4;        // ...até um mínimo de 40%

/** XP ganho: base menos 20% por dica usada, nunca abaixo de 40% da base. */
export function calcularXp(base, dicas) {
  return Math.round(base * Math.max(XP_MINIMO, 1 - PENALIDADE_DICA * dicas));
}

const MOTIVO = {
  'sem-ip': 'a origem não tem IP configurado',
  'sem-link': 'a origem está sem cabo',
  'sem-rota': 'a origem não sabe como chegar a esse endereço',
  'gateway-fora': 'o gateway da origem está fora da sub-rede dela',
  'arp-falhou': 'ninguém respondeu na rede local',
  'conflito-ip': 'há respostas conflitantes (IP duplicado)',
  'rede-inalcancavel': 'um roteador do caminho não conhece essa rede',
  'host-inalcancavel': 'o roteador não encontrou o destino na rede dele',
  'ttl-expirado': 'o pacote expirou no caminho',
  descartado: 'o pacote foi descartado',
  timeout: 'o pacote chegou, mas a resposta não voltou'
};

/** Primeiro IP configurado de um dispositivo, como número (alvo dos objetivos, que apontam para dispositivos, não para IPs). */
export function ipDoDispositivo(t, id) {
  const d = dispositivo(t, id);
  if (!d) return null;
  for (const i of d.interfaces) { const c = configDaInterface(d, i.id); if (c) return c.ip; }
  return null;
}

/**
 * Verifica os objetivos da missão na topologia atual com uma simulação nova (ARP limpo).
 * Cada objetivo é "de ping em para": passa só se a ida e a volta funcionarem no motor.
 */
export function verificarMissao(missao, topologia) {
  const sim = criarSimulacao(topologia);
  const nome = id => dispositivo(topologia, id)?.nome ?? id;
  const objetivos = missao.objetivos.map(o => {
    const texto = `${nome(o.de)} alcança ${nome(o.para)}`;
    if (!dispositivo(topologia, o.de) || !dispositivo(topologia, o.para)) return { id: o.id, texto, ok: false, motivo: 'dispositivo ausente na topologia' };
    const ip = ipDoDispositivo(topologia, o.para);
    if (ip === null) return { id: o.id, texto, ok: false, motivo: `${nome(o.para)} não tem IP configurado` };
    const r = sim.ping(o.de, ip);
    return r.status === 'entregue' ? { id: o.id, texto, ok: true, motivo: '' } : { id: o.id, texto, ok: false, motivo: MOTIVO[r.status] ?? 'sem resposta' };
  });
  return { objetivos, todosOk: objetivos.every(o => o.ok) };
}

/** Habilidades "trilha.nivel" que a conclusão treina (ver data/skills.json). Descarta o que não tiver o formato certo. */
export const habilidadesValidas = lista => (Array.isArray(lista) ? lista : []).filter(h => typeof h === 'string' && /^[a-z-]{1,30}\.(teoria|pratica|diagnostico)$/.test(h)).slice(0, 4);

/** Valida os dados de uma missão lida do JSON. Devolve a missão normalizada ou null. */
export function validarMissao(m) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(m.id)) return null;
  if (typeof m.titulo !== 'string' || typeof m.cenario !== 'string') return null;
  const topologia = normalizarTopologia(m.topologia);
  if (!topologia.dispositivos.length) return null;
  const objetivos = (Array.isArray(m.objetivos) ? m.objetivos : []).filter(o => o && typeof o.id === 'string'
    && dispositivo(topologia, o.de) && dispositivo(topologia, o.para));
  if (!objetivos.length) return null;
  const xp = Number.isInteger(m.xp) && m.xp > 0 && m.xp <= 1000 ? m.xp : 100;
  return {
    id: m.id, modulo: m.modulo === 'campus' ? 'campus' : 'missoes', titulo: m.titulo, cenario: m.cenario, topologia, objetivos, xp,
    dificuldade: [1, 2, 3].includes(m.dificuldade) ? m.dificuldade : 1,
    habilidades: habilidadesValidas(m.habilidades),
    dicas: (Array.isArray(m.dicas) ? m.dicas : []).filter(d => typeof d === 'string').slice(0, 9)
  };
}
