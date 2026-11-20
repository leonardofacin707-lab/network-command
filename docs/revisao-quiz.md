# Revisão do quiz contra o curso

Gerado por `tools/marcar-modulos.mjs`. Os desafios foram escritos para o jogo (não são cópia do curso) e o módulo foi atribuído pelas notas de `docs/mapa-curso.md`. Ao estudar cada módulo no NetAcad, confira a resposta e a explicação e marque a caixa. Encontrou algo errado? Anote o id do desafio.

"Bônus" = assunto que vai além do curso Conceitos Básicos de Redes.

## Módulo 1 — Comunicação em um mundo conectado (6)

- [ ] `fundamentos-001` **Quem é o dono da Internet?**
  - Resposta: Ninguém: ela é um conjunto de redes interligadas que seguem padrões comuns
  - Explicação: A Internet é uma "rede de redes". Milhares de redes independentes cooperam porque seguem os mesmos padrões, e nenhuma pessoa ou empresa controla tudo.
- [ ] `fundamentos-002` **Que tipo de rede é cada caso?**
  - Resposta: Notebook e celulares de uma família ligados ao roteador de casa → Doméstica pequena; Escritório em casa que acessa a rede da empresa → SOHO; Universidade com milhares de hosts em vários campi → Média ou grande; Bilhões de dispositivos interligados no planeta → Mundial
  - Explicação: SOHO significa pequeno escritório ou escritório doméstico. Redes médias e grandes têm muitos locais e centenas ou milhares de hosts. A Internet é a rede mundial.
- [ ] `fundamentos-003` **Quantos Mbps existem em 1 Gbps?**
  - Resposta: 1000 Mbps
  - Explicação: 1 Gbps = 1.000 Mbps = 1.000.000 Kbps = 1.000.000.000 bps. Em redes, os prefixos de velocidade usam potências de 10.
- [ ] `fundamentos-004` **Seu plano de internet é de 300 Mbps, mas o teste de velocidade mostra 210 Mbps. Esses 210 Mbps são a…**
  - Resposta: Taxa de transferência (throughput)
  - Explicação: Largura de banda é a capacidade teórica do meio. A taxa de transferência é o que realmente passa, e cai por causa do volume de dados, do tipo de tráfego e da latência no caminho.
- [ ] `fundamentos-005` **Como se chama o tempo que os dados levam para ir de um ponto a outro da rede?**
  - Resposta: Latência
  - Explicação: Latência é o atraso da viagem. Quanto mais dispositivos e distância entre origem e destino, maior tende a ser a latência.
- [ ] `fundamentos-007` **Classifique cada dado pessoal.**
  - Resposta: Foto que você postou na rede social → Voluntário; Histórico de localização do celular → Observado; Score de crédito calculado a partir dos seus hábitos → Inferido; Seu perfil com nome e cidade → Voluntário; Lista de páginas que você visitou → Observado
  - Explicação: Dados voluntários você cria e compartilha. Dados observados são registrados a partir do que você faz. Dados inferidos são conclusões tiradas analisando os outros dados.

## Módulo 2 — Componentes, tipos e conexões de rede (4)

- [ ] `fundamentos-010` **Separe os componentes da infraestrutura de rede.**
  - Resposta: Notebook → Dispositivo final; Impressora de rede → Dispositivo final; Câmera de segurança IP → Dispositivo final; Switch → Dispositivo intermediário; Roteador → Dispositivo intermediário; Access point sem fio → Dispositivo intermediário; Cabo de par trançado → Meio físico; Ondas de rádio do Wi-Fi → Meio físico
  - Explicação: O dispositivo final (host) é a origem ou o destino da mensagem. Os intermediários conectam e encaminham o tráfego. O meio físico é o caminho por onde o sinal viaja: cobre, fibra ou ar.
- [ ] `fundamentos-011` **O que define se um computador é cliente ou servidor?**
  - Resposta: O software instalado nele
  - Explicação: Um host vira servidor quando roda software de servidor (web, e-mail, arquivos). O mesmo computador pode ser cliente e servidor ao mesmo tempo.
- [ ] `fundamentos-012` **Qual é uma DESVANTAGEM da rede ponto a ponto (P2P)?**
  - Resposta: Não tem administração centralizada e é menos segura
  - Explicação: A P2P é barata e simples, mas não escala bem, não tem gestão central, é menos segura e o desempenho cai quando todos são cliente e servidor ao mesmo tempo.
- [ ] `fundamentos-017` **Ligue cada tipo de conexão com o provedor (ISP) à característica dela.**
  - Resposta: Cabo = Usa o mesmo coaxial da TV a cabo; DSL = Usa a linha telefônica; Satélite = Precisa de visada livre até o céu; Celular = Usa as torres da operadora; Discada = Barata, mas com banda muito pequena
  - Explicação: A escolha depende do lugar onde você está e dos provedores disponíveis. Em áreas sem cabo ou DSL, satélite e celular resolvem. Nas cidades, a fibra até a casa é cada vez mais comum.

## Módulo 3 — Redes sem fio e móveis (4)

- [ ] `fundamentos-006` **Ligue cada tecnologia sem fio à situação em que ela é usada.**
  - Resposta: Bluetooth = Fone sem fio conectado ao celular; NFC = Pagar encostando o celular na maquininha; GPS = Descobrir sua posição por satélite; Wi-Fi = Acessar a internet pelo roteador de casa; Dados móveis (4G/5G) = Navegar na rua, longe de qualquer roteador
  - Explicação: Bluetooth é de curto alcance e baixo consumo. O NFC exige que os aparelhos fiquem quase encostados. O GPS só recebe sinais de satélites. O Wi-Fi depende de um access point por perto, e os dados móveis usam as torres da operadora.
- [ ] `fundamentos-008` **Você quer conectar o celular a uma rede Wi-Fi que não aparece na lista. Qual é o motivo mais provável?**
  - Resposta: O broadcast do SSID está desativado, então é preciso adicionar a rede manualmente
  - Explicação: Com o SSID oculto, a rede não aparece na lista. Você adiciona manualmente digitando o SSID, o tipo de segurança e a senha exatamente como estão no roteador.
- [ ] `fundamentos-009` **No Wi-Fi público de uma lanchonete, qual atitude é a mais segura?**
  - Resposta: Usar uma VPN e nunca enviar senhas sem criptografia
  - Explicação: Em redes que você não controla, alguém pode capturar o tráfego. A VPN cria um túnel criptografado, e login ou senha nunca devem trafegar em texto puro.
- [ ] `seguranca-008` **O que uma VPN faz?**
  - Resposta: Cria um túnel criptografado entre o dispositivo e outra rede
  - Explicação: A VPN (rede privada virtual) protege os dados em trânsito com criptografia, o que é útil em redes públicas ou para acessar a rede da empresa. Ela não aumenta a velocidade nem substitui um antivírus.

## Módulo 4 — Construindo uma rede doméstica (3)

- [ ] `fundamentos-013` **Ligue cada equipamento à parte certa do roteador doméstico.**
  - Resposta: Modem do provedor = Porta Internet (WAN); PC de mesa com cabo = Porta LAN (switch interno); Celular = Access point sem fio interno
  - Explicação: A porta Internet liga o roteador a outra rede, a do provedor. As portas LAN e o Wi-Fi ficam na mesma rede local da casa.
- [ ] `fundamentos-014` **Os aparelhos ligados nas portas LAN e os conectados ao Wi-Fi do mesmo roteador estão…**
  - Resposta: Na mesma rede local; só a porta Internet fica em outra rede
  - Explicação: Por padrão, o roteador doméstico junta portas LAN e Wi-Fi na mesma LAN. A porta Internet é a única que fica em outra rede.
- [ ] `fundamentos-016` **O fone Bluetooth está atrapalhando o Wi-Fi do notebook. Para qual faixa vale mudar o Wi-Fi?**
  - Resposta: 5 GHz, porque o Bluetooth usa 2,4 GHz
  - Explicação: Wi-Fi doméstico usa as faixas não licenciadas de 2,4 GHz e 5 GHz. O Bluetooth divide a faixa de 2,4 GHz, então os 5 GHz evitam essa disputa.

## Módulo 5 — Princípios de comunicação (9)

- [ ] `osi-tcpip-001` **Em redes, um protocolo é…**
  - Resposta: Um conjunto de regras que emissor e receptor seguem para se entender
  - Explicação: Assim como uma conversa precisa de idioma, ritmo e confirmação, os computadores precisam de regras comuns: formato, tamanho, temporização, codificação e forma de entrega.
- [ ] `osi-tcpip-002` **Ligue cada característica de protocolo ao que ela define.**
  - Resposta: Formato = A estrutura que a mensagem precisa seguir; Tamanho = Mensagens longas são divididas em partes menores; Temporização = A velocidade e o momento em que cada host pode transmitir; Codificação = Como a informação vira sinais no meio físico
  - Explicação: Essas regras garantem que a mensagem chegue e seja entendida. A temporização, por exemplo, evita que todos transmitam ao mesmo tempo.
- [ ] `osi-tcpip-003` **Monte o modelo OSI, da camada 7 (topo) até a camada 1.**
  - Resposta: Aplicação → Apresentação → Sessão → Transporte → Rede → Enlace de dados → Física
  - Explicação: Do topo para a base: 7 Aplicação, 6 Apresentação, 5 Sessão, 4 Transporte, 3 Rede, 2 Enlace de dados, 1 Física.
- [ ] `osi-tcpip-004` **Agora o modelo TCP/IP, do topo para a base.**
  - Resposta: Aplicação → Transporte → Internet → Acesso à rede
  - Explicação: O TCP/IP tem 4 camadas. É o modelo de protocolos que a Internet usa de verdade.
- [ ] `osi-tcpip-005` **Em qual camada do TCP/IP cai cada camada do OSI?**
  - Resposta: OSI 7 · Aplicação → Aplicação; OSI 6 · Apresentação → Aplicação; OSI 5 · Sessão → Aplicação; OSI 4 · Transporte → Transporte; OSI 3 · Rede → Internet; OSI 2 · Enlace de dados → Acesso à rede; OSI 1 · Física → Acesso à rede
  - Explicação: As camadas 5, 6 e 7 do OSI viram a Aplicação do TCP/IP. Transporte e Rede (Internet) batem direto. Enlace e Física juntas formam o Acesso à rede.
- [ ] `osi-tcpip-006` **Ligue cada função à camada OSI responsável por ela.**
  - Resposta: Escolhe o melhor caminho usando endereços IP = 3 · Rede; Troca quadros entre dispositivos no mesmo meio = 2 · Enlace de dados; Segmenta, transfere e remonta os dados = 4 · Transporte; Transmite bits como sinais elétricos, luz ou rádio = 1 · Física; Dá uma representação comum aos dados = 6 · Apresentação
  - Explicação: Uma dica para lembrar: a camada 3 trabalha com IP (pacotes), a 2 com MAC (quadros), a 4 com portas (segmentos) e a 1 com bits.
- [ ] `osi-tcpip-007` **Onde fica registrada a evolução de um padrão da Internet?**
  - Resposta: Em documentos numerados chamados RFC (Request for Comments)
  - Explicação: Cada proposta de padrão passa por discussão e testes, e tudo fica registrado em RFCs numeradas, mantidas por organizações como a IETF.
- [ ] `osi-tcpip-008` **Qual é uma vantagem de usar um modelo em camadas?**
  - Resposta: Mudar uma camada não obriga a mudar as outras
  - Explicação: As camadas separam responsabilidades. Isso facilita projetar protocolos, permite que produtos de fabricantes diferentes funcionem juntos e cria uma linguagem comum para descrever a rede.
- [ ] `osi-tcpip-009` **Por que um celular de uma marca consegue abrir um site hospedado no servidor de outra marca?**
  - Resposta: Porque ambos seguem os mesmos padrões abertos de protocolo
  - Explicação: Padrões abertos garantem que qualquer dispositivo que implemente as mesmas regras consiga se comunicar, não importa o fabricante.

## Módulo 6 — Mídia de rede (2)

- [ ] `fundamentos-015` **Ligue cada cabo ao uso mais comum dele.**
  - Resposta: Par trançado Cat5e = Ligar o PC ao switch na rede local; Coaxial = Levar internet e TV a cabo até o modem; Fibra óptica = Longas distâncias em alta velocidade, sem interferência elétrica
  - Explicação: O par trançado (4 pares trançados contra interferência) é o mais comum nas LANs. O coaxial vem das operadoras de TV a cabo. A fibra usa pulsos de luz e alcança grandes distâncias.
- [ ] `fundamentos-018` **Qual destes NÃO é um critério para escolher o meio físico da rede?**
  - Resposta: A cor da capa do cabo
  - Explicação: Os critérios são distância, ambiente, quantidade e velocidade dos dados, e custo. A cor da capa só ajuda na organização.

## Módulo 7 — A camada de acesso (7)

- [ ] `ethernet-001` **O que o switch usa para decidir por qual porta enviar um quadro?**
  - Resposta: O endereço MAC de destino, consultado na tabela de endereços MAC
  - Explicação: O switch trabalha na camada 2. Ele lê o MAC de destino do quadro e procura esse endereço na sua tabela de endereços MAC, que diz em qual porta o destinatário está.
- [ ] `ethernet-002` **Quantos bits tem um endereço MAC?**
  - Resposta: 48 bits
  - Explicação: Um endereço MAC tem 48 bits (6 bytes), escritos em 12 dígitos hexadecimais, como 00:1A:2B:3C:4D:5E.
- [ ] `ethernet-003` **Monte o quadro Ethernet na ordem em que os campos são transmitidos, do primeiro ao último.**
  - Resposta: Preâmbulo → MAC de destino → MAC de origem → Tipo → Dados → FCS
  - Explicação: O quadro começa com o preâmbulo (sincronização), depois vêm o MAC de destino, o MAC de origem, o campo Tipo (qual protocolo está nos dados), os dados e, no fim, o FCS, que serve para detectar erros.
- [ ] `ethernet-005` **Um quadro chega a uma porta do switch com um MAC de origem ainda desconhecido. O que o switch faz?**
  - Resposta: Associa esse MAC à porta em que o quadro entrou
  - Explicação: O switch aprende olhando o MAC de origem: guarda na tabela que aquele endereço está na porta por onde o quadro chegou. Ninguém precisa cadastrar nada.
- [ ] `ethernet-006` **O que o switch faz em cada situação?**
  - Resposta: Unicast cujo destino está na tabela, em outra porta → Encaminha só pela porta do destino; Unicast cujo destino ainda não está na tabela → Inunda por todas as outras portas; Broadcast (FF:FF:FF:FF:FF:FF) → Inunda por todas as outras portas; Unicast cujo destino está na mesma porta por onde o quadro entrou → Filtra (não encaminha)
  - Explicação: Com o destino conhecido em outra porta, o switch encaminha só por ela. Destino desconhecido e broadcast são inundados por todas as portas, menos a de entrada. Se o destino está na própria porta de entrada, não há por que encaminhar.
- [ ] `ethernet-008` **Qual é a vantagem de uma porta de switch operar em full-duplex?**
  - Resposta: Enviar e receber ao mesmo tempo, sem colisões
  - Explicação: No full-duplex cada sentido tem seu próprio caminho. Por isso o dispositivo transmite e recebe ao mesmo tempo, e as colisões deixam de existir nesse enlace.
- [ ] `ethernet-009` **Qual destes é um endereço MAC válido?**
  - Resposta: 00:1A:2B:3C:4D:5E
  - Explicação: Um MAC tem 6 bytes em hexadecimal. O segundo tem só 5 bytes, o terceiro usa a letra G (fora do hexadecimal 0 a F) e o último é um endereço IPv4.

## Módulo 8 — Protocolo IP (6)

- [ ] `ipv4-001` **Quantos bits tem um endereço IPv4?**
  - Resposta: 32 bits
  - Explicação: Um endereço IPv4 tem 32 bits, divididos em 4 octetos de 8 bits e escritos em decimal separados por pontos, como 192.168.1.10.
- [ ] `ipv4-002` **Quanto vale o octeto 11000000 em decimal?**
  - Resposta: 192
  - Explicação: Os pesos dos bits, da esquerda para a direita, são 128, 64, 32, 16, 8, 4, 2 e 1. Em 11000000 só os dois primeiros bits valem 1: 128 + 64 = 192.
- [ ] `ipv4-004` **Ligue cada máscara de sub-rede ao seu prefixo.**
  - Resposta: 255.0.0.0 = /8; 255.255.0.0 = /16; 255.255.255.0 = /24; 255.255.255.128 = /25
  - Explicação: O prefixo conta quantos bits 1 a máscara tem, da esquerda para a direita. 255.255.255.128 tem 24 bits 1 nos três primeiros octetos mais 1 bit no último, ou seja, /25.
- [ ] `ipv4-005` **Para que serve a máscara de sub-rede?**
  - Resposta: Separar a parte de rede e a parte de host do endereço IP
  - Explicação: Os bits 1 da máscara marcam a parte de rede do endereço, e os bits 0 marcam a parte de host. É assim que o dispositivo descobre se o destino está na sua rede ou fora dela.
- [ ] `ipv4-007` **Ordene os prefixos da rede que comporta MENOS hosts para a que comporta MAIS.**
  - Resposta: /30 → /27 → /24 → /16
  - Explicação: Quanto maior o prefixo, menos bits sobram para hosts. Uma /30 tem 2 hosts úteis, uma /27 tem 30, uma /24 tem 254 e uma /16 tem 65.534.
- [ ] `ipv4-009` **Qual destes hosts está na mesma rede que 192.168.1.10 com máscara 255.255.255.0?**
  - Resposta: 192.168.1.200
  - Explicação: Com a máscara /24, os três primeiros octetos definem a rede. Só 192.168.1.200 tem a rede 192.168.1.0. Os outros ficam em redes diferentes e precisariam de um roteador para conversar.

## Módulo 9 — IPv4 e segmentação de rede (13)

- [ ] `ethernet-007` **Ligue cada tipo de comunicação ao seu alcance.**
  - Resposta: Unicast = Um único destinatário; Multicast = Um grupo de destinatários; Broadcast = Todos os dispositivos da rede local
  - Explicação: Unicast é de um para um. Multicast é de um para um grupo que se inscreveu. Broadcast é de um para todos os dispositivos da mesma rede local.
- [ ] `ipv4-003` **Classifique cada endereço IPv4.**
  - Resposta: 10.20.30.40 → Privado; 172.16.5.9 → Privado; 192.168.1.10 → Privado; 172.32.0.1 → Público; 8.8.8.8 → Público; 127.0.0.1 → Especial (loopback ou link-local); 169.254.10.5 → Especial (loopback ou link-local)
  - Explicação: Os blocos privados são 10.0.0.0/8, 172.16.0.0 a 172.31.255.255 e 192.168.0.0/16. Por isso 172.32.0.1 já é público. 127.0.0.0/8 é loopback (o próprio equipamento) e 169.254.0.0/16 é link-local, usado quando o host não recebeu endereço.
- [ ] `ipv4-006` **Um computador aparece com o endereço 169.254.37.8. O que isso indica?**
  - Resposta: Ele não recebeu endereço de um servidor DHCP e se autoatribuiu um
  - Explicação: O bloco 169.254.0.0/16 é de endereços link-local (APIPA). O sistema se atribui um deles quando não consegue obter um endereço do DHCP. Costuma indicar falha ao pedir endereço.
- [ ] `ipv4-008` **Qual é o endereço de broadcast da rede 192.168.10.0/24?**
  - Resposta: 192.168.10.255
  - Explicação: Com /24, os 8 últimos bits são de host. O broadcast é o endereço com todos esses bits em 1, ou seja, 192.168.10.255. O .254 é o último host utilizável, e o .1 é só um host.
- [ ] `subnetting-001` **Quantos bits de host sobram em uma rede /27?**
  - Resposta: 5 bits
  - Explicação: Bits de host = 32 − prefixo. Em uma /27 sobram 32 − 27 = 5 bits para identificar os hosts.
- [ ] `subnetting-002` **Quantos hosts úteis cabem em uma rede /26?**
  - Resposta: 62 hosts
  - Explicação: Em uma /26 sobram 6 bits de host: 2^6 = 64 endereços. Dois não podem ser usados por hosts (o de rede e o de broadcast), então sobram 62.
- [ ] `subnetting-003` **Qual é a máscara de sub-rede de uma rede /26?**
  - Resposta: 255.255.255.192
  - Explicação: Uma /26 tem 24 bits 1 nos três primeiros octetos mais 2 bits 1 no último: 11000000 = 192. A máscara é 255.255.255.192.
- [ ] `subnetting-004` **Ligue cada prefixo à quantidade de hosts úteis.**
  - Resposta: /30 = 2 hosts; /29 = 6 hosts; /28 = 14 hosts; /27 = 30 hosts
  - Explicação: Hosts úteis = 2^(bits de host) − 2. Uma /30 tem 2 bits de host (2 hosts), /29 tem 3 (6), /28 tem 4 (14) e /27 tem 5 (30).
- [ ] `subnetting-005` **Dividindo 192.168.1.0/24 em quatro redes /26, em qual delas está cada host?**
  - Resposta: 192.168.1.10 → 192.168.1.0/26; 192.168.1.45 → 192.168.1.0/26; 192.168.1.70 → 192.168.1.64/26; 192.168.1.100 → 192.168.1.64/26; 192.168.1.130 → 192.168.1.128/26; 192.168.1.200 → 192.168.1.192/26
  - Explicação: Cada /26 tem 64 endereços, então as redes começam em .0, .64, .128 e .192. Cada host pertence à rede cujo bloco o contém.
- [ ] `subnetting-006` **Um setor precisa de 50 hosts. Qual é o menor bloco que serve, sem desperdiçar endereços à toa?**
  - Resposta: /26, com 62 hosts úteis
  - Explicação: Precisamos de 50 hosts úteis. Uma /27 só tem 30, então não serve. A /26 tem 62 e é a menor que comporta os 50. A /25 e a /24 funcionam, mas desperdiçam endereços.
- [ ] `subnetting-007` **Quantas sub-redes /27 cabem dentro de uma rede /24?**
  - Resposta: 8 sub-redes
  - Explicação: De /24 para /27 foram emprestados 3 bits, e 2^3 = 8. Cada sub-rede tem 32 endereços, e 8 × 32 = 256.
- [ ] `subnetting-009` **Qual é o endereço de rede do host 172.16.45.200/20?**
  - Resposta: 172.16.32.0
  - Explicação: Uma /20 tem máscara 255.255.240.0, e o terceiro octeto avança de 16 em 16 (0, 16, 32, 48…). O valor 45 está no bloco que começa em 32, então a rede é 172.16.32.0.
- [ ] `troubleshooting-006` **O ping para 127.0.0.1 funciona. O que isso comprova?**
  - Resposta: A pilha TCP/IP do próprio computador está funcionando
  - Explicação: O endereço 127.0.0.1 é o loopback: o pacote nem sai da placa de rede. Funcionar comprova apenas o TCP/IP do computador. Cabo, switch, gateway e DNS precisam ser testados à parte.

## Módulo 10 — Formato e regras de endereçamento IPv6 (6)

- [ ] `ipv6-001` **Quantos bits tem um endereço IPv6?**
  - Resposta: 128 bits
  - Explicação: Um endereço IPv6 tem 128 bits, escritos como 8 grupos de 16 bits em hexadecimal. O IPv4 tem 32 bits, por isso o espaço de endereços do IPv6 é incomparavelmente maior.
- [ ] `ipv6-002` **Qual é a principal razão para a criação do IPv6?**
  - Resposta: Os endereços IPv4 estão acabando, e o IPv6 oferece um espaço bem maior
  - Explicação: O espaço de 32 bits do IPv4 não comporta tantos dispositivos. O IPv6 usa 128 bits, o que permite dar endereços a praticamente qualquer dispositivo, além de simplificar alguns processos de rede.
- [ ] `ipv6-003` **Como um endereço IPv6 completo é escrito?**
  - Resposta: Oito grupos de quatro dígitos hexadecimais separados por dois-pontos
  - Explicação: Um endereço IPv6 tem 8 grupos de 16 bits (4 dígitos hexadecimais cada), como 2001:0db8:acad:0001:0000:0000:0000:0010. Os quatro números decimais são o formato do IPv4, e os seis pares são o do endereço MAC.
- [ ] `ipv6-004` **Qual é a forma abreviada correta de 2001:0db8:0000:0000:0000:0000:0000:0001?**
  - Resposta: 2001:db8::1
  - Explicação: Zeros à esquerda de cada grupo podem ser omitidos, e uma sequência de grupos só de zeros pode virar "::", mas uma única vez no endereço. Por isso a forma correta é 2001:db8::1.
- [ ] `ipv6-005` **Que tipo de endereço IPv6 é cada um destes?**
  - Resposta: 2001:db8:acad:1::10 → Global unicast; fe80::a00:27ff:fe4e:66a1 → Link-local; fe80::1 → Link-local; ff02::1 → Multicast; ff02::2 → Multicast; ::1 → Loopback
  - Explicação: Global unicast começa com 2000::/3 (o 2001 do exemplo está nele). Link-local começa com fe80::/10 e só vale no enlace local. Multicast começa com ff00::/8. ::1 é o loopback, equivalente ao 127.0.0.1 do IPv4.
- [ ] `ipv6-006` **O que o IPv6 usa no lugar do broadcast do IPv4?**
  - Resposta: Multicast (e também anycast), sem broadcast
  - Explicação: O IPv6 não tem broadcast. Para falar com vários destinos usa multicast, e o anycast entrega ao destino mais próximo de um grupo. Funções que no IPv4 usavam broadcast passam a usar endereços multicast, como o ff02::1 (todos os nós do enlace).

## Módulo 11 — Endereçamento dinâmico com DHCP (3)

- [ ] `dhcp-001` **Qual é a função do DHCP?**
  - Resposta: Entregar automaticamente IP, máscara, gateway e DNS aos dispositivos
  - Explicação: O DHCP (Dynamic Host Configuration Protocol) configura os hosts automaticamente, sem ninguém digitar endereços. Traduzir nomes é função do DNS, e trocar endereços privados por públicos é função do NAT.
- [ ] `dhcp-005` **O que é a concessão (lease) de um endereço DHCP?**
  - Resposta: O tempo durante o qual o cliente pode usar o endereço antes de renová-lo
  - Explicação: O servidor empresta o endereço por um tempo determinado. Antes de expirar, o cliente pede a renovação. Se não renovar, o endereço volta para o conjunto de endereços disponíveis.
- [ ] `dhcp-006` **Ligue cada informação fornecida pelo DHCP à sua função.**
  - Resposta: Endereço IP = Identifica o host na rede; Máscara de sub-rede = Separa a parte de rede da parte de host; Gateway padrão = Saída para outras redes; Servidor DNS = Traduz nomes em endereços IP
  - Explicação: O DHCP entrega o conjunto completo para o host funcionar: o endereço, a máscara, o gateway padrão (para sair da rede) e o servidor DNS (para resolver nomes).

## Módulo 12 — Gateways para outras redes (5)

- [ ] `dhcp-002` **Coloque em ordem as mensagens do processo DHCP, da primeira à última.**
  - Resposta: DHCPDISCOVER → DHCPOFFER → DHCPREQUEST → DHCPACK
  - Explicação: O cliente procura servidores (Discover), um servidor oferece um endereço (Offer), o cliente pede aquele endereço (Request) e o servidor confirma (Acknowledgment). A sequência é conhecida como DORA.
- [ ] `dhcp-003` **Por que o DHCPDISCOVER é enviado em broadcast?**
  - Resposta: O cliente ainda não tem IP nem sabe onde está o servidor DHCP
  - Explicação: Ao conectar, o cliente não tem endereço IP e não sabe qual é o servidor. Por isso grita para toda a rede local, e qualquer servidor DHCP que ouvir pode responder.
- [ ] `nat-001` **Por que uma rede doméstica precisa de NAT para acessar a Internet?**
  - Resposta: Endereços privados não circulam na Internet e precisam de tradução
  - Explicação: Endereços como 192.168.0.15 são privados e não são roteados na Internet. O NAT, normalmente no roteador, troca o endereço privado por um público na saída e faz o caminho inverso na volta. Isso também economiza endereços IPv4.
- [ ] `nat-003` **Cada situação é resolvida pelo DHCP ou pelo NAT?**
  - Resposta: Entregar um endereço ao notebook que acabou de conectar → DHCP; Informar o gateway padrão ao cliente → DHCP; Renovar o tempo de concessão do endereço → DHCP; Trocar o endereço privado pelo público ao sair para a Internet → NAT; Compartilhar um único endereço público entre vários dispositivos → NAT
  - Explicação: O DHCP configura os hosts (endereço, gateway, concessão). O NAT traduz endereços na fronteira entre a rede privada e a Internet.
- [ ] `roteamento-005` **Um computador tem IP e máscara corretos, mas nenhum gateway padrão. O que ele consegue fazer?**
  - Resposta: Falar com hosts da própria rede, mas não com redes de fora
  - Explicação: Dentro da própria rede o ARP basta, e o gateway não é necessário. Para qualquer destino em outra rede, o host não sabe para onde enviar. Esse é um defeito clássico que o laboratório reproduz.

## Módulo 13 — O processo ARP (3)

- [ ] `arp-001` **Para que serve o ARP?**
  - Resposta: Descobrir o endereço MAC associado a um endereço IP da rede local
  - Explicação: Para montar o quadro, o host precisa do MAC de destino, mas só conhece o IP. O ARP (Address Resolution Protocol) faz essa ligação dentro da rede local. Nomes são resolvidos pelo DNS e endereços são entregues pelo DHCP.
- [ ] `arp-002` **Coloque em ordem o que acontece quando o host A quer falar com o host B na mesma rede e só conhece o IP de B.**
  - Resposta: A envia um ARP Request em broadcast → B responde com um ARP Reply para A → A guarda o MAC de B na tabela ARP → A envia o quadro com o MAC de destino de B
  - Explicação: A pergunta a todos "quem tem este IP?" (broadcast). Só B responde, direto para A (unicast). A guarda a resposta na tabela ARP, para não perguntar de novo, e então envia o quadro.
- [ ] `arp-003` **Um PC envia um pacote para um host de OUTRA rede. Qual endereço MAC vai como destino no quadro?**
  - Resposta: O MAC da interface do roteador que é o gateway padrão
  - Explicação: O quadro só atravessa a rede local. O endereço IP de destino continua sendo o do host distante, mas o MAC de destino é o do gateway, que recebe o quadro e encaminha o pacote adiante. O PC descobre o MAC do gateway com o ARP.

## Módulo 14 — Roteamento entre redes (3)

- [ ] `roteamento-002` **Ligue cada tipo de rota à sua descrição.**
  - Resposta: Rota conectada = Rede ligada diretamente a uma interface do roteador; Rota estática = Configurada manualmente pelo administrador; Rota dinâmica = Aprendida com outros roteadores por um protocolo; Rota padrão = Usada quando nenhuma outra rota corresponde ao destino
  - Explicação: A rota conectada aparece sozinha quando a interface recebe um endereço. A estática é escrita à mão. A dinâmica vem de protocolos como OSPF. A rota padrão (0.0.0.0/0) é a "saída" para qualquer destino desconhecido.
- [ ] `roteamento-004` **O host 192.168.1.10/24 vai enviar pacotes para cada destino. Para onde o quadro vai primeiro?**
  - Resposta: 192.168.1.50 → Direto ao destino; 192.168.1.200 → Direto ao destino; 192.168.2.5 → Ao gateway padrão; 8.8.8.8 → Ao gateway padrão; 10.0.0.1 → Ao gateway padrão
  - Explicação: Destinos na mesma rede (192.168.1.0/24) são alcançados direto, com ARP do próprio destino. Qualquer destino fora da rede é enviado ao gateway padrão, que é o roteador.
- [ ] `roteamento-006` **Um roteador recebe um pacote para um destino sem rota correspondente e sem rota padrão. O que acontece?**
  - Resposta: O pacote é descartado, e o roteador pode avisar a origem com um ICMP
  - Explicação: Sem rota, o roteador não sabe para onde enviar e descarta o pacote. Normalmente avisa a origem com uma mensagem ICMP de destino inalcançável. É o que aparece no ping quando falta rota.

## Módulo 15 — TCP e UDP (9)

- [ ] `dhcp-004` **Qual é a porta UDP usada pelo servidor DHCP?**
  - Resposta: 67
  - Explicação: O servidor DHCP escuta na porta UDP 67 e o cliente usa a porta UDP 68.
- [ ] `transporte-001` **Qual característica descreve o TCP?**
  - Resposta: Estabelece uma conexão e confirma a entrega dos dados
  - Explicação: O TCP é orientado a conexão e confiável: numera os dados, o destino confirma o que recebeu e o que se perde é reenviado. Quem envia sem conexão e sem confirmação é o UDP.
- [ ] `transporte-002` **Qual protocolo de transporte cada aplicação costuma usar?**
  - Resposta: Página da web (HTTPS) → TCP; Envio de e-mail → TCP; Download de um arquivo → TCP; Chamada de voz pela Internet → UDP; Transmissão de vídeo ao vivo → UDP; Consulta DNS → UDP
  - Explicação: Web, e-mail e arquivos não podem perder pedaços, então usam TCP. Voz, vídeo ao vivo e consultas DNS preferem rapidez: uma perda pequena é tolerável e reenviar atrasaria tudo, então usam UDP.
- [ ] `transporte-004` **Ligue cada protocolo à sua porta padrão.**
  - Resposta: HTTP = 80; HTTPS = 443; DNS = 53; SSH = 22
  - Explicação: HTTP usa a porta 80 e HTTPS a 443. O DNS usa a 53 (UDP e TCP) e o SSH, acesso remoto seguro, usa a 22.
- [ ] `transporte-005` **Quantos números de porta existem no TCP (de 0 até o maior valor possível)?**
  - Resposta: 65536 portas
  - Explicação: O número de porta tem 16 bits, então são 2^16 = 65.536 valores, de 0 a 65.535.
- [ ] `transporte-006` **Para que serve o número de porta?**
  - Resposta: Indicar qual aplicação do computador deve receber os dados
  - Explicação: O endereço IP leva o pacote até o dispositivo, e o número de porta leva os dados até o programa certo dentro dele (navegador, e-mail, jogo). Por isso vários programas usam a rede ao mesmo tempo sem se misturar.
- [ ] `transporte-007` **O que é um soquete (socket)?**
  - Resposta: A combinação de um endereço IP com um número de porta
  - Explicação: Um soquete é o par endereço IP + porta, como 192.168.1.10:443. Uma conexão fica definida pelos dois soquetes: o do cliente e o do servidor.
- [ ] `transporte-008` **Como o TCP garante que os dados chegaram?**
  - Resposta: Numera os segmentos, recebe ACK e reenvia o que não foi confirmado
  - Explicação: Cada segmento tem um número de sequência. O destino confirma o que recebeu com ACK, e o que não é confirmado a tempo é retransmitido. Também reordena os segmentos se chegarem fora de ordem.
- [ ] `transporte-009` **Como são chamadas as portas de 0 a 1023?**
  - Resposta: Portas conhecidas (well-known), reservadas a serviços padrão
  - Explicação: As portas de 0 a 1023 são as conhecidas (HTTP 80, HTTPS 443, SSH 22…). De 1024 a 49151 ficam as registradas, e de 49152 a 65535 as dinâmicas, que os clientes usam como porta de origem temporária.

## Módulo 16 — Serviços da camada de aplicação (6)

- [ ] `dns-001` **Qual é a função do DNS?**
  - Resposta: Traduzir nomes como www.exemplo.com em endereços IP
  - Explicação: As pessoas lembram nomes, e os computadores usam endereços IP. O DNS (Domain Name System) faz a tradução. DHCP entrega endereços, ARP descobre MACs e NAT troca endereços privados por públicos.
- [ ] `dns-002` **Coloque em ordem o que acontece ao abrir um site pelo nome.**
  - Resposta: O usuário digita o nome do site no navegador → O computador procura o nome no cache local → O computador consulta o servidor DNS configurado → O servidor DNS responde com o endereço IP → O navegador se conecta ao endereço IP recebido
  - Explicação: Primeiro o computador tenta o cache. Se não achar, pergunta ao servidor DNS. Com o endereço IP em mãos, o navegador abre a conexão com o servidor do site.
- [ ] `aplicacao-001` **A que tipo de serviço pertence cada protocolo?**
  - Resposta: HTTP → Web; HTTPS → Web; SMTP → E-mail; POP3 → E-mail; IMAP → E-mail; FTP → Transferência de arquivos; SMB → Transferência de arquivos
  - Explicação: HTTP e HTTPS levam páginas da web. SMTP envia e-mails, e POP3 e IMAP permitem receber e ler. FTP e SMB servem para transferir e compartilhar arquivos.
- [ ] `aplicacao-002` **Qual é a porta TCP padrão de controle (comandos) do FTP?**
  - Resposta: 21
  - Explicação: O FTP usa a porta 21 para controle (comandos) e a 20 para transferir dados no modo ativo.
- [ ] `aplicacao-003` **Qual é a diferença entre HTTP e HTTPS?**
  - Resposta: O HTTPS criptografa a comunicação entre o navegador e o servidor
  - Explicação: O HTTPS é o HTTP protegido por criptografia (TLS), o que impede que alguém no caminho leia ou altere os dados. É o que o cadeado do navegador indica.
- [ ] `aplicacao-004` **Por que o SSH é preferido ao Telnet para administrar equipamentos?**
  - Resposta: O SSH criptografa a sessão, e o Telnet envia tudo em texto puro
  - Explicação: No Telnet, usuário e senha trafegam sem criptografia e qualquer um no caminho pode lê-los. O SSH protege a sessão inteira com criptografia, e por isso é o padrão para acesso remoto.

## Módulo 17 — Utilitários de teste de rede (6)

- [ ] `dns-005` **O ping para 8.8.8.8 funciona, mas o ping para www.exemplo.com mostra que o nome não foi encontrado. Onde está o problema?**
  - Resposta: Na resolução de nomes: o DNS não está configurado ou não responde
  - Explicação: Se o ping para um endereço IP da Internet funciona, o cabo, o IP, a máscara e o gateway estão certos. O que falha é a tradução de nome em endereço, ou seja, o DNS. É um bom exemplo de diagnóstico por camadas.
- [ ] `troubleshooting-001` **Coloque em ordem as etapas do método de diagnóstico de problemas de rede.**
  - Resposta: Identificar o problema → Estabelecer uma teoria da causa provável → Testar a teoria para confirmar a causa → Planejar e executar a correção → Verificar o funcionamento completo → Documentar o que foi feito
  - Explicação: Primeiro se entende o problema, depois se levanta uma teoria e se testa. Confirmada a causa, planeja-se e aplica-se a correção, verifica-se se tudo voltou a funcionar e, por fim, documenta-se para ajudar nos próximos casos.
- [ ] `troubleshooting-002` **Ligue cada ferramenta ao que ela mostra ou testa.**
  - Resposta: ping = Testa se um destino responde; ipconfig = Mostra o IP, a máscara e o gateway do computador; tracert = Mostra os roteadores do caminho até o destino; nslookup = Consulta um servidor DNS
  - Explicação: O ping verifica a conectividade. O ipconfig (ip addr no Linux) mostra a configuração IP. O tracert (traceroute no Linux) lista os saltos até o destino, e o nslookup testa a resolução de nomes.
- [ ] `troubleshooting-007` **O ping para o gateway funciona, mas o ping para 8.8.8.8 falha. Onde investigar?**
  - Resposta: Depois do gateway: rota padrão do roteador, NAT ou o link do provedor
  - Explicação: Se o gateway responde, o cabo, a placa, o IP e a máscara do computador estão bons. O pacote morre depois dele: pode faltar a rota padrão no roteador, o NAT pode estar desligado ou o link do provedor pode ter caído. Como o teste usou o IP, o DNS não entra.
- [ ] `troubleshooting-008` **Um usuário diz "a Internet caiu". Qual é o melhor primeiro passo?**
  - Resposta: Coletar informações: quem é afetado, desde quando e o que mudou
  - Explicação: O primeiro passo é identificar o problema: quantos usuários, que serviços, desde quando e o que mudou. Ações apressadas, como reiniciar ou trocar tudo, escondem a causa e podem piorar a situação.
- [ ] `troubleshooting-009` **Dois computadores da mesma rede estão com o mesmo endereço IP. Qual é o sintoma típico?**
  - Resposta: A conexão de um ou dos dois fica intermitente, com possível aviso de conflito
  - Explicação: Com o mesmo IP, as respostas ARP se alternam e o tráfego vai ora para um, ora para outro. O resultado é conexão instável, e o sistema costuma avisar do conflito. A solução é dar um endereço diferente a um deles. Há uma missão assim no laboratório.

## Bônus (além do curso) (22)

- [ ] `ethernet-004` **A camada de enlace tem duas subcamadas. A qual delas pertence cada função?**
  - Resposta: Conversar com a camada de rede → LLC (controle do enlace lógico); Identificar qual protocolo de rede está nos dados (IPv4 ou IPv6) → LLC (controle do enlace lógico); Montar o quadro com os endereços MAC → MAC (controle de acesso ao meio); Controlar quando o dispositivo pode usar o meio → MAC (controle de acesso ao meio)
  - Explicação: A subcamada LLC faz a ligação com a camada de rede. A subcamada MAC cuida do quadro, dos endereços MAC e do acesso ao meio físico.
- [ ] `subnetting-008` **Ordene os passos para planejar as sub-redes de uma empresa com VLSM.**
  - Resposta: Calcular quantos hosts cada setor precisa → Ordenar os setores do maior para o menor → Escolher o menor prefixo que comporte cada setor → Alocar os blocos em sequência, sem sobreposição
  - Explicação: Primeiro se levanta a necessidade de cada setor. Depois se ordena do maior para o menor, escolhe-se o menor prefixo que atenda e, por fim, os blocos são alocados um depois do outro, sem se sobreporem. É o que o módulo Empresa pede.
- [ ] `ipv6-007` **Qual é o comprimento de prefixo (o número depois da barra) normalmente usado em uma LAN IPv6?**
  - Resposta: 64 bits
  - Explicação: Em redes locais usa-se /64: 64 bits identificam a rede e 64 bits identificam a interface (host). Isso deixa um espaço gigantesco para hosts em cada sub-rede.
- [ ] `ipv6-008` **Ligue cada prefixo ao seu tipo de endereço.**
  - Resposta: 2000::/3 = Global unicast; fe80::/10 = Link-local; ff00::/8 = Multicast; ::1/128 = Loopback
  - Explicação: Global unicast: 2000::/3 (roteável na Internet). Link-local: fe80::/10 (só no enlace local). Multicast: ff00::/8. O loopback é um único endereço, ::1/128.
- [ ] `ipv6-009` **Monte um endereço global unicast com sub-rede /64, da esquerda para a direita.**
  - Resposta: Prefixo de roteamento global (48 bits) → ID da sub-rede (16 bits) → ID da interface (64 bits)
  - Explicação: Os 48 primeiros bits são o prefixo de roteamento global (dado pelo provedor), os 16 seguintes identificam a sub-rede dentro da organização e os 64 últimos identificam a interface. 48 + 16 + 64 = 128 bits.
- [ ] `nat-002` **Ligue cada tipo de NAT à sua característica.**
  - Resposta: NAT estático = Mapeamento fixo de um endereço privado para um público; NAT dinâmico = Escolhe o endereço público em um conjunto disponível; PAT (sobrecarga) = Vários hosts dividem um endereço público, distinguidos pela porta
  - Explicação: O NAT estático é um para um e fixo. O dinâmico sorteia um endereço público de um conjunto, quando houver. O PAT é o mais comum nas casas: um único endereço público atende muitos dispositivos, cada conexão com uma porta diferente.
- [ ] `roteamento-001` **Um pacote sai com TTL 64 e passa por 3 roteadores. Qual é o TTL quando chega ao destino?**
  - Resposta: 61
  - Explicação: Cada roteador que encaminha o pacote reduz o TTL em 1: 64 − 3 = 61. Se chegar a 0, o pacote é descartado, o que impede que fique circulando para sempre.
- [ ] `roteamento-003` **A tabela tem as rotas 10.0.0.0/8, 10.1.1.0/24 e 0.0.0.0/0. Qual rota o roteador usa para chegar em 10.1.1.5?**
  - Resposta: 10.1.1.0/24, a de prefixo mais longo que corresponde
  - Explicação: As três rotas correspondem ao destino, mas o roteador escolhe a mais específica, a de prefixo mais longo. A /24 vence a /8, e a rota padrão só é usada quando nada mais corresponde.
- [ ] `transporte-003` **Coloque em ordem as mensagens que abrem uma conexão TCP (three-way handshake).**
  - Resposta: SYN → SYN-ACK → ACK
  - Explicação: O cliente propõe a conexão (SYN), o servidor aceita e propõe a sua parte (SYN-ACK) e o cliente confirma (ACK). Só depois os dados são enviados.
- [ ] `dns-003` **Ligue cada tipo de registro DNS ao que ele guarda.**
  - Resposta: A = Endereço IPv4 de um nome; AAAA = Endereço IPv6 de um nome; MX = Servidor de e-mail do domínio; NS = Servidor DNS responsável pelo domínio
  - Explicação: O registro A associa um nome a um endereço IPv4, e o AAAA a um IPv6. O MX diz para onde entregar os e-mails do domínio, e o NS indica quais servidores DNS respondem por ele.
- [ ] `dns-004` **Para que serve o cache DNS?**
  - Resposta: Guardar respostas recentes para responder mais rápido sem consultar de novo
  - Explicação: O cache guarda por um tempo as respostas que já recebeu. Se o mesmo nome for pedido de novo, a resposta sai da memória, sem consultar o servidor DNS outra vez.
- [ ] `troubleshooting-003` **Em qual camada fica a causa mais provável de cada sintoma?**
  - Resposta: O cabo está solto e o LED da porta está apagado → Física; A porta do switch está na VLAN errada → Enlace de dados; O gateway padrão está configurado com o endereço errado → Rede; O site abre pelo endereço IP, mas não pelo nome → Aplicação
  - Explicação: Cabo e LED são da camada física. Uma porta na VLAN errada é um problema de comutação, na camada de enlace. Gateway errado é endereçamento, na camada de rede. Falha só no nome indica o DNS, um serviço da camada de aplicação.
- [ ] `troubleshooting-004` **O LED da placa de rede está apagado. Em qual camada do modelo OSI (número) você começa a investigar?**
  - Resposta: 1
  - Explicação: LED apagado costuma indicar cabo solto, defeituoso ou porta desligada. Isso é da camada 1, a física. Por isso se começa por ela antes de mexer em endereços e configurações.
- [ ] `troubleshooting-005` **Como se chama a estratégia de começar pela camada física e subir camada por camada até achar o problema?**
  - Resposta: De baixo para cima (bottom-up)
  - Explicação: Na abordagem de baixo para cima (bottom-up) se parte da camada física. A de cima para baixo (top-down) começa pela aplicação. A divisão e conquista começa por uma camada intermediária, e a substituição troca componentes suspeitos por outros que funcionam.
- [ ] `seguranca-001` **A que tipo de ameaça pertence cada caso?**
  - Resposta: Ransomware que sequestra os arquivos → Malware; Cavalo de Troia escondido em um programa gratuito → Malware; E-mail falso do banco pedindo a senha → Engenharia social; Ligação de um falso "suporte técnico" pedindo acesso → Engenharia social; DDoS que derruba um site com milhões de requisições → Ataque à rede; Invasor que intercepta a comunicação entre duas pontas → Ataque à rede
  - Explicação: Malware é software malicioso (ransomware, cavalo de Troia, vírus). Engenharia social engana a pessoa, e não o sistema (phishing, golpes por telefone). Ataques à rede, como o DDoS e o man-in-the-middle, miram a comunicação e a disponibilidade.
- [ ] `seguranca-002` **O que é phishing?**
  - Resposta: Uma mensagem falsa que imita uma instituição para roubar dados da vítima
  - Explicação: No phishing o golpista se passa por banco, loja ou empresa conhecida, normalmente por e-mail, mensagem ou site falso, para convencer a vítima a entregar senhas ou dados. Desconfie de urgência, de links estranhos e de erros no endereço do remetente.
- [ ] `seguranca-003` **Qual é a função de um firewall?**
  - Resposta: Filtrar o tráfego entre redes, permitindo ou bloqueando conforme regras
  - Explicação: O firewall fica entre redes (por exemplo, a rede local e a Internet) e aplica regras: o que corresponde a uma regra de permissão passa, o resto é bloqueado. Traduzir nomes é o DNS, e entregar endereços é o DHCP.
- [ ] `seguranca-004` **Ligue cada princípio da segurança da informação ao seu significado.**
  - Resposta: Confidencialidade = Só quem tem autorização consegue acessar; Integridade = Os dados não são alterados de forma indevida; Disponibilidade = O serviço está acessível quando for preciso
  - Explicação: São os três pilares da segurança da informação. Criptografia protege a confidencialidade, somas de verificação ajudam a integridade, e redundância e backups sustentam a disponibilidade.
- [ ] `seguranca-005` **Qual combinação protege melhor uma conta?**
  - Resposta: Senha longa e exclusiva, mais verificação em duas etapas
  - Explicação: Senhas longas e diferentes em cada conta limitam o estrago de um vazamento, e a verificação em duas etapas exige um segundo fator além da senha. Senhas curtas, repetidas ou com dados pessoais são fáceis de adivinhar.
- [ ] `seguranca-006` **Um computador da rede foi infectado. Coloque em ordem o que fazer.**
  - Resposta: Isolar o dispositivo da rede → Identificar o tipo de ameaça → Remover a ameaça → Restaurar o sistema a partir de uma cópia confiável → Registrar o que aconteceu
  - Explicação: Primeiro se contém o problema, para que não se espalhe. Depois se identifica e remove a ameaça, restaura-se o sistema a partir de uma cópia confiável e, por fim, registra-se o incidente para evitar que se repita.
- [ ] `seguranca-007` **Na regra de backup 3-2-1, quantas cópias dos dados você deve ter no total?**
  - Resposta: 3 cópias
  - Explicação: A regra 3-2-1 diz: 3 cópias dos dados (a original e duas de backup), em 2 tipos de mídia diferentes, com 1 cópia guardada fora do local.
- [ ] `seguranca-009` **Por que manter sistemas e equipamentos de rede atualizados?**
  - Resposta: As atualizações corrigem vulnerabilidades conhecidas que atacantes exploram
  - Explicação: Quando uma falha é descoberta, o fabricante publica a correção, e os atacantes passam a procurar equipamentos que ainda não a aplicaram. Atualizar fecha essa porta.
