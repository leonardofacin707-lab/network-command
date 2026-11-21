// Tutorial guiado (sem DOM): cenário inicial e verificação de cada passo. Quem decide se o ping funcionou é o simulador.
import { dispositivo, vizinhos } from '../sim/topologia.js';
import { lerIPv4, lerMascara, mesmaRede } from '../sim/ipv4.js';
import { verificarMissao } from '../missoes/verificar.js';

const pc = (id, nome, x) => ({ id, tipo: 'pc', nome, x, y: 360, interfaces: [{ id: 'eth0', ip: '', mascara: '' }], gateway: '' });
/** Dois computadores e um switch, sem cabos e sem endereços. */
export const cenarioTutorial = () => ({
  dispositivos: [{ id: 'sw1', tipo: 'switch', nome: 'SW1', x: 450, y: 140, interfaces: [], portas: {} }, pc('pc1', 'PC1', 260), pc('pc2', 'PC2', 640)],
  cabos: []
});

const ligado = (t, a, b) => vizinhos(t, a).some(v => v.outro.d === b);
function enderecoDe(t, id) {
  const i = dispositivo(t, id)?.interfaces?.find(x => x.id === 'eth0');
  const ip = lerIPv4(i?.ip ?? ''), m = lerMascara(i?.mascara ?? '');
  return ip === null || m === null ? null : { ip, m };
}

/**
 * Passos em ordem. ok(t, extra) diz se está cumprido; extra.pingou = o jogador rodou um ping que funcionou no terminal.
 * como: onde clicar, em palavras (sem depender de cor ou posição).
 */
export const PASSOS = [
  { id: 'cabo1', titulo: 'Ligue o PC1 ao switch',
    como: 'Na barra de ferramentas, escolha "Conectar cabo". Clique no PC1 e depois no SW1. Um cabo aparece entre os dois.',
    porque: 'Sem meio físico não há comunicação: é a camada 1 (física) do modelo OSI.',
    ok: t => ligado(t, 'pc1', 'sw1') },
  { id: 'cabo2', titulo: 'Ligue o PC2 ao switch',
    como: 'Com "Conectar cabo" ainda escolhido, clique no PC2 e depois no SW1.',
    porque: 'O switch encaminha os quadros entre as portas pelo endereço MAC (camada 2).',
    ok: t => ligado(t, 'pc2', 'sw1') },
  { id: 'ip1', titulo: 'Dê um endereço IP ao PC1',
    como: 'Escolha "Mover" e clique no PC1. No painel ao lado, preencha "Endereço IPv4" com 192.168.1.10, "Máscara" com 255.255.255.0 e clique em "Aplicar".',
    porque: 'O endereço IP identifica o computador na rede (camada 3). A máscara diz qual parte do endereço é a rede.',
    ok: t => enderecoDe(t, 'pc1') !== null },
  { id: 'ip2', titulo: 'Dê ao PC2 um endereço da mesma rede',
    como: 'Clique no PC2 e use, por exemplo, o endereço 192.168.1.20 com a mesma máscara 255.255.255.0. Depois clique em "Aplicar".',
    porque: 'Para conversar sem roteador, os dois precisam estar na mesma sub-rede e com endereços diferentes.',
    ok: t => {
      const a = enderecoDe(t, 'pc1'), b = enderecoDe(t, 'pc2');
      return !!a && !!b && a.ip !== b.ip && a.m === b.m && mesmaRede(a.ip, b.ip, a.m);
    } },
  { id: 'ping', titulo: 'Teste com ping',
    como: 'Com o PC1 selecionado, digite no terminal: ping 192.168.1.20 (ou o endereço que você deu ao PC2) e tecle Enter.',
    porque: 'O ping manda uma mensagem ICMP e espera a resposta. Antes, o PC1 usa ARP para descobrir o MAC do PC2.',
    ok: (t, extra) => !!extra?.pingou && verificarMissao({ objetivos: [{ id: 'p', de: 'pc1', para: 'pc2' }] }, t).todosOk }
];

/** Situação de cada passo e qual é o atual (o primeiro ainda não cumprido, respeitando a ordem). */
export function situacaoTutorial(t, extra = {}) {
  let atual = null;
  const passos = PASSOS.map(p => {
    const ok = atual === null && p.ok(t, extra);
    if (!ok && atual === null) atual = p.id;
    return { ...p, ok };
  });
  return { passos, atual, concluido: atual === null };
}

/** O comando do terminal conta como "ping que funcionou" se for um ping entre os dois computadores e o simulador confirmar. */
export const comandoEhPing = comando => /^\s*ping\b/i.test(String(comando ?? ''));
