# Arquitetura

Regra central: **interface, regras de negócio e (futuramente) motor de simulação ficam separados.**

```
index.html            casca da página (cabeçalho, #app, rodapé) e fallback para file://
css/global.css        tema, tipografia, faixas, painéis, botões
css/quiz.css          estilos do módulo Conhecimento
data/                 conteúdo em JSON: questions, levels, categories, skills
js/main.js            ponto de entrada: carrega dados e estado, liga a persistência
js/core/              ui (utilitários DOM), store (estado), storage (localStorage v2), progression (XP/cargo)
js/quiz/              catalog, scoring, unlock (regras puras), map, session, resultado, hud, types/ (5 tipos)
legacy/               v0.1 congelada (Jornada do Pacote), referência de regressão. Não editar.
tools/                extrair-legado.mjs e converter-legado.mjs (geraram data/ a partir da v0.1)
tests/unit            regras puras (node --test)
tests/e2e             navegador real (playwright-core) + robô jogador
```

## Decisões

- **Estado**: `store` imutável com `ouvir/alterar`; `main.js` liga `store.ouvir(salvar)`. Módulos não escrevem no localStorage.
- **Armazenamento**: chave `network-command`, formato `{versao:2, perfil, quiz:{melhor}}`. Lê o formato da v0.1 (`jornada-do-pacote-v1`) e migra sem apagar. Todo dado lido é validado e entradas inválidas são descartadas. Nada de senhas ou dados pessoais além do nome de exibição.
- **Dados**: cada pergunta tem id, categoria, assunto, dificuldade, habilidade (`trilha.nível`), enunciado, carga do tipo e explicação.
- **Tipos de desafio**: cada arquivo em `js/quiz/types/` exporta `rotulo`, `renderizar` e `clique` (e `enviar` para número). Para criar um tipo novo basta adicionar o arquivo e registrá-lo em `session.js`.
- **Testes como rede de segurança**: o robô jogador resolve os desafios pela interface a partir de `tests/fixtures/legado.json` (conteúdo original), então valem para a v0.1 e para a versão atual.
