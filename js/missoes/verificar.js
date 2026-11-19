// Regras das missões (sem DOM): validar dados, verificar objetivos com o motor e calcular o XP.
import { criarSimulacao, configDaInterface } from '../sim/motor.js';
import { dispositivo, normalizarTopologia } from '../sim/topologia.js';
import { lerIPv4, lerMascara, mesmaRede } from '../sim/ipv4.js';

export const PENALIDADE_DICA = 0.2;  // cada dica usada tira 20% do XP...
export const XP_MINIMO = 0.4;        // ...até um mínimo de 40%

/** XP ganho: base menos 20% por dica usada, nunca abaixo de 40% da base. */
export function calcularXp(base, dicas) {
  return Math.round(base * Math.max(XP_MINIMO, 1 - PENALIDADE_DICA * dicas));
}

const REDES_PRIVADAS = [['10.0.0.0', '255.0.0.0'], ['172.16.0.0', '255.240.0.0'], ['192.168.0.0', '255.255.0.0']].map(([r, m]) => [lerIPv4(r), lerMascara(m)]);

const MOTIVO_DNS = {
  'sem-dns': 'o computador não tem servidor DNS configurado',
  'dns-inalcancavel': 'o servidor DNS configurado não responde',
  'dns-sem-servico': 'o endereço configurado como DNS não é um servidor DNS',
  'nome-inexistente': 'o servidor DNS não conhece esse nome'
};

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
  bloqueado: 'um roteador bloqueou o tráfego (filtro de pacotes ou NAT com os lados trocados)',
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
    // restrição: o roteador (do provedor) não pode ter rotas estáticas para redes privadas; força a solução por NAT
    if (o.tipo === 'sem-rota-privada') {
      const r = dispositivo(topologia, o.roteador);
      const texto = `${nome(o.roteador)} não tem rota para redes privadas (o provedor não as anuncia)`;
      if (!r || r.tipo !== 'roteador') return { id: o.id, texto, ok: false, motivo: 'dispositivo ausente na topologia' };
      const privada = (r.rotas ?? []).some(x => REDES_PRIVADAS.some(([rede, m]) => { const rn = lerIPv4(x.rede); return rn !== null && mesmaRede(rn, rede, m); }));
      return privada ? { id: o.id, texto, ok: false, motivo: 'o provedor não encaminha endereços privados: remova essa rota e use NAT no roteador da empresa' } : { id: o.id, texto, ok: true, motivo: '' };
    }
    // esperado: 'falha' = objetivo de isolamento (ex.: setores em VLANs diferentes não devem se alcançar)
    const isolar = o.esperado === 'falha';
    const porNome = typeof o.nome === 'string'; // objetivo "de alcança o nome X": resolve pelo DNS e depois faz o ping
    const texto = `${nome(o.de)} ${isolar ? 'não alcança' : 'alcança'} ${porNome ? `${o.nome} (pelo nome)` : nome(o.para)}`;
    if (!dispositivo(topologia, o.de) || (!porNome && !dispositivo(topologia, o.para))) return { id: o.id, texto, ok: false, motivo: 'dispositivo ausente na topologia' };
    let ip;
    if (porNome) {
      const res = sim.resolver(o.de, o.nome);
      if (!res.ok) return isolar ? { id: o.id, texto, ok: true, motivo: '' } : { id: o.id, texto, ok: false, motivo: MOTIVO_DNS[res.motivo] };
      ip = res.ip;
    } else {
      ip = ipDoDispositivo(sim.topologia, o.para); // com as concessões DHCP
      if (ip === null) return { id: o.id, texto, ok: false, motivo: `${nome(o.para)} não tem IP configurado` };
    }
    const r = sim.ping(o.de, ip);
    const entregue = r.status === 'entregue';
    if (isolar) return entregue ? { id: o.id, texto, ok: false, motivo: 'ainda se comunicam, mas deveriam estar isolados' } : { id: o.id, texto, ok: true, motivo: '' };
    return entregue ? { id: o.id, texto, ok: true, motivo: '' } : { id: o.id, texto, ok: false, motivo: MOTIVO[r.status] ?? 'sem resposta' };
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
  const nomeValido = n => typeof n === 'string' && /^[a-z0-9]([a-z0-9.-]{0,60}[a-z0-9])?$/.test(n);
  const objetivos = (Array.isArray(m.objetivos) ? m.objetivos : []).filter(o => o && typeof o.id === 'string'
    && ((o.tipo === 'sem-rota-privada' && dispositivo(topologia, o.roteador)?.tipo === 'roteador')
      || (dispositivo(topologia, o.de) && (dispositivo(topologia, o.para) || nomeValido(o.nome))))).map(o => {
    if (o.tipo === 'sem-rota-privada') return { id: o.id, tipo: 'sem-rota-privada', roteador: o.roteador };
    const base = nomeValido(o.nome) && !dispositivo(topologia, o.para) ? { id: o.id, de: o.de, nome: o.nome } : { id: o.id, de: o.de, para: o.para };
    return o.esperado === 'falha' ? { ...base, esperado: 'falha' } : base;
  });
  if (!objetivos.length) return null;
  const xp = Number.isInteger(m.xp) && m.xp > 0 && m.xp <= 1000 ? m.xp : 100;
  return {
    id: m.id, modulo: m.modulo === 'campus' ? 'campus' : 'missoes', titulo: m.titulo, cenario: m.cenario, topologia, objetivos, xp,
    dificuldade: [1, 2, 3].includes(m.dificuldade) ? m.dificuldade : 1,
    habilidades: habilidadesValidas(m.habilidades),
    dicas: (Array.isArray(m.dicas) ? m.dicas : []).filter(d => typeof d === 'string').slice(0, 9)
  };
}
