// Menu lateral. estado: 'pronto' (funciona), 'proto' (protótipo: funciona de forma simplificada) ou 'emdev' (ainda não existe).
export const MENU = [
  { id: 'dashboard', rotulo: 'Dashboard', estado: 'pronto', icone: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>' },
  { id: 'conhecimento', rotulo: 'Conhecimento', estado: 'pronto', icone: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 7h6"/>' },
  { id: 'laboratorio', rotulo: 'Laboratório', estado: 'proto', icone: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>' },
  { id: 'empresa', rotulo: 'Empresa', estado: 'emdev', icone: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>' },
  { id: 'datacenter', rotulo: 'Data Center', estado: 'emdev', icone: '<rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="11" width="18" height="6" rx="1"/><path d="M7 6h.01M7 14h.01M3 20h18"/>' },
  { id: 'campus', rotulo: 'Campus de Redes', estado: 'emdev', icone: '<path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6"/>' },
  { id: 'missoes', rotulo: 'Missões', estado: 'proto', icone: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>' },
  { id: 'habilidades', rotulo: 'Árvore de Habilidades', estado: 'proto', icone: '<circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v5M12 12l-6 5M12 12l6 5"/>' },
  { id: 'conquistas', rotulo: 'Conquistas', estado: 'pronto', icone: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>' },
  { id: 'perfil', rotulo: 'Perfil', estado: 'pronto', icone: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' }
];

export const SELOS = { emdev: 'em dev.', proto: 'protótipo' };
