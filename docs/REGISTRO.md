# Registro de continuidade

Atualizado a cada etapa. Convenção: ✅ pronto e testado · 🧪 protótipo (funciona, mas simplificado) · ⏳ não iniciado.

## Fase 1 — Organização e preservação ✅

- ✅ v0.1 congelada em `legacy/index-v0.1.html` (tag `v0.1`).
- ✅ Quiz preservado: 27 desafios, 5 tipos, mesma pontuação (100/60/30), estrelas, liberação e cargos. Teste de preservação compara o conteúdo com o original.
- ✅ Código dividido em módulos, CSS separado, dados em JSON; capturas de tela idênticas à v0.1 antes das correções.
- ✅ Estado salvo v2 com validação e migração do formato da v0.1.
- ✅ Correções da auditoria: campo numérico independente de idioma (`1.000`, `1,5`), grupos de classificação acessíveis, barra de progresso com nome, marcas ✓/✗, contraste das estrelas, cabos do mapa contornando rótulos, cabeçalho compacto no celular, atalho "Próximo nível", distratores rebalanceados, aviso de independência da Cisco.

### Problemas conhecidos
- Perguntas de múltipla escolha: embora o rebalanceamento tenha tirado o vício de "a mais longa é a certa" (11 de 14 → 4 de 14), a revisão pedagógica das alternativas ainda é humana.
- Fontes vêm do Google Fonts; sem internet o jogo usa fontes do sistema (funciona, mas com aparência diferente).

## Fase 2 — Hub de aprendizagem ✅

- ✅ Casca com menu lateral (10 entradas), roteador por hash (`#/modulo/sub`), tema escuro estilo NOC, menu em gaveta no celular.
- ✅ Menu honesto: (na Fase 2) Laboratório, Empresa, Data Center, Campus de Redes e Missões mostravam o selo "em dev." e uma página que diz que o módulo ainda não existe. Árvore de Habilidades está marcada como protótipo.
- ✅ Dashboard: progressão (cargo, XP, nível do jogador, 300 XP por nível), continuar de onde parou, domínio por trilha, pontos de atenção, atividade recente, conquistas. Tudo calculado do estado real; estados vazios são explícitos.
- ✅ Quiz ampliado: histórico de respostas (últimas 300), revisão de erros (não dá XP), desempenho por assunto.
- ✅ Conquistas: 9 na Fase 2 (13 hoje), cada uma é uma regra verificável (ver `js/hub/conquistas-regras.js`), concedidas na mudança de estado, com aviso na tela.
- ✅ Perfil: nome de exibição validado, backup (exportar/importar com validação) e zerar progresso com confirmação em duas etapas.
- 🧪 Árvore de habilidades: 8 trilhas × 3 níveis de domínio. Só a Teoria de Fundamentos é medida; Prática e Diagnóstico aparecem trancados até existir o laboratório.
- ✅ Estado salvo v3 (migra v1 e v2). Validação descarta registros inválidos.
- ✅ Contraste de texto WCAG AA verificado por teste em todas as páginas (1280 e 390 px).

### Pendências conhecidas da Fase 2
- Desafios cronometrados e missões teóricas (listados no prompt) ainda não foram feitos.
- Só as categorias Fundamentos e OSI/TCP-IP têm perguntas (27 no total); as outras 14 categorias aguardam conteúdo.
- Créditos (moeda do jogo) ficam para a Fase 6, quando a infraestrutura existir.

## Fase 3 — Laboratório visual 🧪

- 🧪 Área de trabalho SVG (900×520): adicionar PC, switch e roteador (máx. 16), arrastar com mouse/toque ou mover com as setas (10 px), ligar com cabos (primeira porta livre de cada lado), remover cabo/dispositivo.
- ✅ Configuração por dispositivo: nome, IP e máscara (`255.255.255.0` ou `/24`) por interface, gateway do computador. Erros explicados (IP inválido, endereço de rede/broadcast, loopback, máscara não contígua, nome duplicado).
- ✅ Dois exemplos prontos (3 PCs + switch; 2 redes + roteador) montados pela mesma API do jogador. "Limpar tudo" pede confirmação.
- ✅ Tudo salvo no navegador (`lab.topologia`); topologia salva corrompida é saneada sem derrubar a página.
- ✅ Acessível: cada dispositivo é focável, tem nome com IP e abre com Enter.
- Limite: a tela é protótipo para desktop e celular, mas arrastar em tela pequena é mais difícil (o desenho rola na horizontal abaixo de 640 px).

## Fase 4 — Motor de simulação ✅ (com simplificações declaradas)

- ✅ IPv4 (rede, broadcast, hosts úteis, classe), switch (domínio L2 com varredura), ARP com cache, roteador com rotas das redes conectadas, TTL (PC 128, roteador 255), caminho de volta separado do de ida, conflito de IP.
- ✅ Terminal: `ipconfig [/all]`, `ping [-n N] destino`, `tracert`, `arp -a`, `hostname`, `help`, `cls`; histórico com setas ↑/↓. Saída no estilo do Windows em português.
- 🧪 **Não simulado** (na Fase 4; VLANs entraram depois, ver Campus): latência e perda aleatória, roteamento dinâmico (rotas estáticas, DHCP, filtro de pacotes e DNS simplificados entraram depois, ver abaixo), NAT, firewall, DNS. Mensagens de "inacessível" de roteadores são simplificadas.
- ✅ 49 testes unitários do motor (IPv4, topologia, motor, terminal, diagnóstico) e 10 e2e do laboratório.

## Fase 5 — Missões de troubleshooting 🧪

- ✅ 5 missões (cabo esquecido, IP duplicado, máscara errada, gateway errado, interface do roteador sem IP). Cada uma começa quebrada (teste garante) e tem uma correção testada.
- ✅ Verificação pelo motor: objetivo cumprido só se o ping de ida e volta funcionar. Motivo da falha mostrado sem entregar a solução.
- ✅ Dicas progressivas (cada uma tira 20% do XP, piso 40%), reiniciar cenário (com confirmação), progresso por missão salvo, XP pago uma única vez.
- ✅ XP de missões soma no HUD, dashboard, perfil, cargo e conquistas. Novas conquistas: *Primeiro chamado* e *Rede sem defeitos*.
- 🧪 Marcado como protótipo: só 5 missões, todas de camada 1–3 com topologias pequenas; não há missões cronometradas nem cenários com múltiplos defeitos.
- Correção de UI descoberta pelos testes: a aba "Revisão de erros" ficava destacada depois de voltar ao mapa.

## Fase 6 — Infraestrutura (parcial)

### Empresa 🧪
- ✅ 3 projetos de planejamento (escritório, clínica, filial com bloco apertado). O jogador escolhe o prefixo de cada setor e a quantidade de equipamentos (switch 8/24 portas, roteador).
- ✅ Regras reais em `js/empresa/planejamento.js`: endereços necessários = hosts + crescimento + 1 de gateway; alocação VLSM alinhada dentro do bloco (usa a aritmética IPv4 do motor); portas úteis = portas − 1 enlace por switch; roteador obrigatório; orçamento. Desperdício vira aviso, não reprovação.
- ✅ Cada projeto tem solução dentro do orçamento (teste por busca exaustiva) e cada regra reprova sozinha (teste). XP pago uma vez; nova conquista *Planejador de rede*.
- 🧪 É planejamento, não simulação: o tráfego não passa pelo motor, não há falhas nem crescimento ao longo do tempo, e a moeda do jogo (créditos) ainda não existe (o orçamento é um número do cenário, em R$ fictícios).
- Endurecimento: conclusão de missão/projeto sem XP ou data válidos no arquivo salvo deixa de valer (antes ficava "concluída" com 0 XP).

### Data Center 🧪
- ✅ 3 desafios (loja virtual 99,9%, sistema bancário 99,99%, pronto-socorro 99,9995%). O jogador escolhe de 0 a 4 unidades de cada camada (acesso, agregação, núcleo, energia, links de Internet).
- ✅ Regras reais em `js/datacenter/disponibilidade.js`: unidades de uma camada em paralelo (1 − (1 − a)^n), camadas em série (produto), parada anual em minutos, portas de acesso (48 por switch; com 2+ switches cada servidor usa 2 portas) e orçamento.
- ✅ Testes: contas conferidas (4 noves = 52,56 min/ano), busca exaustiva garante solução dentro do orçamento com folga pequena, "tudo no máximo" estoura o orçamento, uma unidade por camada nunca cumpre a meta. Nova conquista *Alta disponibilidade*.
- 🧪 É cálculo, não simulação: disponibilidades fictícias, falhas independentes (sem falha de causa comum), sem banda/capacidade de links, sem falhas ao vivo.

### Campus de Redes 🧪 (VLANs)
- ✅ O motor agora simula **VLANs**: portas `access` (uma VLAN, sem marca) e `trunk` (todas as VLANs marcadas; nativa 1) nos switches; o broadcast só atravessa portas da mesma VLAN; trunk tem de existir nos dois lados; host ligado a trunk só recebe a VLAN nativa. Roteamento entre VLANs com **uma interface física do roteador por VLAN**.
- ✅ Laboratório: tabela de portas do switch (modo e VLAN, com validação 1–4094), rótulo de VLAN/trunk no desenho do switch e vários cabos entre o mesmo par de dispositivos (desenhados lado a lado).
- ✅ 4 missões de campus (porta na VLAN errada, trunk esquecido, VLANs que não se falam, campus inteiro com 2 defeitos), todas começam quebradas e cada correção parcial não basta (testado). Usam a mesma verificação por ping das Missões; ficam em `data/missions.json` com `modulo: "campus"` (gerador: `tools/gerar-campus.mjs`).
- 🧪 **Não simulado**: subinterfaces (router-on-a-stick), STP/loops, VTP/DTP, VLAN nativa configurável, ACLs, roteamento dinâmico. Um quadro marcado que chega a uma porta access é tratado como da VLAN dela (um switch real o descartaria).
- Todas as 10 entradas do menu agora têm uma página funcional (a de "em desenvolvimento" foi removida por não ter mais uso).

### Integração com a progressão compartilhada
- ✅ Árvore de habilidades: os degraus **Prática** e **Diagnóstico** deixam de ser "sem conteúdo" quando há itens mapeados (campo `habilidades` em cada missão/projeto, ex.: `ethernet-comutacao.diagnostico`). Mostra "X de Y concluídos" com a lista de itens; o que não tem conteúdo continua "Sem conteúdo ainda". Função `progressoPratico` em `js/hub/dominio.js`.
- ✅ Dashboard: novo card **Prática** com concluídos por módulo (Missões, Campus, Empresa, Data Center) e link para o próximo item pendente (`resumoPratica`). Sem dados inventados: tudo vem do estado salvo e dos catálogos.
- ✅ Testes: unitários de `progressoPratico` e `resumoPratica`; e2e que conclui uma missão pela interface e confere dashboard, árvore e estado salvo.

### Quiz: níveis 4 a 13
- ✅ Nível 4 *Dentro do switch* (MAC, quadro Ethernet, aprendizado e inundação do switch, unicast/multicast/broadcast, full-duplex) e nível 5 *Endereço IPv4* (binário/decimal, máscara e prefixo, rede/host/broadcast, privado/público/loopback/link-local) e nível 13 *Bônus: segurança* (tipos de ameaça, phishing, firewall, CID, senhas e 2FA, resposta a infecção, regra 3-2-1, VPN, atualizações; é um bônus depois do chefão para não renumerar os níveis, já que o progresso salvo usa o número do nível), nível 12 *Chefão: diagnóstico* (método em 6 etapas, ferramentas ping/ipconfig/tracert/nslookup, sintoma → camada, bottom-up, loopback, isolar a falha, conflito de IP), nível 11 *Serviços* (função do DNS, etapas da consulta, cache, registros A/AAAA/MX/NS, protocolos de web, e-mail e arquivos, HTTP x HTTPS, SSH x Telnet, diagnóstico "ping no IP funciona e no nome não"; nova categoria `aplicacao` na trilha Serviços), nível 10 *TCP, UDP e portas* (TCP x UDP, three-way handshake, portas conhecidas, soquete, confiabilidade; nova categoria `transporte` na trilha Serviços), nível 9 *ARP e roteamento* (ARP e suas etapas, MAC do gateway ao sair da rede, TTL, tipos de rota, prefixo mais longo, host sem gateway, roteador sem rota), nível 8 *DHCP e NAT* (função e mensagens do DHCP/DORA, porta 67, concessão, NAT estático/dinâmico/PAT, o que é DHCP e o que é NAT), nível 7 *IPv6* (por que existe, formato e abreviação, tipos de endereço, ausência de broadcast, /64, estrutura do global unicast), nível 6 *Sub-redes* (bits de host, hosts úteis, máscara de um prefixo, em que sub-rede o host está, escolha do prefixo, quantidade de sub-redes, passos do VLSM, endereço de rede). 9 desafios cada, usando os 5 tipos de pergunta, em `data/questions.json` (gerados por `tools/gerar-niveis-4-5.mjs` e `tools/gerar-nivel-6.mjs` e `tools/gerar-nivel-7.mjs` e `tools/gerar-nivel-8.mjs` e `tools/gerar-nivel-9.mjs` e `tools/gerar-nivel-10.mjs` e `tools/gerar-nivel-11.mjs` e `tools/gerar-nivel-12.mjs` e `tools/gerar-nivel-13.mjs`, que não sobrescrevem).
- ✅ O quiz passa a ter 117 desafios jogáveis: **os 12 níveis do mapa original estão jogáveis**, mais o nível bônus 13. Cada nível só abre depois de ao menos 1 estrela no anterior.
- ✅ Testes: unitários (9 desafios por nível, sequência sem buracos, respostas numéricas conferidas; as contas dos níveis 5 e 6 são recalculadas com o motor IPv4) e e2e (`niveis-quiz`, que acompanha os níveis de `data/questions.json`: bloqueio em sequência, jogada perfeita pela interface, erro mostra explicação). A regressão contra a v0.1 continua passando (ALVO=legacy); a contagem de estrelas e de níveis "em breve" depende do alvo.
- Os geradores são sementes de uma vez só: depois de gerados, a fonte da verdade é `data/questions.json` (alguns textos de alternativas foram reequilibrados à mão para a resposta certa não ser sempre a mais longa; o teste de preservação 'a resposta certa não se destaca pelo tamanho' continua valendo).
- ⚠️ Conteúdo escrito por mim a partir do conteúdo do curso; **vale revisar** os enunciados contra o material do NetAcad antes de usar como material de estudo.

### Missões de prática
- ✅ 4 missões em que o jogador **monta** a rede (não só conserva): *Sua primeira rede local* (IPs de 3 PCs), *Duas redes, um roteador* (interfaces, sub-redes e gateways), *Setores separados por VLAN* e *Dois andares, as mesmas VLANs* (VLAN + trunk). Gerador: `tools/gerar-praticas.mjs` (idempotente, também ordena as missões por aprendizagem).
- ✅ Novo tipo de objetivo: **isolamento** (`esperado: "falha"`): passa só se o ping NÃO for entregue. As missões de VLAN foram desenhadas para que o isolamento só passe pelo motivo certo (mesma sub-rede, então só a VLAN separa; as comunicações que devem funcionar continuam exigidas).
- ✅ A árvore de habilidades passa a medir Prática de Fundamentos, IP, Ethernet e comutação e Roteamento (restam sem conteúdo prático: Serviços, Segurança e Troubleshooting).
- Testes: unitários (cada missão começa quebrada, as soluções passam e variações erradas não) e e2e pela interface (IPs, roteador, VLAN, trunk).
- 🧪 Continua sendo protótipo: a verificação é por ping (ida e volta); não avalia boas práticas (por exemplo, desperdício de endereços ou VLAN nativa).

### Rotas estáticas (protótipo)
- ✅ Motor: o roteador escolhe a rota pelo **prefixo mais longo**; rota conectada vence a estática de mesmo prefixo; a rota padrão é 0.0.0.0/0. O próximo salto precisa estar numa rede ligada diretamente (senão a rota é recusada). O pacote passa por vários roteadores, decrementando o TTL, e um laço de rotas termina em "TTL expirado". Funções: `adicionarRotaEstatica`, `removerRotaEstatica`, `normalizarTopologia` (descarta rotas inválidas ou duplicadas de dados salvos, máx. 16 por roteador) e `escolherRota`.
- ✅ Laboratório e missões: ao selecionar um roteador aparece o fieldset "Rotas estáticas" (tabela com Remover + rede, máscara e próximo salto; preencher os três campos e Aplicar). Três missões novas: *A rota que só vai* (diagnóstico: ida sem volta), *Rota padrão para a Internet* e *Rotas estáticas, passo a passo*. Gerador `tools/gerar-rotas.mjs` (idempotente). Agora são 10 missões na lista de Missões.
- ✅ Testes: `tests/unit/rotas.test.mjs` (8), três testes novos em `missoes.test.mjs` e um e2e pela interface (validação, ida, volta, remoção, conclusão).
- 🧪 Continua sem simular: roteamento dinâmico (RIP/OSPF), distância administrativa, rotas flutuantes, ECMP, subinterfaces, DHCP, NAT e ACLs. A mensagem de "inalcançável" é simplificada.

### DHCP simplificado (protótipo)
- ✅ Motor: o roteador ganha um **pool por interface** (`pools: [{ porta, inicio, fim }]`, dentro da sub-rede da interface, sem endereço de rede/broadcast, até 254) e o computador ganha o modo "obter endereço automaticamente" (`dhcp: true`). Ao criar a simulação, cada PC em DHCP recebe o primeiro endereço livre do pool de um roteador do **seu domínio de broadcast** (respeita VLANs), pulando o IP do roteador, IPs fixos do domínio e concessões já dadas. Máscara e gateway vêm da interface do roteador. Motivos de falha: sem cabo, sem servidor, pool inválido, pool esgotado. A topologia salva não é alterada: a concessão só existe na simulação (`sim.concessoes`, `sim.topologia`).
- ✅ Terminal: `ipconfig` e `ipconfig /all` mostram DHCP habilitado, servidor e o motivo de falha; `ipconfig /renew` mostra a concessão ou o porquê de ter falhado.
- ✅ Laboratório: caixa "Obter endereço automaticamente (DHCP)" no PC (campos fixos ficam desabilitados e guardados) e campos de pool em cada interface do roteador; o desenho e os avisos mostram o endereço recebido.
- ✅ Missões novas (agora 13): *Ninguém recebe endereço*, *O pool que acabou* (diagnóstico) e *DHCP para duas redes* (prática). Treinam a habilidade `servicos.*` (a árvore passa a medir Prática e Diagnóstico de Serviços). Gerador `tools/gerar-dhcp.mjs`. A verificação por ping passou a usar a topologia com as concessões.
- ✅ Testes: `tests/unit/dhcp.test.mjs` (9), três testes em `missoes.test.mjs` e um e2e pela interface.
- 🧪 Simplificações assumidas: **não há DORA mensagem a mensagem**, nem tempo de concessão (lease), nem renovação, `ipconfig /release`, opções (DNS), relay (ip helper-address) ou servidor DHCP em PC. A concessão é determinística pela ordem dos dispositivos, e roteadores não são clientes DHCP.

### Filtro de pacotes / ACL simplificada (protótipo)
- ✅ Motor: o roteador tem uma lista ordenada de regras `permitir`/`negar` com origem e destino (rede + máscara; vazio = qualquer). Ao **encaminhar** um pacote vale a primeira regra que casa; o roteador não filtra o que origina nem o que recebe para si. Novo estado de pacote: `bloqueado` (ping: "Comunicação proibida administrativamente"; tracert mostra o roteador que bloqueou). Funções: `adicionarFiltro`, `removerFiltro`, `moverFiltro` (a ordem decide), `filtroNega`; limite de 12 regras por roteador; normalização descarta regras inválidas.
- ✅ O filtro **não tem estado**: a resposta do ping também é filtrada com origem e destino trocados, então uma regra de um sentido só pode dar "timeout" (a ida passa e a volta é bloqueada). Isso é de propósito, para ensinar por que firewalls reais usam inspeção com estado.
- ✅ Laboratório: fieldset "Filtro de pacotes" no roteador (tabela com ↑ ↓ Remover e formulário de nova regra, com aviso na tela das simplificações).
- ✅ Missões novas (agora 16): *O convidado não acessa o servidor* (prática de Segurança), *A regra que nunca vale* (ordem das regras) e *A resposta que não volta* (filtro sem estado), as duas últimas de diagnóstico. A árvore passa a medir Prática e Diagnóstico de Segurança. Gerador `tools/gerar-filtros.mjs`; a ordem das missões vive em `tools/ordem-missoes.mjs`, compartilhada pelos geradores.
- ✅ Testes: `tests/unit/filtros.test.mjs` (7), três testes em `missoes.test.mjs` e um e2e pela interface.
- 🧪 **Diferença importante de uma ACL Cisco**: aqui o que não casa com nenhuma regra é **permitido** (na Cisco há um "negar tudo" implícito no fim). Também não há ACL por interface/sentido (in/out), portas/protocolos (TCP/UDP), ACL nomeada nem log. O aviso aparece na própria tela.

### Missões com vários defeitos (diagnóstico)
- ✅ *Filial fora do ar: três defeitos* (gateway errado, pool DHCP ausente e rota de volta faltando) e *Dois sites, quatro defeitos* (pool de um endereço para dois PCs, rota com próximo salto inexistente, filtro que bloqueia a volta e gateway errado no servidor). Agora são 18 missões. Gerador `tools/gerar-chefoes.mjs`.
- ✅ Teste unitário prova que **cada defeito importa**: com qualquer um deles sem corrigir a missão não conclui (todas as combinações de "todos menos um").
- Treinam várias habilidades ao mesmo tempo (Troubleshooting, Roteamento, Serviços e Segurança), então contam em mais de uma trilha da árvore.

### DNS simplificado (protótipo)
- ✅ Motor: o computador cliente ganha o campo "servidor DNS" (`dns`) e um computador pode ser **servidor DNS** ao receber registros A (`registros: [{ nome, ip }]`, até 12; nomes em minúsculas, com pontos, validados). `sim.resolver(origem, nome)`: o cliente precisa alcançar o servidor por ping (ida e volta), o computador que tem esse IP precisa ter registros e o nome precisa existir. Motivos: sem DNS configurado, servidor inalcançável, endereço que não é servidor DNS, nome inexistente.
- ✅ Terminal: `nslookup nome` (servidor, nome e endereço ou o motivo da falha), `ping` e `tracert` por nome (primeiro IP literal, depois o nome de um dispositivo do laboratório como atalho, e só então o DNS) e `ipconfig /all` mostra o servidor DNS.
- ✅ Missões: objetivos podem ser "X alcança o nome Y" (`nome` no lugar de `para`): resolve pelo DNS e dá ping no endereço obtido; o motivo da falha diz qual etapa quebrou. Três missões novas (agora 21): *Ping no IP funciona, no nome não*, *O nome aponta para o lugar errado* (diagnóstico) e *Monte o DNS da empresa* (prática). Gerador `tools/gerar-dns.mjs`.
- ✅ Laboratório: fieldset "DNS" no PC (servidor DNS + registros do próprio computador).
- ✅ Testes: `tests/unit/dns.test.mjs` (7), 4 testes em `missoes.test.mjs` e um e2e pela interface.
- 🧪 Simplificações assumidas: só registros A (sem AAAA/MX/CNAME), **sem cache, TTL, recursão, encaminhadores ou zonas**, um único servidor DNS por cliente, e o DHCP simplificado **não** entrega o servidor DNS (é configurado à mão). Só um computador pode ser servidor DNS (não há dispositivo "servidor").

### Revisão visual (capturas desktop e celular)
- 🔧 Texto do Laboratório dizia que o motor "não simula VLANs" (desatualizado desde o Campus); corrigido, com teste para não voltar.
- 🔧 Menu lateral: o selo "protótipo" encostava no nome ("Laboratório") e sobrepunha "Árvore de Habilidades"; o texto agora quebra dentro da própria coluna e o selo é menor.
- 🔧 Lista "Prática" do dashboard tinha recuo extra.
- 🔧 Painel do roteador (rotas estáticas e filtro de pacotes): as tabelas estouravam a largura (botão "Remover" cortado, colunas esmagadas no celular); agora cada rota/regra é um cartão de uma linha com os botões ao lado ou abaixo, sem rolagem horizontal.

### Auditoria de acessibilidade (axe-core)
- ✅ Rodei o axe-core (instalado **fora** do projeto, só para auditar; não é dependência) em 13 telas (dashboard, quiz, laboratório, missões, campus, empresa, data center, árvore, conquistas, perfil e três missões com dispositivo selecionado), em 1280 px e 390 px, com as regras padrão.
- 🔧 Único tipo de problema achado: **nome acessível que não contém o texto visível** (WCAG 2.5.3). Corrigido: os cartões de missão/projeto/data center passaram a usar o próprio texto como nome (sem `aria-label`); os nós do mapa do quiz e os dispositivos do laboratório começam pelo texto visível (por exemplo, "PC1 192.168.1.10, computador").
- ✅ Resultado final: 0 violações. Contraste: sem violações; os itens "incompletos" do axe são ícones sem texto e textos em SVG sobre retângulos sobrepostos (o axe não consegue calcular o fundo).
- 🧪 Não substitui um teste com leitor de tela de verdade nem uma auditoria manual completa.

### Problemas conhecidos (testes)
- O e2e "layout sem rolagem horizontal e sem nós sobrepostos" do mapa do quiz falhou **uma vez** em ~4 execuções completas sob carga e passa isolado e nas reexecuções; causa não identificada (suspeita de corrida do robô jogador). Não há falha reproduzível no app.

## Próximos passos
- Fases 7 e 8: expansão de conteúdo e recursos avançados (NAT, subinterfaces, roteamento dinâmico, DNS com cache/zonas, ACL por interface com portas) — ⏳. VLAN, rotas estáticas, DHCP, filtro de pacotes e DNS simplificado já foram feitos (ver Campus, Rotas estáticas, DHCP, Filtro de pacotes e DNS).
- Quiz: os 12 níveis originais estão completos (9 desafios cada). Todas as 8 trilhas têm teoria. Faltam, para a Fase 7: mais desafios por nível/dificuldade, desafios cronometrados e conteúdo de Prática/Diagnóstico para Fundamentos, IP e Serviços.
