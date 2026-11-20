// Exercícios gerados: respostas corretas (comparadas com o motor de IPv4), aceitação de formatos e IPv6 canônico.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarExercicio, TIPOS_EXERCICIO, abreviarIPv6, geradorComSemente } from '../../js/quiz/exercicios.js';
import { lerIPv4, enderecoDeRede, enderecoDeBroadcast, mascaraDePrefixo, formatarIPv4 } from '../../js/sim/ipv4.js';

test('todos os tipos: 300 exercícios cada, a resposta oficial é aceita e há passos de resolução', () => {
  const rng = geradorComSemente(42);
  for (const tipo of Object.keys(TIPOS_EXERCICIO)) for (let i = 0; i < 300; i++) {
    const e = gerarExercicio(tipo, rng);
    assert.ok(e.confere(e.resposta), `${tipo}: ${e.enunciado} -> ${e.resposta}`);
    assert.ok(e.passos.length >= 2 && e.enunciado && e.dica);
    assert.equal(e.confere('resposta errada'), false);
  }
});

test('rede e broadcast batem com o motor de IPv4', () => {
  const rng = geradorComSemente(7);
  for (let i = 0; i < 200; i++) {
    const e = gerarExercicio('rede', rng);
    const [, ip, p] = e.enunciado.match(/host ([\d.]+)\/(\d+)/);
    assert.equal(e.resposta, formatarIPv4(enderecoDeRede(lerIPv4(ip), mascaraDePrefixo(Number(p)))));
    const b = gerarExercicio('broadcast', rng);
    const [, ip2, p2] = b.enunciado.match(/host ([\d.]+)\/(\d+)/);
    assert.equal(b.resposta, formatarIPv4(enderecoDeBroadcast(lerIPv4(ip2), mascaraDePrefixo(Number(p2)))));
  }
});

test('aceita variações razoáveis de formato', () => {
  const rng = geradorComSemente(3);
  const f = gerarExercicio('faixa', rng);
  const [a, b] = f.resposta.split(' - ');
  assert.ok(f.confere(`${a}-${b}`) && f.confere(`${a} a ${b}`) && f.confere(` ${a} até ${b} `));
  const d = gerarExercicio('divisao', rng);
  assert.ok(d.confere(d.resposta.slice(1)), 'sem a barra também vale');
  const h = gerarExercicio('hosts', geradorComSemente(9));
  assert.ok(h.confere(Number(h.resposta).toLocaleString('pt-BR')), 'com ponto de milhar');
  const m = gerarExercicio('mascara', rng);
  assert.equal(m.confere('/' + m.enunciado.match(/\/(\d+)/)[1]), false, 'a pergunta pede o decimal');
});

test('IPv6: forma canônica (zeros à esquerda, maior sequência, um único ::, empate na primeira)', () => {
  assert.equal(abreviarIPv6([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]), '2001:db8::1');
  assert.equal(abreviarIPv6([0x2001, 0xdb8, 0, 1, 0, 0, 0, 1]), '2001:db8:0:1::1', 'a sequência mais longa');
  assert.equal(abreviarIPv6([0x2001, 0xdb8, 0, 0, 1, 0, 0, 1]), '2001:db8::1:0:0:1', 'empate: a primeira');
  assert.equal(abreviarIPv6([0x2001, 0xdb8, 0, 1, 2, 3, 4, 5]), '2001:db8:0:1:2:3:4:5', 'um zero só não vira ::');
  assert.equal(abreviarIPv6([0, 0, 0, 0, 0, 0, 0, 1]), '::1');
  assert.equal(abreviarIPv6([0xfe80, 0, 0, 0, 0, 0, 0, 0]), 'fe80::');
});
