// Script clássico (não módulo): avisa quando a página é aberta direto do disco. Fica num arquivo próprio para a
// política de segurança de conteúdo (CSP) poder proibir scripts embutidos no HTML.
// Módulos ES e JSON exigem servidor HTTP; abrir o arquivo direto (file://) não funciona.
if (location.protocol === 'file:') {
  document.getElementById('app').innerHTML = '<section class="band"><div class="painel"><h2>Abra por um servidor local</h2>' +
    '<p>Este projeto usa módulos JavaScript e arquivos JSON, que o navegador bloqueia quando a página é aberta direto do disco.</p>' +
    '<p>Na pasta do projeto, rode <code>npm run serve</code> (ou use a extensão Live Server do VS Code) e abra <code>http://localhost:5173</code>.</p></div></section>';
}
