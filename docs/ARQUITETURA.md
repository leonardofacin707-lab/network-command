# Arquitetura

Regra central: **interface, regras de negócio e motor de simulação ficam separados.** O motor (`js/sim`) não conhece o DOM e é testado só com `node --test`.

```
index.html            casca da página (cabeçalho, #app, rodapé) e fallback para file://
css/global.css        tema, tipografia, faixas, painéis, botões
css/quiz.css          estilos do módulo Conhecimento
css/hub.css           abas, conquistas, painéis do hub
css/lab.css           laboratório e missões
data/                 conteúdo em JSON: questions, levels, categories, skills, missions, empresa, datacenter
js/main.js            ponto de entrada: carrega dados e estado, liga a persistência
js/core/              ui (utilitários DOM), store (estado), storage (localStorage v4), progression (XP/cargo)
js/sim/               MOTOR (sem DOM): ipv4, topologia (modelo e validação, portas access/trunk), motor (L2 com VLAN/ARP/roteamento conectado e estático/DHCP/DNS/filtro/TTL), terminal (comandos), diagnostico
js/lab/               editor visual SVG + painel de configuração + terminal (reutilizado pelas missões), exemplos prontos
js/datacenter/        disponibilidade (série/paralelo, custo, portas; sem DOM), catalogo, index (telas)
js/empresa/           planejamento (VLSM, portas, orçamento; sem DOM), catalogo, index (telas)
js/missoes/           verificar (objetivos e XP, sem DOM), catalogo (validação dos dados), index (telas; fábrica usada por Missões e Campus)
js/hub/               dashboard, perfil, conquistas (regras puras em conquistas-regras.js), habilidades
js/quiz/              catalog, scoring, unlock (regras puras), map, session, resultado, hud, types/ (5 tipos)
legacy/               v0.1 congelada (Jornada do Pacote), referência de regressão. Não editar.
tools/                extrair-legado.mjs e converter-legado.mjs (geraram data/ a partir da v0.1); gerar-missoes, gerar-campus, gerar-praticas, gerar-rotas, gerar-dhcp, gerar-filtros, gerar-dns e gerar-chefoes (montam missions.json pela API do simulador; a ordem das missões fica em ordem-missoes.mjs); gerar-nivel-* (sementes do quiz)
docs/img/             capturas de tela usadas no README
tests/unit            regras puras (node --test)
tests/e2e             navegador real (playwright-core) + robô jogador
```

## Decisões

- **Estado**: `store` imutável com `ouvir/alterar`; `main.js` liga `store.ouvir(salvar)`. Módulos não escrevem no localStorage.
- **Armazenamento**: chave `network-command`, formato `{versao:4, perfil, quiz:{melhor, historico}, conquistas, lab:{topologia}, missoes:{id:{topologia, concluida, em, xp, dicas}}, empresa:{id:{prefixos, equip, concluida, em, xp}}, datacenter:{id:{unidades, concluida, em, xp}}}` (os campos `empresa` e `datacenter` são aditivos: arquivos v4 antigos sem ele continuam válidos). Lê o formato da v0.1 (`jornada-do-pacote-v1`) e migra sem apagar. Todo dado lido é validado e entradas inválidas são descartadas. Nada de senhas ou dados pessoais além do nome de exibição.
- **Dados**: cada pergunta tem id, categoria, assunto, dificuldade, habilidade (`trilha.nível`), enunciado, carga do tipo e explicação.
- **Tipos de desafio**: cada arquivo em `js/quiz/types/` exporta `rotulo`, `renderizar` e `clique` (e `enviar` para número). Para criar um tipo novo basta adicionar o arquivo e registrá-lo em `session.js`.
- **Testes como rede de segurança**: o robô jogador resolve os desafios pela interface a partir de `tests/fixtures/legado.json` (conteúdo original), então valem para a v0.1 e para a versão atual.
- **Motor de simulação** (`js/sim`): a topologia é um dado puro (`{dispositivos, cabos}`); toda operação devolve uma topologia nova ou `{erro}`. `criarSimulacao(topologia)` guarda o cache ARP e as concessões DHCP (a topologia salva nunca recebe os endereços recebidos: `sim.topologia` é a visão com as concessões); qualquer mudança na rede recria a simulação. O terminal só formata a saída do motor.
- **Missões**: os dados (topologia inicial, objetivos, dicas, XP) estão em `data/missions.json`. Um objetivo é "A alcança B" (ou "A alcança o nome X", resolvido pelo DNS do motor) e só é cumprido se o `ping` do motor (ida e volta) funcionar; objetivos com `esperado: "falha"` exigem o isolamento. A interface nunca decide se a rede está certa.
- **XP**: `xpDoEstado` = pontos do quiz + XP das missões concluídas + XP dos projetos da Empresa e dos desafios do Data Center aprovados (cada missão paga uma vez; cada dica usada tira 20%, piso 40%).
