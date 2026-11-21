// Aplica as preferências do aparelho na página (atributos no <html>; o CSS e reduzMovimento leem daí).
export function aplicarConfig(config) {
  document.documentElement.dataset.movimento = config?.movimento === 'reduzir' ? 'reduzir' : 'sistema';
}
