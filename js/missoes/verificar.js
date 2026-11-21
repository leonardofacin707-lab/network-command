// Regras das missões (sem DOM): validar dados, verificar objetivos com o motor e calcular o XP.
import { criarSimulacao, configDaInterface, NOMES_PORTAS } from '../sim/motor.js';
import { dispositivo, normalizarTopologia } from '../sim/topologia.js';
import { lerIPv4, lerMascara, mesmaRede, formatarIPv4 } from '../sim/ipv4.js';
import { primeiroGlobal6 } from '../sim/motor6.js';

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
  timeout: 'o pacote chegou, mas a resposta não voltou',
  recusada: 'a porta está fechada no destino (nenhum serviço escutando)',
  'sem-roteamento6': 'um roteador recebeu o pacote, mas não está roteando IPv6 (falta ipv6 unicast-routing)'
};

const MOTIVO6 = {
  'sem-ip': 'a origem não tem endereço IPv6 global', 'sem-rota': 'a origem não tem gateway IPv6 para chegar a outra rede',
  'gateway-fora': 'o gateway IPv6 da origem não está na rede (prefixo) dela', 'arp-falhou': 'ninguém respondeu à descoberta de vizinhos (Neighbor Solicitation)',
  'conflito-ip': 'há endereço IPv6 duplicado no caminho', 'host-inalcancavel': 'o roteador não encontrou o destino na rede dele (descoberta de vizinhos sem resposta)'
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
    // o computador precisa ter recebido o endereço do servidor DHCP legítimo (defesa contra servidor DHCP falso)
    if (o.tipo === 'dhcp-de') {
      const texto = `${nome(o.pc)} recebe o endereço do servidor DHCP ${nome(o.roteador)}`;
      const c = sim.concessoes.get(o.pc);
      if (!c?.ok) return { id: o.id, texto, ok: false, motivo: `${nome(o.pc)} não recebeu endereço por DHCP` };
      return c.servidor.d === o.roteador ? { id: o.id, texto, ok: true, motivo: '' }
        : { id: o.id, texto, ok: false, motivo: `o endereço veio de outro servidor DHCP (${nome(c.servidor.d)}, ${formatarIPv4(c.servidor.ip)})` };
    }
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
    const porta = Number.isInteger(o.porta) ? o.porta : null; // objetivo de serviço: conexão TCP nessa porta
    if (o.ipv6) {
      const texto = `${nome(o.de)} ${isolar ? 'não alcança' : 'alcança'} ${nome(o.para)} por IPv6`;
      if (!dispositivo(topologia, o.de) || !dispositivo(topologia, o.para)) return { id: o.id, texto, ok: false, motivo: 'dispositivo ausente na topologia' };
      const ip6 = primeiroGlobal6(dispositivo(sim.topologia, o.para));
      if (ip6 === null) return { id: o.id, texto, ok: isolar, motivo: isolar ? '' : `${nome(o.para)} não tem endereço IPv6 global` };
      const r6 = sim.ping6(o.de, ip6), chegou = r6.status === 'entregue';
      if (isolar) return { id: o.id, texto, ok: !chegou, motivo: chegou ? 'ainda se comunicam, mas deveriam estar isolados' : '' };
      return { id: o.id, texto, ok: chegou, motivo: chegou ? '' : MOTIVO6[r6.status] ?? MOTIVO[r6.status] ?? 'sem resposta' };
    }
    const alvoTxt = porNome ? `${o.nome} (pelo nome${o.para ? `, que deve levar a ${nome(o.para)}` : ''})` : nome(o.para);
    const texto = porta !== null
      ? `${nome(o.de)} ${isolar ? 'não conecta' : 'conecta'} em ${nome(o.para)} na porta ${porta}${NOMES_PORTAS[porta] ? ` (${NOMES_PORTAS[porta]})` : ''}`
      : `${nome(o.de)} ${isolar ? 'não alcança' : 'alcança'} ${alvoTxt}`;
    if (!dispositivo(topologia, o.de) || (!porNome && !dispositivo(topologia, o.para))) return { id: o.id, texto, ok: false, motivo: 'dispositivo ausente na topologia' };
    let ip;
    if (porNome) {
      const res = sim.resolver(o.de, o.nome);
      if (!res.ok) return isolar ? { id: o.id, texto, ok: true, motivo: '' } : { id: o.id, texto, ok: false, motivo: MOTIVO_DNS[res.motivo] };
      ip = res.ip;
      // nome que deve levar a um computador específico: se o DNS responder outro endereço, é um registro falso
      if (o.para && ip !== ipDoDispositivo(sim.topologia, o.para)) {
        return isolar ? { id: o.id, texto, ok: true, motivo: '' } : { id: o.id, texto, ok: false, motivo: `o DNS respondeu ${formatarIPv4(ip)}, que não é o endereço de ${nome(o.para)} (resposta falsa?)` };
      }
    } else {
      ip = ipDoDispositivo(sim.topologia, o.para); // com as concessões DHCP
      if (ip === null) return { id: o.id, texto, ok: false, motivo: `${nome(o.para)} não tem IP configurado` };
    }
    const r = porta !== null ? sim.conectar(o.de, ip, porta) : sim.ping(o.de, ip);
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
      || (o.tipo === 'dhcp-de' && dispositivo(topologia, o.pc)?.tipo === 'pc' && dispositivo(topologia, o.roteador)?.tipo === 'roteador')
      || (!o.tipo && dispositivo(topologia, o.de) && (dispositivo(topologia, o.para) || nomeValido(o.nome))))).map(o => {
    if (o.tipo === 'sem-rota-privada') return { id: o.id, tipo: 'sem-rota-privada', roteador: o.roteador };
    if (o.tipo === 'dhcp-de') return { id: o.id, tipo: 'dhcp-de', pc: o.pc, roteador: o.roteador };
    let base;
    if (nomeValido(o.nome)) base = { id: o.id, de: o.de, nome: o.nome, ...(dispositivo(topologia, o.para) ? { para: o.para } : {}) };
    else if (o.ipv6 === true) base = { id: o.id, de: o.de, para: o.para, ipv6: true };
    else base = { id: o.id, de: o.de, para: o.para, ...(Number.isInteger(o.porta) && o.porta >= 1 && o.porta <= 65535 ? { porta: o.porta } : {}) };
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
