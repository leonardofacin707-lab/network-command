// OSPF simplificado (puro, sem DOM): o roteador entra no OSPF pelas interfaces que casam com um comando
// "network REDE WILDCARD area N" (a wildcard é o inverso da máscara: bit 1 = "tanto faz"). Roteadores vizinhos no mesmo
// enlace formam vizinhança (FULL) se estão na mesma sub-rede, com a mesma máscara e na mesma área. Cada roteador calcula
// o caminho mais curto (SPF, custo 1 por enlace) e aprende as redes dos outros como rotas "O" (distância administrativa
// 110: perde para rota conectada e para rota estática do mesmo prefixo).
// NÃO modela: hello/dead timers, DR/BDR, router-id, LSAs e áreas de verdade (várias áreas viram um domínio só),
// custos por largura de banda, rotas iguais em paralelo (ECMP), autenticação, interfaces passivas.
import { lerIPv4, lerMascara, formatarIPv4, enderecoDeRede, mesmaRede } from './ipv4.js';
import { dispositivo } from './topologia.js';
import { configDaInterface, dominioL2, temLink } from './motor.js';

const U32 = n => n >>> 0;

/** O comando network casa com o IP da interface? (bits 0 da wildcard precisam ser iguais) */
export const casaNetwork = (ip, rede, wildcard) => U32(ip & ~wildcard) === U32(rede & ~wildcard);

/** Interfaces de um roteador que participam do OSPF: [{ p, ip, mascara, area }]. */
export function interfacesOspf(r) {
  if (r.tipo !== 'roteador' || !r.ospf?.redes?.length) return [];
  const lista = [];
  for (const i of r.interfaces) {
    const cfg = configDaInterface(r, i.id);
    if (!cfg) continue;
    const st = r.ospf.redes.find(n => casaNetwork(cfg.ip, lerIPv4(n.rede), lerIPv4(n.wildcard)));
    if (st) lista.push({ p: i.id, ip: cfg.ip, mascara: cfg.mascara, area: st.area });
  }
  return lista;
}

/**
 * Calcula vizinhanças e rotas OSPF da topologia inteira.
 * vizinhos: Map(roteadorId -> [{ vizinho, porta, ipVizinho, estado: 'FULL' | 'area-diferente' | 'mascara-diferente' }])
 * rotas: Map(roteadorId -> [{ rede, mascara, via, custo, porta }])
 */
export function calcularOspf(t) {
  const roteadores = t.dispositivos.filter(d => d.tipo === 'roteador' && d.ospf?.redes?.length);
  const vizinhos = new Map(roteadores.map(r => [r.id, []]));
  const adj = new Map(roteadores.map(r => [r.id, []])); // só FULL: [{ para, viaIp, porta }]
  for (const r of roteadores) {
    for (const i of interfacesOspf(r)) {
      if (!temLink(t, r.id, i.p)) continue;
      for (const e of dominioL2(t, r.id, i.p) ?? []) {
        const v = dispositivo(t, e.d);
        if (v.tipo !== 'roteador' || v.id === r.id) continue;
        const j = interfacesOspf(v).find(x => x.p === e.p);
        if (!j) continue;
        let estado = 'FULL';
        if (j.mascara !== i.mascara || !mesmaRede(i.ip, j.ip, i.mascara)) estado = 'mascara-diferente';
        else if (j.area !== i.area) estado = 'area-diferente';
        vizinhos.get(r.id).push({ vizinho: v.id, porta: i.p, ipVizinho: j.ip, estado, area: i.area, areaVizinho: j.area });
        if (estado === 'FULL') adj.get(r.id).push({ para: v.id, viaIp: j.ip, porta: i.p });
      }
    }
  }
  const anuncios = new Map(roteadores.map(r => [r.id, interfacesOspf(r).filter(i => temLink(t, r.id, i.p)).map(i => ({ rede: enderecoDeRede(i.ip, i.mascara), mascara: i.mascara }))]));
  const rotas = new Map();
  for (const r of roteadores) {
    // SPF (busca em largura: todo enlace custa 1); guarda o primeiro salto de cada roteador alcançado
    const dist = new Map([[r.id, 0]]), primeiro = new Map(), fila = [r.id];
    while (fila.length) {
      const atual = fila.shift();
      for (const a of adj.get(atual) ?? []) {
        if (dist.has(a.para)) continue;
        dist.set(a.para, dist.get(atual) + 1);
        primeiro.set(a.para, atual === r.id ? { via: a.viaIp, porta: a.porta } : primeiro.get(atual));
        fila.push(a.para);
      }
    }
    const conectadas = r.interfaces.map(i => configDaInterface(r, i.id)).filter(Boolean).map(c => `${enderecoDeRede(c.ip, c.mascara)}/${c.mascara}`);
    const melhores = new Map();
    for (const [outro, d] of dist) {
      if (outro === r.id) continue;
      for (const n of anuncios.get(outro)) {
        const k = `${n.rede}/${n.mascara}`, custo = d + 1;
        if (conectadas.includes(k) || (melhores.has(k) && melhores.get(k).custo <= custo)) continue;
        melhores.set(k, { rede: n.rede, mascara: n.mascara, via: primeiro.get(outro).via, porta: primeiro.get(outro).porta, custo });
      }
    }
    rotas.set(r.id, [...melhores.values()].sort((a, b) => a.rede - b.rede));
  }
  return { vizinhos, rotas };
}

/** Topologia vista com as rotas OSPF de cada roteador (campo rotasOspf, só na simulação). */
export function aplicarOspf(t, ospf) {
  if (!ospf.rotas.size) return t;
  return { ...t, dispositivos: t.dispositivos.map(d => (ospf.rotas.has(d.id) ? { ...d, rotasOspf: ospf.rotas.get(d.id) } : d)) };
}

/** Tamanho do prefixo de uma máscara numérica (ex.: 255.255.255.0 → 24). */
export function prefixoOspf(m) { let n = 0; for (let b = 31; b >= 0 && (m >>> b) & 1; b--) n++; return n; }
