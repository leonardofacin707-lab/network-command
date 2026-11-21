# Arquitetura

Regra central: **interface, regras de negócio e motor de simulação ficam separados.** O motor (`js/sim`) não conhece o DOM e é testado só com `node --test`.

```
index.html            casca da página (cabeçalho, #app, rodapé) e fallback para file://
css/global.css        tema, tipografia, faixas, painéis, botões
css/quiz.css          estilos do módulo Conhecimento
css/hub.css           abas, conquistas, painéis do hub
css/lab.css           laboratório e missões
data/                 conteúdo em JSON: questions, levels, categories, skills, missions, empresa, datacenter
js/main.js            ponto de entrada: carrega dados e estado pelo provedor ativo, aplica as preferências, liga a persistência
js/app/               router (hash), shell (menu e título), menu (itens e páginas fora do menu), aparencia (preferências no <html>)
js/core/              ui (utilitários DOM), store (estado), storage (localStorage v4), config (preferências do aparelho, sem DOM), progression (XP/cargo)
js/conta/             provedores (onde o progresso fica; hoje só "local") e sincronizar (código entre aparelhos e junção de progressos, sem DOM)
js/tutorial/          passos (cenário e verificação, sem DOM) e index (tela guiada sobre o editor do laboratório)
js/sim/               MOTOR (sem DOM): ipv4, topologia/ (modelo e validação em módulos: base, switch, dhcp, rotas, segurança, serviços, ipv6, ospf, wifi, normalizar; topologia.js reexporta tudo), motor (L2 com VLAN/ARP/roteamento conectado e estático/DHCP/DNS/filtro/NAT/TTL), terminal (comandos), diagnostico
js/lab/               editor (interação e terminal; reutilizado pelas missões e pelo tutorial), desenho (SVG), paineis (HTML do painel), formulario (campos -> passos de configuração), exemplos prontos
js/datacenter/        disponibilidade (série/paralelo, custo, portas; sem DOM), catalogo, index (telas)
js/empresa/           planejamento (VLSM, portas, orçamento; sem DOM), catalogo, index (telas)
js/missoes/           verificar (objetivos e XP, sem DOM), catalogo (validação dos dados), index (telas; fábrica usada por Missões e Campus)
js/hub/               inicio (tela "Jogar"), config (Configurações), sincronizar, dashboard, perfil, conquistas (regras puras em conquistas-regras.js), habilidades
js/quiz/              catalog, scoring, unlock (regras puras), map, session, resultado, hud, types/ (5 tipos)
legacy/               v0.1 congelada (Jornada do Pacote), referência de regressão. Não editar.
tools/                extrair-legado.mjs e converter-legado.mjs (geraram data/ a partir da v0.1); gerar-missoes, gerar-campus, gerar-praticas, gerar-rotas, gerar-dhcp, gerar-filtros, gerar-dns e gerar-chefoes (montam missions.json pela API do simulador; a ordem das missões fica em ordem-missoes.mjs); gerar-nivel-* (sementes do quiz)
docs/img/             capturas de tela usadas no README
tests/unit            regras puras (node --test)
tests/e2e             navegador real (playwright-core) + robô jogador
```

## Decisões

- **Estado**: `store` imutável com `ouvir/alterar`; `main.js` liga `store.ouvir(salvar)`. Módulos não escrevem no localStorage.
- **Armazenamento**: chave `network-command`, formato `{versao:4, perfil, tutorial:{concluido, em, topologia}, config:{movimento, inicio}, quiz:{melhor, historico}, conquistas, lab:{topologia}, missoes:{id:{topologia, concluida, em, xp, dicas}}, empresa:{id:{prefixos, equip, concluida, em, xp}}, datacenter:{id:{unidades, concluida, em, xp}}}` (os campos `empresa` e `datacenter` são aditivos: arquivos v4 antigos sem ele continuam válidos). Lê o formato da v0.1 (`jornada-do-pacote-v1`) e migra sem apagar. Todo dado lido é validado e entradas inválidas são descartadas. Nada de senhas ou dados pessoais além do nome de exibição.
- **Dados**: cada pergunta tem id, categoria, assunto, dificuldade, habilidade (`trilha.nível`), enunciado, carga do tipo e explicação.
- **Tipos de desafio**: cada arquivo em `js/quiz/types/` exporta `rotulo`, `renderizar` e `clique` (e `enviar` para número). Para criar um tipo novo basta adicionar o arquivo e registrá-lo em `session.js`.
- **Testes como rede de segurança**: o robô jogador resolve os desafios pela interface a partir de `tests/fixtures/legado.json` (conteúdo original), então valem para a v0.1 e para a versão atual.
- **Motor de simulação** (`js/sim`): a topologia é um dado puro (`{dispositivos, cabos}`); toda operação devolve uma topologia nova ou `{erro}`. `criarSimulacao(topologia)` guarda o cache ARP e as concessões DHCP (a topologia salva nunca recebe os endereços recebidos: `sim.topologia` é a visão com as concessões); qualquer mudança na rede recria a simulação. O terminal só formata a saída do motor.
- **Missões**: os dados (topologia inicial, objetivos, dicas, XP) estão em `data/missions.json`. Um objetivo é "A alcança B" (ou "A alcança o nome X", resolvido pelo DNS do motor) e só é cumprido se o `ping` do motor (ida e volta) funcionar; objetivos com `esperado: "falha"` exigem o isolamento; o objetivo `sem-rota-privada` é uma restrição (o roteador do provedor não pode ter rota para redes privadas), o que obriga a solução por NAT. A interface nunca decide se a rede está certa.
- **XP**: `xpDoEstado` = pontos do quiz + XP das missões concluídas + XP dos projetos da Empresa e dos desafios do Data Center aprovados (cada missão paga uma vez; cada dica usada tira 20%, piso 40%).

## Tela inicial, Configurações e conta

- **Rotas**: `inicio` (botão "Jogar" que mostra os modos de jogo), `config` (aberta só pela engrenagem do cabeçalho, fora do menu lateral), `sincronizar[/código]` e `tutorial`. A página aberta quando o endereço não indica nenhuma é `config.inicio` (tela inicial ou dashboard).
- **Preferências** (`estado.config`, validado por `limparConfig`): `movimento` (`sistema` ou `reduzir`, aplicado em `<html data-movimento>`, lido pelo CSS e por `reduzMovimento`) e `inicio`. São do aparelho: não entram no código de sincronização e a junção mantém as locais.
- **Conta e login (preparado, não implementado)**: `js/conta/provedores.js` define o formato de um provedor (`id, nome, descricao, disponivel, precisaLogin, carregar(ref), salvar(estado), apagar()`) e `main.js` usa só `provedorAtivo()`. Hoje existe apenas o `local` (localStorage). Um provedor de conta no futuro deve: (1) autenticar por um serviço próprio para isso (o jogo não recebe nem guarda senha); (2) passar todo estado recebido por `normalizar`; (3) usar `mesclarEstados` ao entrar em um aparelho que já tem progresso; (4) só entrar em `PROVEDORES` quando funcionar de verdade (a tela não mostra botão de login que não faz nada).
- **Sincronização sem servidor** (`js/conta/sincronizar.js`): o estado (sem `config`) vira `{app, estado}` em JSON, comprimido com `CompressionStream('deflate-raw')` e codificado em base64url com prefixo `NC1.` (`NC0.` sem compressão). O link usa o fragmento (`#/sincronizar/<código>`), que o navegador não envia ao servidor; ao abrir, o código sai do endereço e do histórico (`replaceState`). Limites: 2 MB de código e 1 MB depois de descomprimir (leitura em partes, para barrar "bombas" de compressão). A junção fica com o melhor de cada item (maior pontuação, concluído ganha de não concluído, união do histórico e das conquistas com a data mais antiga) e é idempotente: juntar de novo não muda nada.
- **Tutorial** (`js/tutorial/passos.js`): cenário com PC1, PC2 e SW1 sem cabos; passos em ordem (cabo PC1, cabo PC2, IP do PC1, IP do PC2 na mesma rede, ping). O último só conta quando o jogador roda `ping` no terminal e o motor confirma (mesma verificação das missões). A topologia do tutorial e a conclusão ficam em `estado.tutorial`.
