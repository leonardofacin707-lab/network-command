// Topologias prontas do laboratório livre (montadas pela mesma API que o jogador usa, então sempre são válidas).
import { topologiaVazia, adicionarDispositivo, conectar, configurarInterface, configurarGateway } from '../sim/topologia.js';

const add = (t, tipo, x, y) => adicionarDispositivo(t, tipo, { x, y }).topologia;
const cfg = (t, id, porta, ip, m = '/24') => configurarInterface(t, id, porta, { ip, mascara: m }).topologia;

/** 3 computadores e 1 switch na mesma rede 192.168.1.0/24, tudo configurado. */
export function exemploLan() {
  let t = topologiaVazia();
  t = add(t, 'switch', 450, 130);
  t = add(t, 'pc', 200, 340); t = add(t, 'pc', 450, 340); t = add(t, 'pc', 700, 340);
  for (const pc of ['pc1', 'pc2', 'pc3']) t = conectar(t, pc, 'sw1').topologia;
  t = cfg(t, 'pc1', 'eth0', '192.168.1.10'); t = cfg(t, 'pc2', 'eth0', '192.168.1.20'); t = cfg(t, 'pc3', 'eth0', '192.168.1.30');
  return t;
}

/** Duas redes (192.168.1.0/24 e 10.0.0.0/24) ligadas por um roteador, tudo configurado. */
export function exemploDuasRedes() {
  let t = topologiaVazia();
  t = add(t, 'pc', 110, 120); t = add(t, 'pc', 790, 120);
  t = add(t, 'switch', 250, 260); t = add(t, 'switch', 650, 260);
  t = add(t, 'roteador', 450, 400);
  for (const [a, b] of [['pc1', 'sw1'], ['sw1', 'r1'], ['pc2', 'sw2'], ['sw2', 'r1']]) t = conectar(t, a, b).topologia;
  t = cfg(t, 'r1', 'gi0', '192.168.1.1'); t = cfg(t, 'r1', 'gi1', '10.0.0.1');
  t = cfg(t, 'pc1', 'eth0', '192.168.1.10'); t = configurarGateway(t, 'pc1', '192.168.1.1').topologia;
  t = cfg(t, 'pc2', 'eth0', '10.0.0.10'); t = configurarGateway(t, 'pc2', '10.0.0.1').topologia;
  return t;
}
