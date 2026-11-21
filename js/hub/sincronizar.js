// Sincronizar progresso entre aparelhos: gerar um código aqui e colar no outro (ou abrir o link). Sem servidor.
import { esc } from '../core/ui.js';
import { normalizar } from '../core/storage.js';
import { limparHash } from '../app/router.js';
import { codificarEstado, decodificarCodigo, mesclarEstados, resumoProgresso } from '../conta/sincronizar.js';

const LINHAS = [['nome', 'Nome de exibição'], ['niveis', 'Níveis do quiz jogados'], ['respostas', 'Respostas no histórico'], ['missoes', 'Missões concluídas'],
  ['projetos', 'Projetos da Empresa e do Data Center'], ['conquistas', 'Conquistas'], ['simulados', 'Simulados feitos']];

function tabelaComparacao(aqui, la) {
  const a = resumoProgresso(aqui), b = resumoProgresso(la);
  return `<table class="tabela-sinc"><caption>Comparação dos dois progressos</caption>
    <thead><tr><th scope="col">Item</th><th scope="col">Neste aparelho</th><th scope="col">No código</th></tr></thead>
    <tbody>${LINHAS.map(([k, r]) => `<tr><th scope="row">${r}</th><td>${esc(a[k] === '' ? '(sem nome)' : a[k])}</td><td>${esc(b[k] === '' ? '(sem nome)' : b[k])}</td></tr>`).join('')}</tbody></table>`;
}

export default {
  id: 'sincronizar',
  montar(raiz, { store, referencia }, params = []) {
    const controle = new AbortController();
    const on = (el, tipo, fn) => el.addEventListener(tipo, fn, { signal: controle.signal });
    let recebido = null; // estado já validado, aguardando a escolha
    let confirmarSubstituir = false;

    raiz.innerHTML = `<section class="band"><div class="wrap">
      <h2 class="titulo-pagina">Sincronizar progresso</h2>
      <p class="sub">Para continuar no computador o que você fez no celular (ou o contrário): gere um código em um aparelho e cole no outro.
        Não há cadastro nem servidor: o código vai só por onde você mandar (por exemplo, uma mensagem para você mesmo).</p>
      <div class="grade">
        <article class="painel">
          <h3>1. Enviar deste aparelho</h3>
          <p class="motivo">O código contém todo o seu progresso: nome de exibição, respostas, missões e as redes do laboratório
            (inclusive senhas de Wi-Fi inventadas que você digitou lá). Envie só para você mesmo. As configurações deste aparelho não vão junto.</p>
          <div class="acoes"><button class="btn" id="sinc-gerar" type="button">Gerar código</button></div>
          <div id="sinc-saida" hidden>
            <label for="sinc-codigo">Código de sincronização</label>
            <textarea id="sinc-codigo" class="campo sinc-codigo" rows="4" readonly></textarea>
            <p class="meta" id="sinc-tamanho"></p>
            <div class="acoes">
              <button class="btn-sec" id="sinc-copiar" type="button">Copiar código</button>
              <button class="btn-sec" id="sinc-copiar-link" type="button">Copiar link</button>
              <button class="btn-sec" id="sinc-compartilhar" type="button" hidden>Compartilhar link</button>
            </div>
          </div>
          <p id="sinc-msg-envio" role="status"></p>
        </article>
        <article class="painel">
          <h3>2. Receber neste aparelho</h3>
          <form id="sinc-form" novalidate>
            <label for="sinc-entrada">Cole aqui o código ou o link gerado no outro aparelho</label>
            <textarea id="sinc-entrada" class="campo sinc-codigo" rows="4" autocomplete="off" spellcheck="false" aria-describedby="sinc-msg"></textarea>
            <div class="acoes"><button class="btn" type="submit">Ler código</button></div>
          </form>
          <p id="sinc-msg" role="status"></p>
          <div id="sinc-escolha"></div>
        </article>
      </div>
    </div></section>`;
    const $ = s => raiz.querySelector(s);
    const linkDe = codigo => `${location.origin}${location.pathname}#/sincronizar/${codigo}`;
    const avisoEnvio = (t, ruim = false) => { const el = $('#sinc-msg-envio'); el.textContent = t; el.className = ruim ? 'ruim-txt' : 'ok-txt'; };
    const avisoReceb = (t, ruim = false) => { const el = $('#sinc-msg'); el.textContent = t; el.className = ruim ? 'ruim-txt' : 'ok-txt'; };

    async function copiar(texto, rotulo) {
      try { await navigator.clipboard.writeText(texto); avisoEnvio(`${rotulo} copiado.`); }
      catch { const c = $('#sinc-codigo'); c.focus(); c.select(); avisoEnvio('Não foi possível copiar automaticamente. O código está selecionado: copie pelo menu do aparelho.', true); }
    }

    on($('#sinc-gerar'), 'click', async () => {
      const codigo = await codificarEstado(store.obter());
      $('#sinc-codigo').value = codigo;
      $('#sinc-tamanho').textContent = `${codigo.length.toLocaleString('pt-BR')} caracteres. Gere de novo se jogar mais antes de enviar.`;
      $('#sinc-saida').hidden = false;
      $('#sinc-compartilhar').hidden = typeof navigator.share !== 'function';
      avisoEnvio('Código gerado.');
    });
    on($('#sinc-copiar'), 'click', () => copiar($('#sinc-codigo').value, 'Código'));
    on($('#sinc-copiar-link'), 'click', () => copiar(linkDe($('#sinc-codigo').value), 'Link'));
    on($('#sinc-compartilhar'), 'click', async () => {
      try { await navigator.share({ title: 'Progresso do Network Command', text: 'Abra no outro aparelho para levar o progresso.', url: linkDe($('#sinc-codigo').value) }); }
      catch { /* o jogador cancelou o compartilhamento */ }
    });

    function desenharEscolha() {
      const alvo = $('#sinc-escolha');
      if (!recebido) { alvo.innerHTML = ''; return; }
      alvo.innerHTML = `${tabelaComparacao(store.obter(), recebido)}
        <div class="acoes">
          <button class="btn" id="sinc-juntar" type="button">Juntar os dois (recomendado)</button>
          ${confirmarSubstituir
            ? '<span class="ruim-txt">O progresso deste aparelho será trocado pelo do código.</span> <button class="btn btn-perigo" id="sinc-substituir-sim" type="button">Substituir</button> <button class="btn-sec" id="sinc-substituir-nao" type="button">Cancelar</button>'
            : '<button class="btn-sec" id="sinc-substituir" type="button">Substituir o deste aparelho</button>'}
        </div>
        <p class="meta">Juntar mantém o melhor de cada item (maior pontuação, missões concluídas, todas as respostas e conquistas).</p>`;
    }

    async function ler(texto) {
      recebido = null; confirmarSubstituir = false;
      const r = await decodificarCodigo(texto);
      if (r.erro) { desenharEscolha(); avisoReceb(r.erro, true); return; }
      recebido = normalizar(r.estado, referencia);
      desenharEscolha();
      avisoReceb('Código lido. Escolha o que fazer com os dois progressos.');
    }
    on($('#sinc-form'), 'submit', e => { e.preventDefault(); ler($('#sinc-entrada').value); });
    on($('#sinc-escolha'), 'click', e => {
      const id = e.target.id;
      if (!recebido) return;
      if (id === 'sinc-juntar' || id === 'sinc-substituir-sim') {
        const local = store.obter();
        const novo = id === 'sinc-juntar' ? normalizar(mesclarEstados(local, recebido), referencia) : { ...recebido, config: local.config };
        store.substituir(novo);
        recebido = null; desenharEscolha();
        $('#sinc-entrada').value = '';
        avisoReceb(id === 'sinc-juntar' ? 'Pronto: os dois progressos foram juntados neste aparelho.' : 'Pronto: o progresso do código agora está neste aparelho.');
      } else if (id === 'sinc-substituir' || id === 'sinc-substituir-nao') { confirmarSubstituir = id === 'sinc-substituir'; desenharEscolha(); }
    });

    // aberto por link (#/sincronizar/<código>): lê o código e tira ele do endereço e do histórico
    if (params[0]) { $('#sinc-entrada').value = params[0]; limparHash('sincronizar'); ler(params[0]); }
    return () => controle.abort();
  }
};
