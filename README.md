# Network Command

Plataforma gamificada para aprender redes de computadores, feita em **JavaScript puro** (HTML, CSS e ES modules; sem frameworks e sem dependências em produção).
Projeto de portfólio de Leonardo Facin, baseado nos tópicos do curso *Conceitos Básicos de Redes* (Cisco Networking Academy).
É um projeto independente de estudo: **não é afiliado à Cisco e não emite certificado oficial**.

## O que tem

| Módulo | O que faz | Estado |
|---|---|---|
| Conhecimento | Quiz em 12 níveis (108 desafios, 5 tipos de pergunta), XP, estrelas, revisão de erros | pronto |
| Laboratório | Editor visual de rede, IPv4, VLANs, terminal (ping, ipconfig…) sobre um motor de simulação próprio | protótipo |
| Missões e Campus | Defeitos de rede para diagnosticar e corrigir, verificados por ping | protótipo |
| Empresa | Planejamento de sub-redes (VLSM), portas e orçamento | protótipo |
| Data Center | Disponibilidade em série e paralelo, custo e portas | protótipo |
| Habilidades, Conquistas, Perfil | Progressão única (XP, nível, árvore, conquistas) salva no navegador | pronto |

"Protótipo" quer dizer que as regras são reais e testadas, mas o escopo é simplificado (os limites estão em [docs/REGISTRO.md](docs/REGISTRO.md)). Nada é gravado fora do navegador (localStorage) e não há senhas nem dados pessoais.

## Como rodar

O projeto usa módulos ES e arquivos JSON, então precisa de um servidor HTTP (abrir o `index.html` direto do disco não funciona):

```bash
npm run serve      # http://localhost:5173
```

Também funciona com a extensão Live Server do VS Code ou com GitHub Pages.

## Testes

```bash
npm install                     # só instala o playwright-core (testes no navegador)
npm run test:unit               # regras puras e motor de simulação: pontuação, estado salvo, IPv4, ARP, ping, missões
CHROME_PATH=/caminho/do/chrome npm run test:e2e   # navegador real: um robô joga pela interface
ALVO=legacy npm run test:e2e    # mesmos testes contra a v0.1 congelada (legacy/)
```

## Estrutura

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md). O que já funciona e o que falta: [docs/REGISTRO.md](docs/REGISTRO.md).
