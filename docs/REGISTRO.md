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
- ✅ Conquistas: 9 na Fase 2 (11 depois da Fase 5), cada uma é uma regra verificável (ver `js/hub/conquistas-regras.js`), concedidas na mudança de estado, com aviso na tela.
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
- 🧪 **Não simulado**: latência e perda aleatória, VLANs, rotas estáticas/dinâmicas, DHCP, NAT, firewall, DNS. Mensagens de "inacessível" de roteadores são simplificadas.
- ✅ 60+ testes unitários do motor e 10 e2e do laboratório.

## Fase 5 — Missões de troubleshooting 🧪

- ✅ 5 missões (cabo esquecido, IP duplicado, máscara errada, gateway errado, interface do roteador sem IP). Cada uma começa quebrada (teste garante) e tem uma correção testada.
- ✅ Verificação pelo motor: objetivo cumprido só se o ping de ida e volta funcionar. Motivo da falha mostrado sem entregar a solução.
- ✅ Dicas progressivas (cada uma tira 20% do XP, piso 40%), reiniciar cenário (com confirmação), progresso por missão salvo, XP pago uma única vez.
- ✅ XP de missões soma no HUD, dashboard, perfil, cargo e conquistas. Novas conquistas: *Primeiro chamado* e *Rede sem defeitos*.
- 🧪 Marcado como protótipo: só 5 missões, todas de camada 1–3 com topologias pequenas; não há missões cronometradas nem cenários com múltiplos defeitos.
- Correção de UI descoberta pelos testes: a aba "Revisão de erros" ficava destacada depois de voltar ao mapa.

## Próximos passos
- Fase 6: Empresa / Data Center / Campus (orçamento, créditos, infraestrutura) — ainda **não iniciada** (⏳).
- Fases 7 e 8: expansão de conteúdo e recursos avançados (VLAN, rotas estáticas, DHCP, NAT) — ⏳.
- Mais perguntas para as 14 categorias vazias e desafios cronometrados.
