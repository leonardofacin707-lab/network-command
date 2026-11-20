// Service worker: guarda todos os arquivos do jogo para ele abrir sem internet (o build preenche a versão e a lista).
// Só arquivos do próprio site passam por aqui; nada de dados do jogador (o progresso fica no localStorage).
const VERSAO = '__VERSAO__';
const ARQUIVOS = ['__ARQUIVOS__'];
const CACHE = `network-command-${VERSAO}`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n.startsWith('network-command-') && n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Primeiro o cache (abre na hora e offline); o que não estiver no cache vai para a rede.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
