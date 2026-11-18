// Lê um número digitado em formato brasileiro ou internacional, sem depender do idioma do navegador.
// Aceita: "1000", "1.000" (milhar), "1,5" e "1.5" (decimal), "1.000,5" e "1,000.5". Devolve NaN se não entender.
export function lerNumero(texto) {
  const t = String(texto ?? '').trim().replace(/\s+/g, '');
  if (!/^[+-]?[\d.,]+$/.test(t)) return NaN;
  const sinal = t.startsWith('-') ? -1 : 1;
  const corpo = t.replace(/^[+-]/, '');
  const pontos = (corpo.match(/\./g) || []).length;
  const virgulas = (corpo.match(/,/g) || []).length;
  const ehMilhar = (sep, antes) => antes.split(sep).slice(1).every(g => g.length === 3) && !/^0\d/.test(antes);
  let limpo;
  if (pontos && virgulas) {
    // O último separador é o decimal; o outro é de milhar.
    const decimal = corpo.lastIndexOf(',') > corpo.lastIndexOf('.') ? ',' : '.';
    const milhar = decimal === ',' ? '.' : ',';
    if (corpo.split(decimal).length !== 2) return NaN;
    const [inteira, frac] = corpo.split(decimal);
    if (!ehMilhar(milhar, inteira) || !inteira.split(milhar).every(Boolean)) return NaN;
    limpo = inteira.split(milhar).join('') + '.' + frac;
  } else if (pontos || virgulas) {
    const sep = pontos ? '.' : ',';
    const partes = corpo.split(sep);
    const todasTres = partes.slice(1).every(g => g.length === 3) && partes[0].length >= 1 && partes[0].length <= 3 && !/^0/.test(partes[0]);
    if (partes.length > 2 && !todasTres) return NaN; // "1.2.3" ou "1,5,5" não fazem sentido
    // "1.000" e "1,000" são mil; "1.5", "1,5" e "0.500" são decimais
    limpo = todasTres ? partes.join('') : partes.join('.');
  } else {
    limpo = corpo;
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? sinal * n : NaN;
}
