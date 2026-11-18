// Regras do Data Center (sem DOM): disponibilidade em série e em paralelo, custo e portas.
// Modelo didático: cada camada tem n unidades iguais em paralelo (basta uma funcionar) e as camadas ficam em série.
// Falhas são consideradas independentes (não há falha de causa comum) e as disponibilidades são valores fictícios do cenário.
export const MAX_UNIDADES = 4;
export const MINUTOS_ANO = 365 * 24 * 60;
export const PORTAS_POR_SWITCH_ACESSO = 48;
const EPS = 1e-12;

/** Disponibilidade de n unidades iguais em paralelo: 1 − (1 − a)^n. */
export const dispParalelo = (a, n) => (n >= 1 ? 1 - (1 - a) ** n : 0);

/** Minutos de indisponibilidade por ano para uma disponibilidade A (0 a 1). */
export const minutosDeParada = A => Math.max(0, (1 - A) * MINUTOS_ANO);

/** Texto legível da parada anual. */
export function textoParada(min) {
  if (min < 1) return `${(min * 60).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} s/ano`;
  if (min < 120) return `${min.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min/ano`;
  return `${(min / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h/ano`;
}

const pct = A => (A * 100).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 }) + '%';

/**
 * Avalia um plano { unidades: { camadaId: n } } contra o desafio.
 * Devolve { itens: [{ id, texto, ok, detalhe }], total, custo, aprovado, porCamada }.
 */
export function avaliarDesafio(desafio, camadas, plano) {
  const un = id => { const n = plano.unidades?.[id]; return Number.isInteger(n) && n >= 0 ? Math.min(n, MAX_UNIDADES) : 0; };
  const itens = [];
  let total = 1, custo = 0;
  const porCamada = [];
  const faltando = [];
  for (const c of camadas) {
    const n = un(c.id);
    custo += n * c.custo;
    const A = dispParalelo(c.disp, n);
    porCamada.push({ id: c.id, nome: c.nome, unidades: n, disp: A });
    total *= A;
    if (n < 1) faltando.push(c.nome);
  }
  itens.push({ id: 'camadas', texto: 'Todas as camadas presentes', ok: faltando.length === 0, detalhe: faltando.length ? `falta: ${faltando.join(', ')}` : 'cada camada tem ao menos 1 unidade' });

  const parada = minutosDeParada(total);
  itens.push({ id: 'sla', texto: `Disponibilidade de pelo menos ${pct(desafio.sla)}`, ok: faltando.length === 0 && total + EPS >= desafio.sla,
    detalhe: faltando.length ? 'monte todas as camadas para calcular' : `o projeto entrega ${pct(total)} (${textoParada(parada)} fora do ar)` });

  const acesso = un(desafio.camadaAcesso);
  const portasNecessarias = desafio.servidores * (acesso >= 2 ? 2 : 1);
  const portas = acesso * PORTAS_POR_SWITCH_ACESSO;
  itens.push({ id: 'portas', texto: 'Portas de acesso para os servidores', ok: portas >= portasNecessarias && acesso >= 1,
    detalhe: `${portas} portas para ${portasNecessarias} (${desafio.servidores} servidores${acesso >= 2 ? ', cada um ligado a 2 switches' : ''})` });

  itens.push({ id: 'orcamento', texto: 'Dentro do orçamento', ok: custo <= desafio.orcamento, detalhe: `custo ${custo.toLocaleString('pt-BR')} de ${desafio.orcamento.toLocaleString('pt-BR')}` });
  return { itens, total, custo, porCamada, aprovado: itens.every(i => i.ok) };
}

export function validarCamadas(lista) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).filter(c => c && /^[a-z0-9-]{1,30}$/.test(c.id ?? '') && typeof c.nome === 'string'
    && typeof c.disp === 'number' && c.disp > 0 && c.disp < 1 && Number.isInteger(c.custo) && c.custo > 0 && !vistos.has(c.id) && vistos.add(c.id))
    .map(c => ({ id: c.id, nome: c.nome, disp: c.disp, custo: c.custo, descricao: typeof c.descricao === 'string' ? c.descricao : '' }));
}

export function validarDesafio(d, camadas) {
  if (!d || typeof d !== 'object' || !/^[a-z0-9-]{1,40}$/.test(d.id ?? '') || typeof d.titulo !== 'string' || typeof d.cenario !== 'string') return null;
  if (!(typeof d.sla === 'number' && d.sla > 0.9 && d.sla < 1)) return null;
  if (!camadas.some(c => c.id === d.camadaAcesso)) return null;
  const inteiro = (v, a, b, def) => (Number.isInteger(v) && v >= a && v <= b ? v : def);
  return { id: d.id, titulo: d.titulo, cenario: d.cenario, sla: d.sla, camadaAcesso: d.camadaAcesso,
    servidores: inteiro(d.servidores, 1, 1000, 10), orcamento: inteiro(d.orcamento, 1, 1e8, 10000),
    xp: inteiro(d.xp, 1, 1000, 100), dificuldade: [1, 2, 3].includes(d.dificuldade) ? d.dificuldade : 1 };
}

/** Custo do plano aprovado mais barato (busca exaustiva; usada em testes e para calibrar orçamentos). */
export function menorCusto(desafio, camadas) {
  let melhor = Infinity;
  const plano = { unidades: {} };
  // O orçamento não pode podar a busca: avalia com orçamento infinito.
  const sem = { ...desafio, orcamento: Infinity };
  const rec = i => {
    if (i === camadas.length) { const r = avaliarDesafio(sem, camadas, plano); if (r.aprovado) melhor = Math.min(melhor, r.custo); return; }
    for (let n = 1; n <= MAX_UNIDADES; n++) { plano.unidades[camadas[i].id] = n; rec(i + 1); }
  };
  rec(0);
  return melhor;
}
