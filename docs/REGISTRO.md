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
- ✅ Menu honesto: Laboratório, Empresa, Data Center, Campus de Redes e Missões mostram o selo "em dev." e uma página que diz que o módulo ainda não existe. Árvore de Habilidades está marcada como protótipo.
- ✅ Dashboard: progressão (cargo, XP, nível do jogador, 300 XP por nível), continuar de onde parou, domínio por trilha, pontos de atenção, atividade recente, conquistas. Tudo calculado do estado real; estados vazios são explícitos.
- ✅ Quiz ampliado: histórico de respostas (últimas 300), revisão de erros (não dá XP), desempenho por assunto.
- ✅ Conquistas: 9, cada uma é uma regra verificável (ver `js/hub/conquistas-regras.js`), concedidas na mudança de estado, com aviso na tela.
- ✅ Perfil: nome de exibição validado, backup (exportar/importar com validação) e zerar progresso com confirmação em duas etapas.
- 🧪 Árvore de habilidades: 8 trilhas × 3 níveis de domínio. Só a Teoria de Fundamentos é medida; Prática e Diagnóstico aparecem trancados até existir o laboratório.
- ✅ Estado salvo v3 (migra v1 e v2). Validação descarta registros inválidos.
- ✅ Contraste de texto WCAG AA verificado por teste em todas as páginas (1280 e 390 px).

### Pendências conhecidas da Fase 2
- Desafios cronometrados e missões teóricas (listados no prompt) ainda não foram feitos.
- Só as categorias Fundamentos e OSI/TCP-IP têm perguntas (27 no total); as outras 14 categorias aguardam conteúdo.
- Créditos (moeda do jogo) ficam para a Fase 6, quando a infraestrutura existir.
