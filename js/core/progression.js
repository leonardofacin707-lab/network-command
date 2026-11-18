// Progressão compartilhada: XP, cargo e estrelas. Funções puras sobre o mapa "melhor" do quiz.
// Futuramente outros módulos (laboratório, missões) somarão XP aqui.
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
export const cargoDe = xp => CARGOS.filter(c => xp >= c[0]).pop()[1];
