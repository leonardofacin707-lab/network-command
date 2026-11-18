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
