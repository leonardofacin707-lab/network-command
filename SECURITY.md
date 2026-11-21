# Segurança

## Como o jogo protege os jogadores

- **Sem coleta de dados:** não há cadastro, login, senha, e-mail, servidor de jogo nem banco de dados. O progresso fica no `localStorage` do navegador de cada jogador.
- **Nada de terceiros:** fontes, scripts e dados são servidos pelo próprio site. Sem anúncios, rastreadores ou análise de terceiros.
- **Política de segurança de conteúdo (CSP)** na versão publicada: só scripts do próprio site; scripts embutidos no HTML são proibidos.
- **Entradas validadas:** o nome de exibição só aceita letras, números, espaço e `. _ ' -`; o backup importado tem limite de 1 MB e passa por normalização (campos desconhecidos e valores inválidos são descartados). Todo texto exibido é escapado. Um teste automático tenta injetar código pelo nome e por um backup e confere que nada é executado.
- **Sem dependências no navegador:** o jogo é JavaScript puro; as ferramentas de teste não vão para o site.

## Manutenção

- Ações do GitHub fixadas pelo hash do commit, com permissões mínimas e sem guardar credenciais no checkout.
- CodeQL (consultas de segurança estendidas) a cada mudança e toda semana; OpenSSF Scorecard semanal, com selo no README.
- Branch `main` protegida contra envio forçado e exclusão; varredura de segredos do GitHub com bloqueio no envio.

- Cada envio ao GitHub roda os testes, `npm audit` e a varredura de segredos (gitleaks). A publicação só acontece se tudo passar.
- O Dependabot avisa sobre atualizações.
- O formato do progresso salvo tem número de versão: mudanças de formato precisam de conversão, para não apagar o progresso de ninguém.

## Como relatar uma vulnerabilidade

Use o relato privado do GitHub: **https://github.com/leonardofacin707-lab/network-command/security/advisories/new** (só o mantenedor vê). Não abra issue pública para falhas de segurança e não inclua dados pessoais.

- Resposta inicial: até 7 dias.
- Correção: priorizada conforme a gravidade; o relato é creditado, se você quiser, quando a correção for publicada.

## Versões com suporte

Só a versão publicada no GitHub Pages (a branch `main`) recebe correções.
