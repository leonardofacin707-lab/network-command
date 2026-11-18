// Progressão compartilhada: XP, cargo e estrelas. Funções puras sobre o mapa "melhor" do quiz.
// O XP total soma o quiz e as missões concluídas.
export const CARGOS = [
  [0, 'Estagiário de TI'],
  [900, 'Técnico de suporte'],
  [2400, 'Técnico de redes'],
  [4500, 'Analista de redes'],
  [7000, 'Especialista em redes'],
  [9500, 'Arquiteto de redes']
];

export const xpTotal = melhor => Object.values(melhor).reduce((soma, m) => soma + m.pts, 0);
export const estrelasTotal = melhor => Object.values(melhor).reduce((soma, m) => soma + m.estrelas, 0);
/** XP ganho em missões concluídas (cada missão concluída soma o XP gravado nela uma única vez). */
export const xpMissoes = missoes => Object.values(missoes ?? {}).reduce((soma, m) => soma + (m.concluida ? m.xp : 0), 0);
/** XP ganho em projetos da Empresa aprovados (paga uma vez por projeto). */
export const xpEmpresa = empresa => Object.values(empresa ?? {}).reduce((soma, p) => soma + (p.concluida ? p.xp : 0), 0);
/** XP total do jogador: quiz + missões + projetos. É o que alimenta cargo, nível e HUD. */
export const xpDoEstado = estado => xpTotal(estado.quiz.melhor) + xpMissoes(estado.missoes) + xpEmpresa(estado.empresa);
export const cargoDe = xp => CARGOS.filter(c => xp >= c[0]).pop()[1];

export const XP_POR_NIVEL = 300;
/** Nível do jogador (1, 2, 3...) e o quanto falta para o próximo. Independe do cargo. */
export function nivelDoJogador(xp) {
  return { nivel: Math.floor(xp / XP_POR_NIVEL) + 1, xpNoNivel: xp % XP_POR_NIVEL, xpParaProximo: XP_POR_NIVEL };
}
