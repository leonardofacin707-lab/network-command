// Avisos sobre a topologia, calculados pelo motor (sem DOM). Servem ao laboratório; as missões não usam isto
// para dar a resposta: elas só verificam se o ping funciona.
import { vizinhos } from './topologia.js';
import { lerIPv4, mesmaRede, formatarIPv4 } from './ipv4.js';
import { configDaInterface, conflitosDeIp } from './motor.js';

/** Lista de { dispositivo, texto } com problemas óbvios de configuração. */
export function diagnosticar(t) {
  const avisos = [];
  for (const d of t.dispositivos) {
    if (d.tipo === 'switch') continue;
    for (const i of d.interfaces) {
      const ligada = vizinhos(t, d.id).some(v => v.minhaPorta === i.id);
      const cfg = configDaInterface(d, i.id);
      if (!ligada && d.tipo === 'pc') avisos.push({ dispositivo: d.id, texto: `${d.nome} está sem cabo de rede.` });
      if (ligada && !cfg && d.dhcp) avisos.push({ dispositivo: d.id, texto: `${d.nome} usa DHCP, mas não recebeu endereço (use ipconfig /renew no terminal para ver o motivo).` });
      else if (ligada && !cfg) avisos.push({ dispositivo: d.id, texto: `${d.nome} está ligado, mas a interface ${i.id === 'eth0' ? 'Ethernet0' : i.id} não tem IP configurado.` });
    }
    if (d.tipo === 'pc') {
      const cfg = configDaInterface(d, 'eth0');
      const gw = lerIPv4(d.gateway);
      if (cfg && gw !== null && !mesmaRede(cfg.ip, gw, cfg.mascara)) avisos.push({ dispositivo: d.id, texto: `O gateway de ${d.nome} (${formatarIPv4(gw)}) está fora da sub-rede dele.` });
    }
  }
  for (const c of conflitosDeIp(t)) {
    const nome = id => t.dispositivos.find(x => x.id === id).nome;
    avisos.push({ dispositivo: c.a.d, texto: `Conflito de IP: ${nome(c.a.d)} e ${nome(c.b.d)} usam ${formatarIPv4(c.ip)}.` });
  }
  return avisos;
}

