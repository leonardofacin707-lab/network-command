// Wi-Fi no modelo: rede do ponto de acesso e conexão sem fio dos computadores.
import { dispositivo, trocar } from './base.js';

// ---------- Wi-Fi ----------
export const SEGURANCAS_WIFI = { aberta: 'Aberta (sem senha)', wpa2: 'WPA2-Personal', wpa3: 'WPA3-Personal' };
export const BANDAS_WIFI = { '2.4': '2,4 GHz', 5: '5 GHz', ambas: '2,4 e 5 GHz' };
export const SSID_VALIDO = /^[\x20-\x7E]{1,32}$/;

export function lerWifiAp({ ssid, seguranca, senha, banda, oculto }) {
  const s = String(ssid ?? '').trim();
  if (!SSID_VALIDO.test(s)) return { erro: 'SSID inválido: use de 1 a 32 caracteres (letras sem acento, números e símbolos comuns).' };
  if (!SEGURANCAS_WIFI[seguranca]) return { erro: 'Escolha a segurança: aberta, WPA2 ou WPA3.' };
  const b = String(banda ?? '2.4');
  if (!BANDAS_WIFI[b]) return { erro: 'Escolha a banda: 2,4 GHz, 5 GHz ou as duas.' };
  const pw = String(senha ?? '');
  if (seguranca !== 'aberta' && (pw.length < 8 || pw.length > 63 || !/^[\x20-\x7E]+$/.test(pw))) return { erro: 'No WPA2 e no WPA3 a senha precisa ter de 8 a 63 caracteres (sem acentos).' };
  return { wifi: { ssid: s, seguranca, senha: seguranca === 'aberta' ? '' : pw, banda: b, oculto: oculto === true } };
}

export function lerWifiPc({ ssid, senha, so24 }) {
  const s = String(ssid ?? '').trim();
  if (!s) return { wifi: null };
  if (!SSID_VALIDO.test(s)) return { erro: 'SSID inválido: use de 1 a 32 caracteres.' };
  const pw = String(senha ?? '');
  if (pw.length > 63) return { erro: 'A senha do Wi-Fi tem no máximo 63 caracteres.' };
  return { wifi: { ssid: s, senha: pw, ...(so24 === true ? { so24: true } : {}) } };
}

/** Configura a rede sem fio de um ponto de acesso. As senhas aqui são de laboratório: não use senhas reais. */
export function configurarWifiAp(t, id, campos) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'ap') return { erro: 'Só pontos de acesso transmitem uma rede Wi-Fi.' };
  const w = lerWifiAp(campos); if (w.erro) return w;
  return { topologia: trocar(t, id, x => ({ ...x, wifi: w.wifi })) };
}

/** Liga o computador a uma rede Wi-Fi (SSID vazio = sem Wi-Fi). Com cabo na Ethernet0, o cabo tem prioridade. */
export function configurarWifiPc(t, id, campos) {
  const d = dispositivo(t, id);
  if (!d || d.tipo !== 'pc') return { erro: 'Só computadores se conectam ao Wi-Fi nesta simulação.' };
  const w = lerWifiPc(campos); if (w.erro) return w;
  return { topologia: trocar(t, id, x => { const { wifi: _, ...r } = x; return w.wifi ? { ...r, wifi: w.wifi } : r; }) };
}
