# Mapa de conteúdo — Conceitos Básicos de Redes (NetAcad) → base do jogo
Notas próprias (resumo em palavras minhas, não cópia do curso).

## M1 — Comunicação em um mundo conectado
- Internet = rede de redes, ninguém é dono; padrões comuns.
- Tamanhos: rede doméstica pequena, SOHO, média/grande (empresa/escola), rede mundial (Internet).
- Dispositivos conectados: smartphone, tablet, smartwatch, óculos; casa (segurança, eletrodomésticos, smart TV, console); outros (carro, RFID, sensores/atuadores, dispositivos médicos) → IoT.
- Bit = menor unidade (0/1). Tipos de dados pessoais: voluntários, observados, inferidos.
- Transmissão: sinais elétricos (cobre), ópticos (fibra), ondas (sem fio).
- Largura de banda = capacidade (bps, Kbps=10^3, Mbps=10^6, Gbps=10^9, Tbps=10^12). Taxa de transferência (throughput) = o que realmente passa; afetada por volume, tipo de dado, latência (tempo de ida de um ponto a outro).

## M2 — Componentes, tipos e conexões
- Host = participa da comunicação; pode ser cliente, servidor ou ambos (o software define).
- Servidores: e-mail, web, arquivos (cada serviço = software servidor próprio). Cliente: navegador, cliente de e-mail, explorador de arquivos.
- P2P: fácil, barato, simples; sem administração central, menos segura, não escala, desempenho cai. Aplicações P2P e modelo híbrido (servidor de índice).
- Infraestrutura: dispositivos finais, dispositivos intermediários, meios físicos.
- Dispositivo final (host) = origem/destino da mensagem (PC, impressora, telefone IP, câmera, celular, leitor de cartão).
- ISP: liga a casa à Internet; serviços extras (e-mail, hospedagem, backup). Backbone = fibra + roteadores/switches entre ISPs.
- Conexões: modem direto (inseguro), cabo (coaxial, sempre ativo), DSL (linha telefônica), celular, satélite (linha de visada), dial-up (baixo custo, pouca banda), fibra (metrópoles).

## M3 — Redes sem fio e móveis
- Celular: torres, GSM, 3G/4G/5G; transição entre redes transparente.
- GPS (satélites, ~10 m), Wi-Fi (precisa de AP no alcance), Bluetooth (curto alcance, baixo consumo, até 8 dispositivos, pareamento, modo detectável), NFC (muito próximo, ex.: pagamento).
- Conectar Wi-Fi: SSID (nome da rede) + senha exatos; SSID oculto → adicionar manualmente (SSID, tipo de segurança, senha).
- Celular prefere Wi-Fi; sem Wi-Fi usa dados móveis.
- Segurança Wi-Fi móvel: nunca enviar login em texto claro; usar VPN em redes não confiáveis.

## M4 — Construindo uma rede doméstica
- Roteador doméstico integrado = switch (portas LAN/Ethernet) + porta Internet/WAN (outra rede, liga ao modem) + AP sem fio. Wi-Fi fica na mesma LAN das portas LAN.
- Frequências não licenciadas 2,4 GHz e 5 GHz; Bluetooth usa 2,4 GHz (curto alcance, um-para-muitos).
- Ethernet = protocolo com fio mais comum. Cabos: Cat5e (4 pares trançados contra interferência), coaxial, fibra (vidro/plástico, luz, alta velocidade e distância).
- IEEE 802.11 = padrões WLAN (b/g/n/ac/ax; modo misto).
- Configurações do roteador: modo de rede, SSID (todos iguais para participar), canal (auto), broadcast de SSID (ligado por padrão).
- Design: SSID que não revele informações, compatibilidade de rádios (b/g x 5 GHz), rede de convidados.
- Packet Tracer: conectar cabos, configurar roteador sem fio, DHCP para clientes, testar.

## M5 — Princípios de comunicação
- Protocolos = regras: emissor/receptor, método, idioma, velocidade, confirmação.
- Características: formato, tamanho (fragmentar mensagens longas), temporização, codificação, opções de entrega (unicast/multicast/broadcast).
- Padrões abertos garantem interoperabilidade; organizações (IEEE, IETF, ISO, ITU...) e RFCs documentam padrões.
- Modelo em camadas: facilita projeto, competição entre fabricantes, mudanças isoladas, linguagem comum.
- TCP/IP (4): Aplicação, Transporte, Internet, Acesso à rede.
- OSI (7): 7 Aplicação, 6 Apresentação, 5 Sessão, 4 Transporte, 3 Rede, 2 Enlace, 1 Física.
- Mapeamento: OSI 5-7 → Aplicação; 4 → Transporte; 3 → Internet; 1-2 → Acesso à rede.

## M6 — Mídia de rede
- 3 tipos: cobre (pulsos elétricos), fibra (pulsos de luz), sem fio (micro-ondas/rádio).
- Critérios de escolha: distância máxima, ambiente, volume/velocidade, custo.
- Par trançado (Ethernet, mais comum em LAN, RJ-45), coaxial (TV a cabo, antigo), fibra (longa distância, imune a interferência).

## M7 — A camada de acesso
- Encapsulamento (carta dentro do envelope) / desencapsulamento no destino.
- Quadro Ethernet: preâmbulo, delimitador de início, MAC destino, MAC origem, tipo/comprimento, dados, FCS (detecção de erro).
- Camada de acesso = onde hosts se ligam à rede com fio.
- Hub: uma mensagem por vez, colisões, obsoleto. Switch (camada 2): lê MAC destino, tabela de endereços MAC (porta ↔ MAC), cria circuito entre portas, full-duplex; MAC desconhecido → inunda (flood) todas as portas exceto a de origem; aprende MAC de origem.

## M8 — Protocolo IP (IPv4)
- IPv4 = endereço lógico, único na LAN e globalmente; atribuído à interface (NIC). Pacote tem IP origem e destino.
- 32 bits = 4 octetos; notação decimal com ponto (conversão binário↔decimal).
- Parte de rede + parte de host; máscara (ex. 255.255.255.0) define qual é qual. Ex.: 192.168.5.11/24 → rede 192.168.5, host 11.
- Endereçamento hierárquico: roteador só precisa saber chegar à rede.
- Várias redes lógicas numa mesma rede física. Ping para testar conectividade.

## M9 — IPv4 e segmentação de rede
- Unicast (um-para-um; hosts de 1.1.1.1 a 223.255.255.255), broadcast (um-para-todos; host todo em 1; IPv6 não tem broadcast), multicast (um-para-grupo; 224.0.0.0–239.255.255.255).
- Broadcast consome recursos; roteadores não encaminham broadcast → cada interface = um domínio de broadcast.
- Privados (RFC 1918): 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16. Não roteáveis na Internet → NAT traduz privado↔público no roteador de borda.
- Especiais: rede e broadcast não vão em host; loopback 127.0.0.0/8 (127.0.0.1); link-local/APIPA 169.254.0.0/16 (Windows se autoatribui sem DHCP).
- Classful legado (A 0–127 /8, B 128–191 /16, C 192–223 /24, D multicast, E experimental) → substituído por classless (CIDR).
- IANA → 5 RIRs (AfriNIC, APNIC, ARIN, LACNIC, RIPE NCC) → ISPs.
- Segmentação/sub-redes: domínio de broadcast grande (ex. 400 hosts) fica lento → dividir (172.16.0.0/16 → 172.16.0.0/24 e 172.16.1.0/24), pegando bits de host. Motivos: desempenho, segurança/políticas, conter problemas. Critérios: localização, grupo/função, tipo de dispositivo.

## M10 — IPv6
- IPv4 ~4,3 bilhões e esgotado; NAT adia mas cria latência e atrapalha P2P. IPv6 = 128 bits (~340 undecilhões).
- Coexistência: pilha dupla (nativo, ambos ao mesmo tempo), tunelamento (IPv6 dentro de IPv4), tradução NAT64.
- Hexadecimal (0–9, A–F); 8 hextetos de 16 bits, formato x:x:x:x:x:x:x:x.
- Regra 1: omitir zeros à ESQUERDA de cada hexteto (01AB→1AB; não zeros à direita).
- Regra 2: "::" substitui UMA única sequência contígua de hextetos zerados (só uma vez por endereço). Ex.: 2001:db8:cafe:1:0:0:0:1 → 2001:db8:cafe:1::1; ::1 loopback; fe80:: link-local.

## M11 — DHCP
- Estático: configurar manualmente IP, máscara, gateway padrão, DNS. Bom para servidores/impressoras.
- Dinâmico (DHCP): atribui automaticamente IP, máscara, gateway, DNS por um tempo (concessão/lease). Eficiente em redes que mudam (hotspots).
- Servidor DHCP: servidor dedicado em redes grandes; em casa o roteador sem fio é cliente DHCP do ISP (recebe IP público) e servidor DHCP da LAN (entrega privados).
- Prática: faixa DHCP (endereço inicial + quantidade), ipconfig, ping para testar.

## M12 — Gateways para outras redes
- Roteador = gateway; cada interface numa rede diferente; host precisa do IP da interface do roteador como gateway padrão para sair da rede local.
- Roteador doméstico = limite entre rede interna (privada, DHCP) e externa (ISP).
- NAT: muitos privados compartilham um IP público; tráfego de fora não alcança a rede interna diretamente por padrão.
- DHCP DORA: Discover (broadcast 255.255.255.255 / MAC FF-FF-FF-FF-FF-FF) → Offer → Request → Acknowledgment. Pool de endereços. (complementa M11)
- NAT: origem privada (local) trocada pelo IP público (global) do roteador; inverso na volta; vários internos → um público; só tráfego que sai pelo gateway é traduzido. (complementa M12)

## M13 — Processo ARP
- Dois endereços: físico MAC (NIC↔NIC na mesma rede Ethernet, camada 2) e lógico IP (origem→destino final, camada 3).
- Destino na mesma rede: MAC destino = MAC do host destino.
- Destino remoto: MAC destino = MAC do gateway padrão (interface do roteador). A cada salto o quadro é refeito (MACs mudam), IPs origem/destino continuam iguais.
- IPv4 usa ARP; IPv6 usa ICMPv6 Neighbor Discovery.
- LAN com switches = domínio de broadcast; NIC aceita quadro se MAC = o seu ou broadcast.
- ARP em 3 passos: pedido em broadcast "quem tem o IP X?" → só o dono responde em unicast com seu MAC → remetente guarda na tabela/cache ARP.
- Packet Tracer: modo Simulation, inspecionar PDUs de entrada/saída por salto.

## M14 — Roteamento entre redes
- Hosts remotos exigem roteador. Por que dividir redes: contenção de broadcast, segurança, localização física, agrupamento lógico (departamentos) — roteadores na camada de distribuição.
- Tabela de roteamento contém REDES (não hosts) + interface/próximo salto. Entradas: diretamente conectadas, estáticas (manuais) ou dinâmicas (protocolos de roteamento). Rota padrão quando nada combina.
- Roteador desencapsula o quadro, lê IP destino, compara a parte de rede com a tabela, re-encapsula em novo quadro e encaminha → para rede diretamente conectada ou para outro roteador.
- Host: destino local → ARP do destino e envia direto; destino remoto → envia ao gateway padrão.
- LAN = redes sob mesmo controle administrativo; tudo em um segmento (um domínio de broadcast) x segmentos separados por roteador (menos tráfego, mas precisa rotear).
- Comandos: ipconfig, ping, tracert (usa ICMP, mostra roteadores no caminho).

## M15 — TCP e UDP
- UDP: melhor esforço, sem confirmação, sem reenvio; ideal p/ streaming ao vivo, VoIP, jogos, DNS (consulta).
- TCP: confiável; divide em segmentos numerados (sequência), confirmações (ACK), retransmite o que se perdeu, remonta na ordem.
- Portas (1–65535, ICANN/IANA): bem conhecidas 0–1023, registradas 1024–49151, dinâmicas/privadas 49152–65535 (origem do cliente).
- Portas: 20/21 FTP (dados/controle), 22 SSH, 23 Telnet, 25 SMTP, 53 DNS (UDP e TCP — servidor↔servidor usa TCP), 67/68 DHCP servidor/cliente (UDP), 69 TFTP (UDP), 80 HTTP, 110 POP3, 143 IMAP, 161 SNMP (UDP), 443 HTTPS.
- Socket = IP + porta; par de sockets identifica a conversa (ex.: cliente 1305 → servidor 21).
- netstat lista conexões TCP ativas (conexão desconhecida = possível ameaça); netstat -n mostra numérico.

## M16 — Serviços da camada de aplicação
- Cliente/servidor (navegador, cliente de e-mail, explorador ↔ servidores web, e-mail, arquivos).
- URI (identificador) → URN (só o nome) e URL (nome + localização/protocolo, ex. https://site/caminho).
- Protocolos: DNS (nome→IP), SSH (acesso remoto seguro), SMTP (enviar e-mail cliente→servidor e servidor→servidor), POP3 (110, baixa e por padrão apaga do servidor), IMAP (143, mantém no servidor/sincroniza), DHCP, HTTP/HTTPS, FTP, Telnet.
- DNS: configurar servidor DNS no host (em casa vem do ISP via DHCP do roteador); nslookup consulta DNS.
- HTTP porta 80 (inseguro, dá para interceptar); HTTPS porta 443 (criptografado). HTML = linguagem das páginas.
- FTP: duas conexões — controle (21) e dados (20); upload/download, login.
- Telnet (23): terminal virtual, tudo em texto claro (senha inclusive) → inseguro; usar SSH (22), criptografado.
- Mensagens de texto/instantâneas; VoIP converte voz analógica em dados digitais (P2P nos clientes de telefonia IP).

## M17 — Utilitários de teste de rede
- ipconfig (IP, máscara, gateway); /all (MAC, DNS, DHCP ativo, concessão); /release e /renew (devolver e pedir novo IP via DHCP).
- ping: echo request → echo reply (ICMP). Testar por nome e por IP.
- Interpretação: ping por IP e nome OK mas app não abre → problema no serviço/aplicação; ping por IP OK mas por nome falha → problema de DNS; nenhum ping → problema de conectividade no caminho (testar gateway, depois além).
- tracert (Windows)/traceroute: mostra cada roteador (salto) até o destino; netstat: conexões ativas; nslookup: DNS.
- Packet Tracer: achar PC com IP/máscara/gateway/DNS errados usando ipconfig e ping.

---
# Proposta de níveis do jogo (seguindo o curso)
1. Mundo conectado (M1–M3): tipos de rede, bits/banda, dispositivos, Wi-Fi/Bluetooth/NFC.
2. Monte sua rede doméstica (M4, M6): portas LAN/WAN, cabos certos, SSID/2,4 x 5 GHz.
3. Camadas (M5): arrastar protocolos/funções para OSI e TCP/IP.
4. Dentro do switch (M7): quadro Ethernet, tabela MAC, hub x switch.
5. Endereço IPv4 (M8–M9): binário↔decimal, rede x host, público/privado/especial, unicast/broadcast/multicast.
6. Sub-redes (M9): dividir domínio de broadcast.
7. IPv6 (M10): compactar/expandir endereços.
8. DHCP e NAT (M11–M12): DORA em ordem, tradução privado→público, gateway.
9. A jornada do pacote (M13–M14): ARP, MACs que mudam a cada salto, tabela de roteamento.
10. Transporte (M15): TCP x UDP, portas, sockets.
11. Serviços (M16): DNS, HTTP/HTTPS, e-mail, FTP, Telnet x SSH.
12. Chefão — Troubleshooting (M17): diagnosticar redes quebradas com ipconfig/ping/tracert/nslookup.
