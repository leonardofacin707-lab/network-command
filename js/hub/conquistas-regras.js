// Conquistas: cada uma é uma regra verificável sobre o estado real. Nada é concedido "de enfeite".
import { xpDoEstado } from '../core/progression.js';
import { foiPerfeita } from '../quiz/historico.js';

export const CONQUISTAS = [
  { id: 'primeiro-passo', nome: 'Primeiro passo', descricao: 'Responder o seu primeiro desafio.',
    teste: ({ estado }) => estado.quiz.historico.length >= 1 },
  { id: 'de-primeira', nome: 'De primeira', descricao: 'Acertar 10 desafios de primeira.',
    teste: ({ estado }) => estado.quiz.historico.filter(foiPerfeita).length >= 10 },
  { id: 'perseverante', nome: 'Perseverante', descricao: 'Responder 50 desafios.',
    teste: ({ estado }) => estado.quiz.historico.length >= 50 },
  { id: 'nivel-dominado', nome: 'Nível dominado', descricao: 'Fazer 3 estrelas em qualquer nível.',
    teste: ({ estado }) => Object.values(estado.quiz.melhor).some(m => m.estrelas === 3) },
  { id: 'nota-maxima', nome: 'Nota máxima', descricao: 'Fazer todos os pontos possíveis em um nível.',
    teste: ({ estado, catalogo }) => Object.entries(estado.quiz.melhor).some(([id, m]) => m.pts === catalogo.limites[id]) },
  { id: 'trilha-completa', nome: 'Trilha completa', descricao: 'Ter pelo menos 1 estrela em todos os níveis disponíveis.',
    teste: ({ estado, catalogo }) => catalogo.jogaveis.every(n => estado.quiz.melhor[n.id]?.estrelas > 0) },
  { id: 'tecnico-de-redes', nome: 'Técnico de redes', descricao: 'Chegar a 2.400 XP e ser promovido.',
    teste: ({ estado }) => xpDoEstado(estado) >= 2400 },
  { id: 'aprendeu-com-o-erro', nome: 'Aprendeu com o erro', descricao: 'Errar um desafio e depois acertá-lo de primeira.',
    teste: ({ estado }) => {
      const vistos = new Map(); // id -> já errou?
      for (const r of estado.quiz.historico) {
        if (vistos.get(r.q) && foiPerfeita(r)) return true;
        if (!foiPerfeita(r)) vistos.set(r.q, true);
      }
      return false;
    } },
  { id: 'primeira-missao', nome: 'Primeiro chamado', descricao: 'Concluir a sua primeira missão de troubleshooting.',
    teste: ({ estado }) => Object.values(estado.missoes).some(m => m.concluida) },
  { id: 'todas-as-missoes', nome: 'Rede sem defeitos', descricao: 'Concluir todas as missões disponíveis.',
    teste: ({ estado, catalogo }) => (catalogo.missoes ?? []).length > 0 && catalogo.missoes.every(m => estado.missoes[m.id]?.concluida) },
  { id: 'identificado', nome: 'Identificado', descricao: 'Escolher o seu nome de exibição no perfil.',
    teste: ({ estado }) => estado.perfil.nome.length > 0 }
];

export const IDS_CONQUISTAS = CONQUISTAS.map(c => c.id);

/** Ids das conquistas cuja regra está satisfeita agora. */
export const avaliar = (estado, catalogo) => CONQUISTAS.filter(c => c.teste({ estado, catalogo })).map(c => c.id);

/** Devolve o estado com as conquistas recém-satisfeitas registradas (ou o mesmo objeto, se não houver novas). */
export function concederNovas(estado, catalogo, agora = new Date()) {
  const novas = avaliar(estado, catalogo).filter(id => !estado.conquistas[id]);
  if (!novas.length) return estado;
  const conquistas = { ...estado.conquistas };
  for (const id of novas) conquistas[id] = agora.toISOString();
  return { ...estado, conquistas };
}
