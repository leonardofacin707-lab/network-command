// Wi-Fi (puro, sem DOM). O ponto de acesso funciona como uma ponte de camada 2: cada computador associado ganha um
// "cabo sem fio" virtual até ele, só na topologia vista pela simulação (o modelo salvo não muda).
// Regras: o SSID precisa ser idêntico (diferencia maiúsculas); em WPA2/WPA3 a senha precisa ser a mesma; um adaptador
// só de 2,4 GHz não enxerga uma rede só de 5 GHz; SSID oculto não aparece na lista, mas aceita quem digita o nome certo.
// NÃO modela: alcance e sinal, canais e interferência, roaming, WPA-Enterprise (802.1X), WPS, limite de clientes.
import { dispositivo, vizinhos } from './topologia.js';

export const MOTIVO_WIFI = {
  'cabo-em-uso': 'o computador está com cabo na Ethernet0 (o cabo tem prioridade)',
  'ssid-nao-encontrado': 'nenhuma rede com esse nome (o SSID diferencia maiúsculas e minúsculas)',
  'senha-incorreta': 'a senha não confere com a da rede (falha na autenticação WPA)',
  'banda-incompativel': 'a rede só transmite em 5 GHz e este adaptador só funciona em 2,4 GHz'
};

/** Map(pcId -> { ok:true, ap, banda } | { ok:false, motivo }) para todo computador com Wi-Fi configurado. */
export function associacoesWifi(t) {
  const res = new Map();
  const aps = t.dispositivos.filter(d => d.tipo === 'ap' && d.wifi);
  for (const pc of t.dispositivos) {
    if (pc.tipo !== 'pc' || !pc.wifi) continue;
    if (vizinhos(t, pc.id).some(v => v.minhaPorta === 'eth0')) { res.set(pc.id, { ok: false, motivo: 'cabo-em-uso' }); continue; }
    const candidatos = aps.filter(a => a.wifi.ssid === pc.wifi.ssid);
    if (!candidatos.length) { res.set(pc.id, { ok: false, motivo: 'ssid-nao-encontrado' }); continue; }
    let motivo = 'senha-incorreta';
    for (const a of candidatos) {
      if (pc.wifi.so24 && a.wifi.banda === '5') { motivo = 'banda-incompativel'; continue; }
      if (a.wifi.seguranca !== 'aberta' && a.wifi.senha !== pc.wifi.senha) { motivo = 'senha-incorreta'; continue; }
      res.set(pc.id, { ok: true, ap: a.id, banda: pc.wifi.so24 || a.wifi.banda === '2.4' ? '2,4 GHz' : '5 GHz' });
      motivo = null;
      break;
    }
    if (motivo) res.set(pc.id, { ok: false, motivo });
  }
  return res;
}

/** Topologia com os cabos sem fio virtuais das associações (id "wifi-<pc>", porta do AP "w-<pc>"). */
export function aplicarWifi(t, assoc) {
  const virtuais = [...assoc].filter(([, a]) => a.ok).map(([pc, a]) => ({ id: `wifi-${pc}`, a: { d: pc, p: 'eth0' }, b: { d: a.ap, p: `w-${pc}` }, semFio: true }));
  return virtuais.length ? { ...t, cabos: [...t.cabos, ...virtuais] } : t;
}

/** Senha considerada fraca para uma rede de empresa (curta ou óbvia). */
const OBVIAS = ['12345678', '123456789', '1234567890', 'password', 'senha123', 'senha1234', 'qwertyui', '00000000', 'admin123', 'wifi1234'];
export function senhaWifiForte(w) {
  if (!w || (w.seguranca !== 'wpa2' && w.seguranca !== 'wpa3')) return false;
  const s = w.senha ?? '';
  return s.length >= 12 && !OBVIAS.includes(s.toLowerCase()) && new Set(s).size >= 6 && s.toLowerCase() !== w.ssid.toLowerCase();
}

export { dispositivo };
