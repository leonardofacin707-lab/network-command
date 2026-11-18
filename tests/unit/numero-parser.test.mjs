import test from 'node:test';
import assert from 'node:assert/strict';
import { lerNumero } from '../../js/quiz/numero-parser.js';

test('formatos aceitos', () => {
  const casos = [
    ['1000', 1000], ['1.000', 1000], ['1,000', 1000], ['10.000', 10000], ['1.000.000', 1000000],
    ['1,5', 1.5], ['1.5', 1.5], ['0,5', 0.5], ['0.5', 0.5], ['0.500', 0.5], ['0,250', 0.25],
    ['1.000,5', 1000.5], ['1,000.5', 1000.5], ['1.234.567,89', 1234567.89],
    ['  42 ', 42], ['-3', -3], ['-1,5', -1.5], ['+7', 7], ['1 000', 1000], ['1024', 1024], ['0', 0], ['12,50', 12.5]
  ];
  for (const [texto, esperado] of casos) assert.equal(lerNumero(texto), esperado, `"${texto}"`);
});

test('entradas inválidas viram NaN', () => {
  for (const t of ['', '   ', 'abc', '1.2.3', '1,5,5', '1..2', ',', '.', '1e3', '12a', '--1', '1.000,5,2', null, undefined]) {
    assert.ok(Number.isNaN(lerNumero(t)), `"${t}"`);
  }
});
