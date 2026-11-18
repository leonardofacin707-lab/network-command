// Ordem de aprendizagem das missões em data/missions.json, compartilhada pelos geradores (o que não estiver aqui vai para o fim).
export const ORDEM_MISSOES = [
  'primeira-rede', 'dois-switches', 'cabo-esquecido', 'ip-duplicado', 'mascara-errada', 'gateway-errado', 'interface-sem-ip', 'duas-redes-um-roteador',
  'rota-so-de-ida', 'rota-padrao', 'rotas-estaticas',
  'dhcp-sem-servidor', 'dhcp-pool-curto', 'dhcp-duas-redes',
  'filtro-convidado', 'filtro-ordem', 'filtro-resposta',
  'dns-ping-no-nome', 'dns-registro-errado', 'dns-da-empresa',
  'filial-fora-do-ar', 'dois-sites-quatro-defeitos', 'chefao-cinco-camadas',
  'setores-separados', 'porta-na-vlan-errada', 'trunk-esquecido', 'vlans-sem-gateway', 'dois-andares-mesmas-vlans', 'campus-completo'
];

export function ordenarMissoes(lista) {
  const pos = m => (ORDEM_MISSOES.includes(m.id) ? ORDEM_MISSOES.indexOf(m.id) : ORDEM_MISSOES.length);
  return lista.map((m, i) => ({ m, i })).sort((a, b) => pos(a.m) - pos(b.m) || a.i - b.i).map(x => x.m);
}
