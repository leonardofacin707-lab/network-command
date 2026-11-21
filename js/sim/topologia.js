// Modelo da topologia do laboratório: dispositivos, interfaces e cabos. Funções puras e imutáveis, sem DOM.
// Cada operação devolve { topologia, ... } ou { erro } com uma mensagem em português.
// Este arquivo só reúne os módulos de js/sim/topologia/ (um por assunto), para quem importa não precisar saber onde cada função está.
export * from './topologia/base.js';
export * from './topologia/switch.js';
export * from './topologia/dhcp.js';
export * from './topologia/rotas.js';
export * from './topologia/seguranca.js';
export * from './topologia/servicos.js';
export * from './topologia/ipv6.js';
export * from './topologia/ospf.js';
export * from './topologia/wifi.js';
export { normalizarTopologia } from './topologia/normalizar.js';
