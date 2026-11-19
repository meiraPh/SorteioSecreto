// =====================================================================
//  Amigo Oculto — interface
//  Rotas (tudo depois do #):
//    #/                         início
//    #/criar                    criar sorteio
//    #/admin/<codigo>/<token>   painel do organizador
//    #/e/<codigo>               página do grupo (escolher o nome)
//    #/e/<codigo>/p/<id>        abrir o papelzinho / entrar com PIN
// =====================================================================
(function () {
  'use strict';

  const api = window.Api;
  const app = document.getElementById('app');

  let sessao = null;          // { codigo, pid, pin, dados, revelado, aba }
  let acabouDeCriar = null;   // código do evento recém-criado (mostra aviso)

  // ------------------------------------------------------------------
  //  Elementos
  // ------------------------------------------------------------------
  function h(tag, attrs, ...filhos) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const f of filhos.flat(Infinity)) {
      if (f == null || f === false || f === '') continue;
      el.append(f.nodeType ? f : document.createTextNode(String(f)));
    }
    return el;
  }

  // Ícones (traço 1.75, estilo Lucide — licença ISC)
  const ICONES = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    externo: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    cadeado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    chave: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    etiqueta: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    seta: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    voltar: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    atualizar: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    enviar: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    ocultar: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    escudo: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    trocar: '<path d="m8 3-4 4 4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    sortear: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    lixo: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    presente: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    mensagem: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    local: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  };

  function icone(nome, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.75');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = ICONES[nome] || '';
    return s;
  }

  // Marca: um papelzinho dobrado
  function glifo(cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 32 32');
    s.setAttribute('class', cls || 'glifo');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path d="M8 9.5h16v6.2L16 19.5 8 15.7z" fill="currentColor" opacity=".55"/>'
      + '<path d="M8 15.7 16 19.5l8-3.8V23a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 8 23z" fill="currentColor"/>'
      + '<circle cx="16" cy="19.4" r="2.3" fill="var(--latao)"/>';
    return s;
  }

  // ------------------------------------------------------------------
  //  Textos e formatos
  // ------------------------------------------------------------------
  const MSG = {
    rede: 'Não consegui falar com o servidor. Confira a internet e tente de novo.',
    servidor: 'O servidor respondeu com erro.',
    minimo_3: 'Coloque pelo menos 3 participantes.',
    maximo_100: 'O máximo é 100 participantes.',
    nomes_repetidos: 'Tem nome repetido na lista. Diferencie, por exemplo, "João Pai" e "João Filho".',
    nome_invalido: 'Algum nome está vazio ou passa de 40 letras.',
    titulo_vazio: 'Dê um nome para o evento.',
    impossivel: 'Com essas restrições não dá para sortear. Remova alguma restrição e tente de novo.',
    exclusao_invalida: 'Alguma restrição ficou inválida. Remova e adicione de novo.',
    dados_invalidos: 'Algo deu errado com os dados. Recarregue a página e tente de novo.',
    evento_nao_encontrado: 'Sorteio não encontrado. Confira se o link chegou completo.',
    pin_formato: 'O PIN precisa ter 4 números.',
    ja_resgatado: 'Esse nome já foi escolhido. Se é você, entre com o seu PIN. Se não, avise quem organizou.',
    nao_encontrado: 'Participante não encontrado neste sorteio.',
    sem_pin: 'Esse nome ainda não foi escolhido. Volte para a lista e toque no seu nome.',
    acesso_negado: 'Este link de organizador não é válido. Confira se copiou ele inteiro.',
    lista_invalida: 'A lista pode ter até 20 presentes.',
    item_invalido: 'Cada presente precisa de um nome de até 120 letras. A observação vai até 200.',
    link_invalido: 'Um dos links não parece válido. Use o endereço completo da loja, começando com https://',
  };

  function msgErro(r) {
    if (!r) return MSG.rede;
    if (r.erro === 'pin_errado') {
      return `PIN incorreto. ${r.restantes === 1 ? 'Resta 1 tentativa' : `Restam ${r.restantes} tentativas`} antes de um bloqueio de 10 minutos.`;
    }
    if (r.erro === 'bloqueado') return `Muitas tentativas erradas. Tente de novo depois das ${hora(r.ate)}.`;
    if (r.erro === 'servidor' && r.detalhe) return `${MSG.servidor} (${r.detalhe})`;
    return MSG[r.erro] || 'Algo deu errado. Tente de novo.';
  }

  function dataDe(s) {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const semPonto = (s) => s.replace('.', '');
  function dataLonga(s) {
    const d = dataDe(s);
    return d ? d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  }
  function contagem(s) {
    const d = dataDe(s);
    if (!d) return '';
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((d - hoje) / 86400000);
    if (dias > 1) return `Faltam ${dias} dias`;
    if (dias === 1) return 'É amanhã';
    if (dias === 0) return 'É hoje';
    return 'Já aconteceu';
  }
  function hora(iso) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  // "19:30" -> "19h30"; "19:00" -> "19h"
  function horaBR(hhmm) {
    const [hh, mm] = String(hhmm).split(':');
    return `${Number(hh)}h${mm === '00' ? '' : mm}`;
  }
  function quandoTexto(ev) {
    return capital(dataLonga(ev.data)) + (ev.hora ? `, às ${horaBR(ev.hora)}` : '');
  }

  // ------------------------------------------------------------------
  //  Agenda: o evento da troca (nunca leva quem a pessoa tirou)
  // ------------------------------------------------------------------
  const DURACAO_H = 3;   // a troca dura umas 3 horas na agenda
  const dois = (n) => String(n).padStart(2, '0');
  // Data "por fora do fuso": usa os campos UTC só como relógio, para somar horas sem
  // depender do fuso do aparelho.
  function relogio(data, hora, somaH) {
    const [y, m, d] = data.split('-').map(Number);
    const [hh, mm] = (hora || '00:00').split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, hh + (somaH || 0), mm));
  }
  const compacta = (t) => `${t.getUTCFullYear()}${dois(t.getUTCMonth() + 1)}${dois(t.getUTCDate())}`;
  const compactaHora = (t) => `${compacta(t)}T${dois(t.getUTCHours())}${dois(t.getUTCMinutes())}00`;
  function detalhesAgenda(ev) {
    return [
      ev.organizador ? `Amigo oculto organizado por ${ev.organizador}.` : 'Amigo oculto.',
      ev.valor ? `Valor do presente: ${ev.valor}.` : null,
      ev.mensagem || null,
      `Rever o papelzinho: ${linkGrupo(ev.codigo)}`,
    ].filter(Boolean).join('\n');
  }
  function linkGoogleAgenda(ev) {
    const datas = ev.hora
      ? `${compactaHora(relogio(ev.data, ev.hora))}/${compactaHora(relogio(ev.data, ev.hora, DURACAO_H))}`
      : `${compacta(relogio(ev.data))}/${compacta(relogio(ev.data, null, 24))}`;
    const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.titulo, dates: datas, details: detalhesAgenda(ev) });
    if (ev.local) q.set('location', ev.local);
    if (ev.hora) q.set('ctz', 'America/Sao_Paulo');
    return `https://calendar.google.com/calendar/render?${q}`;
  }
  // Arquivo .ics (iPhone e outras agendas). Horário de Brasília, UTC-3 o ano todo.
  function arquivoAgenda(ev) {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
    const dobra = (l) => l.length <= 72 ? l : l.match(/.{1,72}/g).join('\r\n ');
    const agora = new Date();
    const linhas = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Amigo Oculto//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ev.codigo}-${ev.data}@amigo-oculto`,
      `DTSTAMP:${compactaHora(new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), agora.getUTCHours(), agora.getUTCMinutes())))}Z`,
      ...(ev.hora
        ? [`DTSTART:${compactaHora(relogio(ev.data, ev.hora, 3))}Z`, `DTEND:${compactaHora(relogio(ev.data, ev.hora, 3 + DURACAO_H))}Z`]
        : [`DTSTART;VALUE=DATE:${compacta(relogio(ev.data))}`, `DTEND;VALUE=DATE:${compacta(relogio(ev.data, null, 24))}`]),
      `SUMMARY:${esc(ev.titulo)}`,
      ev.local ? `LOCATION:${esc(ev.local)}` : null,
      `DESCRIPTION:${esc(detalhesAgenda(ev))}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).map(dobra);
    return linhas.join('\r\n') + '\r\n';
  }

  function diaHora(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' + hora(iso);
  }
  function linkSeguro(u) {
    try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:'; } catch (e) { return false; }
  }
  function dominio(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function normalizarLink(s) {
    let t = String(s || '').trim();
    if (!t) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = 'https://' + t.replace(/^\/+/, '');
    return t;
  }
  // Tamanhos e preferências ficam num texto só (a coluna do banco é a mesma de antes):
  // uma linha por campo, "Rótulo: valor". Texto antigo, sem rótulo, vira "Outras".
  const CAMISAS = ['PP', 'P', 'M', 'G', 'GG', 'XG'];
  const CAMPOS_TAM = [['camisa', 'Camisa'], ['calca', 'Calça'], ['calcado', 'Calçado'], ['outras', 'Outras']];
  function lerTamanhos(texto) {
    const t = { camisa: '', calca: '', calcado: '', outras: '' };
    const soltas = [];
    for (const linha of String(texto || '').split('\n')) {
      const m = linha.match(/^(Camisa|Calça|Calçado|Outras):\s*(.*)$/);
      if (m) t[CAMPOS_TAM.find(([, r]) => r === m[1])[0]] = m[2].trim();
      else if (linha.trim()) soltas.push(linha.trim());
    }
    if (t.camisa && !CAMISAS.includes(t.camisa)) { soltas.unshift(`Camisa ${t.camisa}`); t.camisa = ''; }
    if (soltas.length) t.outras = [...soltas, t.outras].filter(Boolean).join(' ');
    return t;
  }
  function escreverTamanhos(t) {
    return CAMPOS_TAM.filter(([k]) => t[k]).map(([k, r]) => `${r}: ${t[k]}`).join('\n');
  }

  // Painéis criados ou abertos neste aparelho, para voltar pela página inicial.
  // Fica só neste navegador; se o armazenamento estiver bloqueado, o site funciona igual.
  // No modo demonstração não guarda: os dados somem ao recarregar.
  const CHAVE_PAINEIS = 'amigo-oculto:paineis';
  function paineisSalvos() {
    if (api.modo === 'demo') return [];
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE_PAINEIS) || '[]');
      return Array.isArray(v) ? v.filter((p) => p && /^[0-9a-f]{10}$/.test(p.codigo) && /^[0-9a-f]{36}$/.test(p.token)) : [];
    } catch (e) { return []; }
  }
  function lembrarPainel(codigo, token, titulo) {
    if (api.modo === 'demo') return;
    try {
      const outros = paineisSalvos().filter((p) => p.codigo !== codigo);
      localStorage.setItem(CHAVE_PAINEIS, JSON.stringify([{ codigo, token, titulo: String(titulo || '').slice(0, 80) }, ...outros].slice(0, 5)));
    } catch (e) { /* sem armazenamento: segue sem lembrar */ }
  }
  function esquecerPainel(codigo) {
    try { localStorage.setItem(CHAVE_PAINEIS, JSON.stringify(paineisSalvos().filter((p) => p.codigo !== codigo))); } catch (e) { /* idem */ }
  }

  function baseUrl() { return location.href.split('#')[0]; }
  function linkGrupo(codigo) { return `${baseUrl()}#/e/${codigo}`; }
  function linkAdmin(codigo, token) { return `${baseUrl()}#/admin/${codigo}/${token}`; }
  function proximoNatal() {
    const hoje = new Date();
    const ano = (hoje.getMonth() === 11 && hoje.getDate() > 24) ? hoje.getFullYear() + 1 : hoje.getFullYear();
    return `${ano}-12-24`;
  }
  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  function iniciais(nome) {
    const p = nome.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function avatar(nome, cls) {
    let soma = 0;
    for (const c of nome) soma = (soma * 31 + c.charCodeAt(0)) >>> 0;
    return h('span', { class: `avatar tom-${soma % 5}${cls ? ' ' + cls : ''}`, 'aria-hidden': 'true' }, iniciais(nome));
  }

  // ------------------------------------------------------------------
  //  Avisos rápidos e cópia
  // ------------------------------------------------------------------
  let toastEl = null;
  let toastTimer = null;
  function toast(texto, erro) {
    if (!toastEl) {
      toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(toastEl);
    }
    toastEl.replaceChildren(icone(erro ? 'alerta' : 'check'), h('span', null, texto));
    toastEl.classList.toggle('erro', !!erro);
    void toastEl.offsetWidth;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visivel'), 2400);
  }

  async function copiar(texto, msgOk) {
    let ok = false;
    try { await navigator.clipboard.writeText(texto); ok = true; } catch (e) {
      const ta = h('textarea', { class: 'copia-oculta' });
      ta.value = texto; document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
    }
    if (ok) toast(msgOk || 'Copiado');
    else toast('Não consegui copiar. Selecione o link e copie à mão.', true);
  }

  // Manda o link do painel para a própria pessoa. No celular usa o "Compartilhar" do
  // sistema (a pessoa escolhe a conversa com ela mesma no WhatsApp), sem o link passar
  // pela URL de terceiros. Sem isso, abre o WhatsApp com o texto pronto.
  async function mandarPainelParaMim(titulo, link) {
    const texto = `Link do painel do sorteio "${titulo}". É só seu: não mande no grupo.\n${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Painel do amigo oculto', text: texto }); return; } catch (e) {
        if (e && e.name === 'AbortError') return;   // a pessoa fechou o compartilhar
      }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  }

  // Para a Maria Clara: três toques seguidos no selo da marca mostram um recado.
  let toquesSelo = [];
  function toqueNoSelo() {
    const agora = Date.now();
    toquesSelo = toquesSelo.filter((t) => agora - t < 1500).concat(agora);
    if (toquesSelo.length >= 3) { toquesSelo = []; toast('Este site existe por sua causa, Maria Clara.'); }
  }

  // ------------------------------------------------------------------
  //  Estrutura da página
  // ------------------------------------------------------------------
  function montar(largo, conteudo) {
    app.replaceChildren(...[
      h('header', { class: 'topo' },
        h('div', { class: 'topo-in' + (largo ? ' largo' : '') },
          h('a', { href: '#/', class: 'marca', 'aria-label': 'Amigo Oculto, página inicial' },
            h('span', { class: 'marca-selo', onclick: toqueNoSelo }, glifo()),
            h('span', { class: 'marca-txt' }, 'Amigo ', h('em', null, 'Oculto'))),
          api.modo === 'demo'
            ? h('span', { class: 'pill pill-aviso', title: 'Os dados ficam só nesta aba. Configure o Supabase em config.js para usar de verdade.' }, 'Demonstração')
            : null)),
      h('main', { class: 'pagina' + (largo ? ' largo' : '') }, ...conteudo.filter(Boolean)),
      h('footer', { class: 'rodape' },
        h('div', { class: 'rodape-in' + (largo ? ' largo' : '') },
          icone('escudo'),
          h('span', null, 'O sorteio fica guardado no servidor. Ninguém vê quem tirou quem, nem quem organizou.'))),
    ]);
    window.scrollTo(0, 0);
  }
  const tela = (...c) => montar(false, c);

  function cabecalho(sobre, titulo, sub) {
    return h('div', { class: 'cabecalho' },
      sobre ? h('p', { class: 'sobre' }, sobre) : null,
      h('h1', null, titulo),
      sub ? h('p', { class: 'sub' }, sub) : null);
  }

  function carregando() {
    tela(h('div', { class: 'carregando', role: 'status' }, h('span', { class: 'spinner' }), 'Carregando'));
  }

  function telaErro(texto) {
    tela(
      cabecalho(null, 'Não deu certo'),
      h('section', { class: 'folha' },
        h('div', { class: 'aviso aviso-erro' }, icone('alerta'), h('p', null, texto)),
        h('a', { class: 'btn btn-secundario', href: '#/' }, icone('voltar'), 'Voltar ao início')));
  }

  function convite(ev, qtd, nivel) {
    const d = dataDe(ev.data);
    return h('section', { class: 'folha convite' },
      h('div', { class: 'convite-topo' },
        d ? h('div', { class: 'data-bloco', 'aria-hidden': 'true' },
          h('span', { class: 'data-mes' }, semPonto(d.toLocaleDateString('pt-BR', { month: 'short' }))),
          h('span', { class: 'data-dia' }, String(d.getDate())),
          h('span', { class: 'data-sem' }, semPonto(d.toLocaleDateString('pt-BR', { weekday: 'short' })))) : null,
        h('div', { class: 'convite-titulo' },
          h('p', { class: 'sobre' }, qtd ? `Amigo oculto · ${qtd} pessoas` : 'Amigo oculto'),
          h(nivel || 'h1', { class: 'convite-h' }, ev.titulo),
          d ? h('p', { class: 'convite-quando' }, quandoTexto(ev),
            h('span', { class: 'pill pill-latao' }, contagem(ev.data))) : null)),
      (ev.valor || ev.organizador || ev.local) ? h('dl', { class: 'convite-meta' },
        ev.local ? h('div', null, h('dt', null, icone('local'), 'Local'), h('dd', null, ev.local)) : null,
        ev.valor ? h('div', null, h('dt', null, icone('etiqueta'), 'Valor'), h('dd', null, ev.valor)) : null,
        ev.organizador ? h('div', null, h('dt', null, icone('usuario'), 'Organização'), h('dd', null, ev.organizador)) : null) : null,
      ev.mensagem ? h('blockquote', { class: 'convite-msg' }, ev.mensagem) : null);
  }

  // Papelzinho (frente fechada com selo, dentro com o nome)
  function papel(nome, rodape, extra) {
    return h('div', { class: 'papel-dentro' + (extra ? ' ' + extra : '') },
      h('p', { class: 'sobre' }, 'Você tirou'),
      h('p', { class: 'papel-nome' }, nome || ''),
      h('p', { class: 'papel-rodape' }, rodape));
  }

  // ------------------------------------------------------------------
  //  Início
  // ------------------------------------------------------------------
  function viewInicio() {
    // Para a Maria Clara: tocar no papelzinho da ilustração troca o nome e o recado.
    const cenaPapel = papel('XXXX', 'Segredo até 24 de dezembro', 'cena-papel');
    cenaPapel.addEventListener('click', () => {
      const dedicado = cenaPapel.classList.toggle('dedicado');
      cenaPapel.querySelector('.papel-nome').textContent = dedicado ? 'Maria Clara' : 'XXXX';
      cenaPapel.querySelector('.papel-rodape').textContent = dedicado ? 'Eu tiraria você todo ano.' : 'Segredo até 24 de dezembro';
    });
    const salvos = paineisSalvos();

    montar(true, [
      h('section', { class: 'hero' },
        h('div', { class: 'hero-texto' },
          h('p', { class: 'sobre' }, 'Sorteio de amigo oculto'),
          h('h1', { class: 'hero-h' }, 'Com carinho, ', h('em', null, 'para a Maria Clara.')),
          h('p', { class: 'hero-sub' }, 'Cadastre os nomes, mande um link no grupo e pronto. Cada pessoa abre o próprio papelzinho com um PIN de 4 números, quantas vezes precisar até o dia da troca.'),
          h('div', { class: 'hero-acoes' },
            h('a', { class: 'btn btn-acao btn-g', href: '#/criar' }, 'Criar sorteio', icone('seta')),
            h('span', { class: 'hero-nota' }, 'Sem cadastro e sem aplicativo.')),
          salvos.length ? h('div', { class: 'meus-paineis' },
            h('p', { class: 'hero-nota' }, 'Sorteios que você organiza neste aparelho:'),
            salvos.map((p) => h('a', { class: 'btn btn-fantasma btn-p', href: `#/admin/${p.codigo}/${p.token}` },
              icone('chave'), `Painel de ${p.titulo}`))) : null),
        h('div', { class: 'hero-visual', 'aria-hidden': 'true' },
          h('div', { class: 'cena' },
            h('div', { class: 'cena-capa' }, h('span', { class: 'selo' }, glifo('glifo grande'))),
            cenaPapel,
            h('div', { class: 'cena-pin' }, icone('cadeado'), h('span', null, 'PIN'), h('span', { class: 'cena-pontos' }, '• • • •'))))),

      h('section', { class: 'passos' },
        h('h2', { class: 'secao-h' }, 'Como funciona'),
        h('ol', { class: 'passos-lista' },
          h('li', null, h('span', { class: 'passo-n' }, '1'), h('h3', null, 'Monte a lista'),
            h('p', null, 'Coloque os nomes, a data, o valor e quem não pode tirar quem, como os casais.')),
          h('li', null, h('span', { class: 'passo-n' }, '2'), h('h3', null, 'Mande um link só'),
            h('p', null, 'O sorteio sai na hora. Você compartilha um único link no grupo do WhatsApp.')),
          h('li', null, h('span', { class: 'passo-n' }, '3'), h('h3', null, 'Cada um abre o seu'),
            h('p', null, 'A pessoa toca no próprio nome, cria um PIN e vê quem tirou. Esqueceu? Entra de novo.')))),

      h('section', { class: 'recursos' },
        [
          ['escudo', 'Ninguém vê o resultado', 'Nem quem organiza. O sorteio é feito e guardado no servidor.'],
          ['trocar', 'Casais não se tiram', 'Defina restrições num sentido só ou nos dois.'],
          ['lista', 'Lista de desejos com link', 'Cada um coloca o presente certo, com o link da loja e o tamanho.'],
          ['chave', 'PIN esquecido tem solução', 'Quem organiza libera o nome de novo, e o sorteio continua o mesmo.'],
        ].map(([ic, t, d]) => h('div', { class: 'recurso' },
          h('span', { class: 'recurso-ic' }, icone(ic)),
          h('div', null, h('h3', null, t), h('p', null, d))))),
    ]);
  }

  // ------------------------------------------------------------------
  //  Criar sorteio
  // ------------------------------------------------------------------
  function viewCriar() {
    const st = { nomes: [], regras: [] };

    const inTitulo = h('input', { id: 'f-titulo', maxlength: 80, value: `Amigo Oculto de Natal ${proximoNatal().slice(0, 4)}` });
    const inOrg = h('input', { id: 'f-org', maxlength: 60, placeholder: 'Seu nome', autocomplete: 'given-name' });
    const inData = h('input', { id: 'f-data', type: 'date', value: proximoNatal() });
    const inValor = h('input', { id: 'f-valor', maxlength: 40, placeholder: 'R$ 100' });
    const inHora = h('input', { id: 'f-hora', type: 'time' });
    const inLocal = h('input', { id: 'f-local', maxlength: 120, placeholder: 'Casa da vó' });
    const inMsg = h('textarea', { id: 'f-msg', maxlength: 1000, rows: 3,
      placeholder: 'Troca na ceia do dia 24, na casa da vó. Presente com nota para trocar.' });

    const inNome = h('input', { id: 'f-nome', maxlength: 400, placeholder: 'Nome do participante', autocomplete: 'off', enterkeyhint: 'enter' });
    const chips = h('ul', { class: 'chips', 'aria-live': 'polite' });
    const contador = h('span', { class: 'contador' });
    const avisoNome = h('p', { class: 'msg-erro', role: 'alert' });

    const selDe = h('select', { id: 'f-de', 'aria-label': 'Quem' });
    const selPara = h('select', { id: 'f-para', 'aria-label': 'Não pode tirar' });
    const chkMutua = h('input', { type: 'checkbox', id: 'f-mutua', checked: true });
    const listaRegras = h('ul', { class: 'regras' });
    const avisoRegra = h('p', { class: 'msg-erro', role: 'alert' });

    const chkCorrente = h('input', { type: 'checkbox', id: 'f-corrente', checked: true });
    const resumo = h('p', { class: 'resumo' });
    const erroForm = h('p', { class: 'msg-erro', role: 'alert' });
    const btnSortear = h('button', { class: 'btn btn-acao btn-g btn-bloco', type: 'submit', id: 'btn-sortear' }, icone('sortear'), 'Sortear e gerar o link');

    function addNomes(texto) {
      const partes = texto.split(/[\n,;]+/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
      const repetidos = [], longos = [];
      for (const p of partes) {
        if (p.length > 40) { longos.push(p.slice(0, 18) + '…'); continue; }
        if (st.nomes.some((n) => n.toLowerCase() === p.toLowerCase())) { repetidos.push(p); continue; }
        st.nomes.push(p);
      }
      const avisos = [];
      if (repetidos.length) avisos.push(`${repetidos.join(', ')} já está na lista. Se forem pessoas diferentes, diferencie, por exemplo "João Pai" e "João Filho".`);
      if (longos.length) avisos.push(`Nome com mais de 40 letras: ${longos.join(', ')}`);
      avisoNome.textContent = avisos.join(' ');
      desenharNomes();
    }

    function removerNome(nome) {
      st.nomes = st.nomes.filter((n) => n !== nome);
      st.regras = st.regras.filter((r) => r.de !== nome && r.para !== nome);
      desenharNomes();
    }

    function atualizarResumo() {
      const n = st.nomes.length;
      const partes = [plural(n, 'pessoa', 'pessoas')];
      if (st.regras.length) partes.push(plural(st.regras.length, 'restrição', 'restrições'));
      partes.push(chkCorrente.checked ? 'em corrente' : 'sorteio livre');
      resumo.textContent = partes.join(' · ');
    }

    function desenharNomes() {
      chips.replaceChildren(...st.nomes.map((n) => h('li', { class: 'chip' }, avatar(n, 'avatar-p'), h('span', null, n),
        h('button', { type: 'button', class: 'chip-x', 'aria-label': `Remover ${n}`, onclick: () => removerNome(n) }, icone('x')))));
      const qtd = st.nomes.length;
      contador.textContent = qtd < 3 ? `${qtd} de no mínimo 3` : plural(qtd, 'pessoa', 'pessoas');
      contador.classList.toggle('ok', qtd >= 3);
      const opcoes = (sel, vazio) => {
        const atual = sel.value;
        sel.replaceChildren(h('option', { value: '' }, vazio), ...st.nomes.map((n) => h('option', { value: n }, n)));
        if (st.nomes.includes(atual)) sel.value = atual;
      };
      opcoes(selDe, 'Quem');
      opcoes(selPara, 'Não tira');
      desenharRegras();
    }

    function desenharRegras() {
      listaRegras.replaceChildren(...st.regras.map((r, i) => h('li', { class: 'regra' },
        h('span', { class: 'regra-nomes' }, r.de, icone(r.mutua ? 'trocar' : 'seta', 'regra-ic'), r.para),
        h('span', { class: 'regra-tipo' }, r.mutua ? 'nos dois sentidos' : 'só nesse sentido'),
        h('button', { type: 'button', class: 'btn-icone', 'aria-label': `Remover restrição entre ${r.de} e ${r.para}`,
          onclick: () => { st.regras.splice(i, 1); desenharRegras(); } }, icone('x')))));
      atualizarResumo();
    }

    function addRegra() {
      avisoRegra.textContent = '';
      const de = selDe.value, para = selPara.value, mutua = chkMutua.checked;
      if (!de || !para) { avisoRegra.textContent = 'Escolha as duas pessoas.'; return; }
      if (de === para) { avisoRegra.textContent = 'Ninguém tira o próprio nome. Essa regra já vale para todos.'; return; }
      const existe = st.regras.some((r) => (r.de === de && r.para === para) || (r.mutua && r.de === para && r.para === de));
      if (existe) { avisoRegra.textContent = 'Essa restrição já existe.'; return; }
      st.regras.push({ de, para, mutua });
      selDe.value = ''; selPara.value = '';
      desenharRegras();
    }

    function exemplo() {
      inOrg.value = 'Pedro';
      inValor.value = 'R$ 100';
      inMsg.value = 'Troca na ceia do dia 24, na casa da vó. Presente com nota para trocar.';
      st.nomes = []; st.regras = [];
      addNomes('Vó Lúcia, Vô Antônio, Tia Rose, Tio Marcos, Júlia, Rafael, Camila, Pedro');
      st.regras.push({ de: 'Vó Lúcia', para: 'Vô Antônio', mutua: true }, { de: 'Tia Rose', para: 'Tio Marcos', mutua: true });
      desenharRegras();
    }

    function addDoCampo() {
      if (inNome.value.trim()) { addNomes(inNome.value); inNome.value = ''; }
      inNome.focus();
    }

    async function enviar(evt) {
      evt.preventDefault();
      if (inNome.value.trim()) { addNomes(inNome.value); inNome.value = ''; }
      erroForm.textContent = '';
      if (!inTitulo.value.trim()) { erroForm.textContent = MSG.titulo_vazio; inTitulo.focus(); return; }
      if (st.nomes.length < 3) { erroForm.textContent = MSG.minimo_3; inNome.focus(); return; }

      const idx = (n) => st.nomes.indexOf(n);
      const pares = new Set();
      for (const r of st.regras) {
        pares.add(`${idx(r.de)}:${idx(r.para)}`);
        if (r.mutua) pares.add(`${idx(r.para)}:${idx(r.de)}`);
      }
      const exclusoes = [...pares].map((p) => p.split(':').map(Number));

      btnSortear.disabled = true;
      btnSortear.replaceChildren(h('span', { class: 'spinner spinner-claro' }), 'Sorteando');
      const r = await api.criarEvento({
        titulo: inTitulo.value.trim(), organizador: inOrg.value.trim(), data: inData.value || null,
        valor: inValor.value.trim(), mensagem: inMsg.value.trim(), corrente: chkCorrente.checked,
        hora: inHora.value || null, local: inLocal.value.trim(),
        participantes: st.nomes, exclusoes,
      });
      if (!r || !r.ok) {
        btnSortear.disabled = false;
        btnSortear.replaceChildren(icone('sortear'), 'Sortear e gerar o link');
        erroForm.textContent = msgErro(r);
        return;
      }
      acabouDeCriar = r.codigo;
      location.hash = `#/admin/${r.codigo}/${r.token}`;
    }

    inNome.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addDoCampo(); } });
    inNome.addEventListener('paste', () => setTimeout(() => {
      if (/[\n,;]/.test(inNome.value)) { addNomes(inNome.value); inNome.value = ''; }
    }, 0));
    chkCorrente.addEventListener('change', atualizarResumo);

    const campo = (id, rotulo, el, dica) => h('div', { class: 'campo' },
      h('label', { for: id }, rotulo), el, dica ? h('p', { class: 'dica' }, dica) : null);

    tela(
      cabecalho('Novo sorteio', 'Monte o amigo oculto', 'Depois do sorteio a lista de nomes não muda. O resultado fica guardado e ninguém consegue vê-lo, nem você.'),
      h('form', { class: 'form-criar', onsubmit: enviar, novalidate: true },
        h('section', { class: 'folha' },
          h('header', { class: 'folha-cab' }, h('span', { class: 'etapa' }, '1'), h('h2', null, 'O evento')),
          campo('f-titulo', 'Nome do evento', inTitulo),
          h('div', { class: 'grade-2' },
            campo('f-data', 'Data da troca', inData),
            campo('f-valor', 'Valor do presente', inValor)),
          h('div', { class: 'grade-2' },
            campo('f-hora', ['Horário ', h('span', { class: 'opcional' }, 'opcional')], inHora),
            campo('f-local', ['Local ', h('span', { class: 'opcional' }, 'opcional')], inLocal)),
          campo('f-org', 'Quem organiza', inOrg, 'Aparece para a família na hora de pedir ajuda com o PIN.'),
          campo('f-msg', 'Recado para todos', inMsg)),

        h('section', { class: 'folha' },
          h('header', { class: 'folha-cab' }, h('span', { class: 'etapa' }, '2'), h('h2', null, 'Participantes'), contador,
            api.modo === 'demo' ? h('button', { type: 'button', class: 'btn btn-fantasma btn-p cab-acao', onclick: exemplo }, 'Preencher exemplo') : null),
          h('div', { class: 'campo' },
            h('label', { for: 'f-nome' }, 'Adicionar nome'),
            h('div', { class: 'linha-add' }, inNome,
              h('button', { type: 'button', class: 'btn btn-secundario', onclick: addDoCampo }, icone('mais'), 'Adicionar')),
            h('p', { class: 'dica' }, 'Aperte Enter depois de cada nome, ou cole vários separados por vírgula.')),
          avisoNome, chips),

        h('section', { class: 'folha' },
          h('header', { class: 'folha-cab' }, h('span', { class: 'etapa' }, '3'), h('h2', null, 'Quem não pode tirar quem')),
          h('p', { class: 'dica dica-topo' }, 'Opcional. Útil para casais, ou para não repetir o par do ano passado.'),
          h('div', { class: 'regra-form' }, selDe, h('span', { class: 'regra-meio' }, icone('trocar')), selPara),
          h('div', { class: 'regra-rodape' },
            h('label', { class: 'interruptor', for: 'f-mutua' }, chkMutua, h('span', { class: 'trilho', 'aria-hidden': 'true' }), h('span', null, 'Nos dois sentidos')),
            h('button', { type: 'button', class: 'btn btn-fantasma btn-p', id: 'btn-regra', onclick: addRegra }, icone('mais'), 'Adicionar restrição')),
          avisoRegra, listaRegras),

        h('section', { class: 'folha' },
          h('header', { class: 'folha-cab' }, h('span', { class: 'etapa' }, '4'), h('h2', null, 'Formato')),
          h('label', { class: 'interruptor interruptor-g', for: 'f-corrente' }, chkCorrente, h('span', { class: 'trilho', 'aria-hidden': 'true' }),
            h('span', null, h('strong', null, 'Sorteio em corrente'),
              h('span', { class: 'dica' }, 'Forma uma roda única, A tira B, B tira C, até voltar ao A. Ninguém fica em par fechado, e na ceia a entrega segue em sequência.')))),

        h('section', { class: 'folha folha-final' },
          resumo, erroForm, btnSortear))
    );
    desenharNomes();
  }

  // ------------------------------------------------------------------
  //  Painel do organizador
  // ------------------------------------------------------------------
  async function viewAdmin(codigo, token) {
    carregando();
    const r = await api.painel(codigo, token);
    if (!r || !r.ok) {
      if (r && r.erro === 'acesso_negado') esquecerPainel(codigo);
      return telaErro(msgErro(r));
    }
    lembrarPainel(codigo, token, r.evento.titulo);
    const novo = acabouDeCriar === codigo;
    acabouDeCriar = null;
    desenharAdmin(codigo, token, r, novo);
  }

  function desenharAdmin(codigo, token, r, novo, manterRolagem) {
    const ev = r.evento;
    const ps = r.participantes.slice().sort(porNome);
    const n = ps.length;
    const feitos = ps.filter((p) => p.resgatado_em).length;
    const link = linkGrupo(codigo);
    const textoWhats = `*${ev.titulo}*\n\nO sorteio do amigo oculto já foi feito. Abra o link, toque no SEU nome e crie um PIN de 4 números para ver quem você tirou. Dá para rever quando quiser.\n\n${link}`
      + (ev.data ? `\n\nTroca: ${dataLonga(ev.data)}` : '') + (ev.valor ? `\nValor: ${ev.valor}` : '');
    const erroAdmin = h('p', { class: 'msg-erro', role: 'alert' });

    function linha(p) {
      let pill;
      if (p.bloqueado) pill = h('span', { class: 'pill pill-erro' }, icone('cadeado'), 'Bloqueado');
      else if (p.resgatado_em) pill = h('span', { class: 'pill pill-ok' }, icone('check'), 'Escolheu');
      else pill = h('span', { class: 'pill pill-neutro' }, icone('relogio'), 'Pendente');

      let acao = null;
      if (p.resgatado_em || p.bloqueado) {
        acao = h('button', { type: 'button', class: 'btn btn-fantasma btn-p' }, 'Redefinir PIN');
        let armado = false, timer;
        acao.addEventListener('click', async () => {
          if (!armado) {
            armado = true; acao.textContent = 'Confirmar'; acao.classList.add('btn-perigo');
            timer = setTimeout(() => { armado = false; acao.textContent = 'Redefinir PIN'; acao.classList.remove('btn-perigo'); }, 4000);
            return;
          }
          clearTimeout(timer);
          acao.disabled = true; acao.textContent = 'Redefinindo';
          const rr = await api.resetarPin(codigo, token, p.id);
          if (!rr || !rr.ok) { acao.disabled = false; acao.textContent = 'Redefinir PIN'; erroAdmin.textContent = msgErro(rr); return; }
          const np = await api.painel(codigo, token);
          if (np && np.ok) desenharAdmin(codigo, token, np, false, true);
          toast(`${p.nome} já pode criar um PIN novo`);
        });
      }
      return h('li', { class: 'pessoa-linha' },
        avatar(p.nome),
        h('div', { class: 'pessoa-info' },
          h('p', { class: 'pessoa-nome' }, p.nome),
          h('p', { class: 'pessoa-sub' }, pill,
            p.resgatado_em && !p.bloqueado ? h('span', null, diaHora(p.resgatado_em)) : null,
            p.lista_pronta ? h('span', { class: 'com-lista' }, icone('lista'), 'lista pronta') : null)),
        acao);
    }

    const btnCopiar = h('button', { type: 'button', class: 'btn-icone btn-icone-campo', 'aria-label': 'Copiar link do grupo', onclick: () => copiar(link, 'Link do grupo copiado') }, icone('copiar'));
    const rolagem = window.scrollY;

    tela(
      cabecalho('Painel do organizador', ev.titulo),
      novo ? h('div', { class: 'aviso aviso-ok', role: 'status' }, icone('check'),
        h('p', null, h('strong', null, 'Sorteio feito. '), 'O resultado está guardado e ninguém consegue vê-lo, nem você. Agora é só mandar o link no grupo.')) : null,

      h('section', { class: 'folha' },
        h('div', { class: 'placar' },
          h('p', { class: 'placar-n' }, h('span', null, String(feitos)), h('span', { class: 'placar-de' }, ` de ${n}`)),
          h('p', { class: 'placar-txt' }, feitos === n ? 'Todos já abriram o papelzinho.' : 'já abriram o papelzinho'),
          h('button', { type: 'button', class: 'btn btn-fantasma btn-p placar-at', onclick: () => viewAdmin(codigo, token) }, icone('atualizar'), 'Atualizar')),
        h('div', { class: 'segmentos', role: 'img', 'aria-label': `${feitos} de ${n} já escolheram` },
          ps.slice().sort((a, b) => (b.resgatado_em ? 1 : 0) - (a.resgatado_em ? 1 : 0)).map((p) => h('span', { class: p.resgatado_em ? 'cheio' : '' })))),

      h('section', { class: 'folha' },
        h('h2', null, 'Convide a família'),
        h('p', { class: 'dica dica-topo' }, 'Mande este link no grupo. Cada pessoa toca no próprio nome.'),
        h('div', { class: 'campo-link' },
          h('input', { id: 'link-grupo', readonly: true, value: link, 'aria-label': 'Link do grupo', onfocus: (e) => e.target.select() }),
          btnCopiar),
        h('div', { class: 'acoes-2' },
          h('a', { class: 'btn btn-primario', id: 'btn-whats', href: 'https://wa.me/?text=' + encodeURIComponent(textoWhats), target: '_blank', rel: 'noopener' }, icone('mensagem'), 'Enviar no WhatsApp'),
          h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => copiar(link, 'Link do grupo copiado') }, icone('copiar'), 'Copiar link'))),

      h('div', { class: 'aviso aviso-latao' }, icone('chave'),
        h('div', null,
          h('p', null, h('strong', null, 'Guarde o endereço deste painel. '), 'É por ele que você acompanha a família e libera quem esquecer o PIN. Não mande no grupo.',
            api.modo === 'demo' ? null : ' Este aparelho também guarda o painel na página inicial.'),
          h('div', { class: 'aviso-acoes' },
            h('button', { type: 'button', class: 'btn btn-fantasma btn-p', onclick: () => copiar(linkAdmin(codigo, token), 'Link do painel copiado') }, icone('copiar'), 'Copiar link do painel'),
            h('button', { type: 'button', class: 'btn btn-fantasma btn-p', id: 'btn-painel-mim', onclick: () => mandarPainelParaMim(ev.titulo, linkAdmin(codigo, token)) }, icone('enviar'), 'Mandar para mim')))),

      h('section', { class: 'folha' },
        h('h2', null, 'Participantes'),
        erroAdmin,
        h('ul', { class: 'pessoas' }, ps.map(linha)),
        h('p', { class: 'dica dica-pe' }, 'Alguém esqueceu o PIN? Use Redefinir PIN. O nome fica livre para a pessoa criar um PIN novo, e o amigo oculto dela continua o mesmo.')),

      convite(ev, n, 'h2')
    );
    if (manterRolagem) window.scrollTo(0, rolagem);
  }

  // ------------------------------------------------------------------
  //  Página do grupo
  // ------------------------------------------------------------------
  async function viewEvento(codigo) {
    carregando();
    const r = await api.eventoPublico(codigo);
    if (!r || !r.ok) return telaErro(msgErro(r));
    const ps = r.participantes.slice().sort(porNome);
    tela(
      convite(r.evento, ps.length),
      h('section', { class: 'bloco-nomes' },
        h('h2', { class: 'secao-h' }, 'Quem é você?'),
        h('p', { class: 'dica dica-topo' }, 'Toque no seu nome. Na primeira vez você cria um PIN de 4 números, e com ele pode rever quem tirou sempre que quiser.'),
        h('ul', { class: 'folha lista-nomes' }, ps.map((p) => h('li', null,
          h('a', { class: 'nome-linha' + (p.resgatado ? ' escolhido' : ''), href: `#/e/${codigo}/p/${p.id}` },
            avatar(p.nome),
            h('span', { class: 'nome-txt' }, p.nome),
            p.resgatado
              ? h('span', { class: 'nome-status' }, icone('cadeado'), 'Entrar com PIN')
              : h('span', { class: 'nome-status livre' }, 'Sou eu', icone('chevron'))))))));
  }

  // ------------------------------------------------------------------
  //  PIN em quatro caixas
  // ------------------------------------------------------------------
  function campoPin(id, rotulo, auto) {
    const caixas = [0, 1, 2, 3].map((i) => h('input', {
      id: i === 0 ? id : `${id}-${i + 1}`, class: 'pin-caixa', type: 'password', inputmode: 'numeric',
      maxlength: 1, autocomplete: i === 0 ? auto : 'off', 'aria-label': `${rotulo}, dígito ${i + 1} de 4`,
    }));
    const grupo = h('div', { class: 'pin', role: 'group', 'aria-label': rotulo }, caixas);
    const valor = () => caixas.map((c) => c.value).join('');
    const marcar = () => caixas.forEach((c) => c.classList.toggle('cheia', !!c.value));
    function distribuir(v, desde) {
      for (let k = 0; k < v.length && desde + k < 4; k++) caixas[desde + k].value = v[k];
      caixas[Math.min(3, desde + v.length)].focus();
      marcar();
    }
    caixas.forEach((c, i) => {
      c.addEventListener('input', () => {
        const v = c.value.replace(/\D/g, '');
        if (v.length > 1) { distribuir(v, i); return; }
        c.value = v;
        marcar();
        if (v && i < 3) caixas[i + 1].focus();
      });
      c.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !c.value && i > 0) { e.preventDefault(); caixas[i - 1].value = ''; caixas[i - 1].focus(); marcar(); }
        else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); caixas[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && i < 3) { e.preventDefault(); caixas[i + 1].focus(); }
      });
      c.addEventListener('paste', (e) => {
        const t = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '');
        if (t) { e.preventDefault(); distribuir(t.slice(0, 4), i); }
      });
      c.addEventListener('focus', () => c.select());
    });
    return {
      el: grupo, valor,
      focar: () => caixas[0].focus(),
      limpar: () => { caixas.forEach((c) => { c.value = ''; }); marcar(); caixas[0].focus(); },
      erro: (sim) => grupo.classList.toggle('pin-erro', !!sim),
    };
  }

  // ------------------------------------------------------------------
  //  Escolher o nome / entrar com PIN
  // ------------------------------------------------------------------
  async function viewPessoa(codigo, pid) {
    if (sessao && sessao.pid === pid && sessao.dados) return viewResultado();
    carregando();
    const r = await api.eventoPublico(codigo);
    if (!r || !r.ok) return telaErro(msgErro(r));
    const p = r.participantes.find((x) => x.id === pid);
    if (!p) return telaErro(MSG.nao_encontrado);
    if (p.resgatado) formEntrar(codigo, r.evento, p);
    else formCriarPin(codigo, r.evento, p);
  }

  function cabecaPessoa(ev, p, titulo) {
    return h('div', { class: 'pessoa-cab' }, avatar(p.nome, 'avatar-g'),
      h('div', null, h('p', { class: 'sobre' }, ev.titulo), h('h1', null, titulo)));
  }

  function formCriarPin(codigo, ev, p) {
    const pin1 = campoPin('pin1', 'Crie um PIN', 'new-password');
    const pin2 = campoPin('pin2', 'Repita o PIN', 'new-password');
    const chk = h('input', { type: 'checkbox', id: 'sou-eu' });
    const erro = h('p', { class: 'msg-erro', role: 'alert' });
    const rotuloBtn = () => [icone('presente'), 'Abrir meu papelzinho'];
    const btn = h('button', { class: 'btn btn-acao btn-g btn-bloco', type: 'submit', id: 'btn-continuar' }, rotuloBtn());

    async function enviar(e) {
      e.preventDefault();
      erro.textContent = ''; pin1.erro(false); pin2.erro(false);
      if (!/^\d{4}$/.test(pin1.valor())) { erro.textContent = MSG.pin_formato; pin1.erro(true); pin1.focar(); return; }
      if (pin1.valor() !== pin2.valor()) { erro.textContent = 'Os dois PINs estão diferentes. Digite de novo.'; pin2.erro(true); pin2.limpar(); return; }
      if (!chk.checked) { erro.textContent = `Confirme que você é ${p.nome}.`; return; }
      btn.disabled = true; btn.replaceChildren(h('span', { class: 'spinner spinner-claro' }), 'Abrindo');
      const r = await api.resgatar(p.id, pin1.valor());
      if (!r || !r.ok) {
        btn.disabled = false; btn.replaceChildren(...rotuloBtn());
        if (r && r.erro === 'ja_resgatado') { formEntrar(codigo, ev, p, MSG.ja_resgatado); return; }
        erro.textContent = msgErro(r);
        return;
      }
      sessao = { codigo, pid: p.id, pin: pin1.valor(), dados: r, revelado: false, aba: 'amigo' };
      viewResultado();
    }

    tela(
      h('form', { class: 'folha folha-pin', onsubmit: enviar, novalidate: true },
        cabecaPessoa(ev, p, `Olá, ${p.nome}`),
        h('p', { class: 'texto' }, 'Crie um PIN de 4 números. Você vai usá-lo para ver seu amigo oculto de novo sempre que quiser.'),
        h('div', { class: 'campo' }, h('label', { for: 'pin1' }, 'Crie um PIN'), pin1.el),
        h('div', { class: 'campo' }, h('label', { for: 'pin2' }, 'Repita o PIN'), pin2.el),
        h('p', { class: 'dica' }, 'Evite 1234 e datas de aniversário. A família toda conhece.'),
        h('label', { class: 'confirma', for: 'sou-eu' }, chk, h('span', null, `Sou ${p.nome}`)),
        erro, btn,
        h('a', { class: 'link-voltar', href: `#/e/${codigo}` }, icone('voltar'), 'Não é você? Volte para a lista'))
    );
    pin1.focar();
  }

  function formEntrar(codigo, ev, p, aviso) {
    const pin = campoPin('pin', 'Seu PIN', 'current-password');
    const erro = h('p', { class: 'msg-erro', role: 'alert' }, aviso || '');
    const btn = h('button', { class: 'btn btn-primario btn-g btn-bloco', type: 'submit', id: 'btn-continuar' }, 'Entrar');

    async function enviar(e) {
      e.preventDefault();
      erro.textContent = ''; pin.erro(false);
      if (!/^\d{4}$/.test(pin.valor())) { erro.textContent = MSG.pin_formato; pin.erro(true); pin.focar(); return; }
      btn.disabled = true; btn.replaceChildren(h('span', { class: 'spinner spinner-claro' }), 'Entrando');
      const r = await api.entrar(p.id, pin.valor());
      if (!r || !r.ok) {
        btn.disabled = false; btn.replaceChildren('Entrar');
        erro.textContent = msgErro(r);
        pin.erro(true);
        pin.limpar();
        return;
      }
      sessao = { codigo, pid: p.id, pin: pin.valor(), dados: r, revelado: false, aba: 'amigo' };
      viewResultado();
    }

    tela(
      h('form', { class: 'folha folha-pin', onsubmit: enviar, novalidate: true },
        cabecaPessoa(ev, p, `Olá de novo, ${p.nome}`),
        h('div', { class: 'campo' }, h('label', { for: 'pin' }, 'Digite seu PIN'), pin.el),
        erro, btn,
        h('div', { class: 'aviso aviso-neutro' }, icone('chave'),
          h('p', null, 'Esqueceu o PIN? Peça para ', h('strong', null, ev.organizador || 'quem organizou'),
            ' redefinir no painel. Seu amigo oculto continua o mesmo.')),
        h('a', { class: 'link-voltar', href: `#/e/${codigo}` }, icone('voltar'), 'Não é você? Volte para a lista'))
    );
    pin.focar();
  }

  // ------------------------------------------------------------------
  //  Depois de entrar
  // ------------------------------------------------------------------
  function viewResultado() {
    const d = sessao.dados;
    const abas = [['amigo', 'Quem eu tirei', 'presente'], ['lista', 'Minha lista', 'lista']];
    const corpo = h('div', { class: 'aba-corpo', role: 'tabpanel', 'aria-labelledby': `aba-${sessao.aba}` });

    const nav = h('div', { class: 'abas', role: 'tablist', 'aria-label': 'Seções' }, abas.map(([id, rotulo, ic]) => h('button', {
      type: 'button', role: 'tab', class: 'aba', id: `aba-${id}`, 'aria-selected': String(sessao.aba === id),
      onclick: () => { if (sessao.aba !== id) { sessao.aba = id; viewResultado(); } },
    }, icone(ic), rotulo)));

    if (sessao.aba === 'lista') corpo.append(...abaMinhaLista(d));
    else corpo.append(...abaAmigo(d));

    const rolagem = window.scrollY;
    tela(
      h('div', { class: 'pessoa-cab pessoa-cab-solta' }, avatar(d.eu.nome, 'avatar-g'),
        h('div', null, h('p', { class: 'sobre' }, d.evento.titulo), h('h1', null, `Olá, ${d.eu.nome}`))),
      nav, corpo,
      h('div', { class: 'sair' },
        h('button', { type: 'button', class: 'btn btn-fantasma btn-p', id: 'btn-sair',
          onclick: () => { const c = sessao.codigo; sessao = null; location.hash = `#/e/${c}`; } }, icone('sair'), 'Sair')));
    if (sessao.manterRolagem) { window.scrollTo(0, rolagem); sessao.manterRolagem = false; }
  }

  function abaAmigo(d) {
    const quando = d.evento.data ? `Segredo até ${dataLonga(d.evento.data)}` : 'Segredo até a troca de presentes';
    const aberto = !!sessao.revelado;

    const dentro = papel(aberto ? d.amigo.nome : '', quando);
    const capa = h('button', { type: 'button', class: 'papel-capa', id: 'abrir-papel', 'aria-label': 'Abrir o papelzinho e ver quem você tirou' },
      h('span', { class: 'selo' }, glifo('glifo grande')),
      h('span', { class: 'capa-titulo' }, 'Toque para abrir'),
      h('span', { class: 'capa-sub' }, 'Confira se ninguém está olhando a sua tela'));
    const papelzinho = h('div', { class: 'papelzinho' + (aberto ? ' aberto' : '') }, dentro, aberto ? null : capa);

    capa.addEventListener('click', () => {
      dentro.querySelector('.papel-nome').textContent = d.amigo.nome;
      capa.disabled = true;
      papelzinho.classList.add('abrindo');
      const pronto = () => { sessao.revelado = true; viewResultado(); };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) pronto();
      else setTimeout(pronto, 950);
    });

    const out = [h('section', { class: 'revelacao' }, papelzinho,
      aberto ? h('button', { type: 'button', class: 'btn btn-fantasma btn-p', id: 'btn-esconder',
        onclick: () => { sessao.revelado = false; viewResultado(); } }, icone('ocultar'), 'Esconder o nome') : null)];

    if (aberto) {
      const desejos = d.amigo.desejos || [];
      out.push(h('section', { class: 'folha' },
        h('p', { class: 'sobre' }, 'Lista de desejos'),
        h('h2', null, `O que ${d.amigo.nome} gostaria de ganhar`),
        d.amigo.tamanhos ? blocoTamanhos(d.amigo.tamanhos) : null,
        desejos.length
          ? h('ol', { class: 'desejos' }, desejos.map(itemDesejo))
          : h('div', { class: 'vazio' }, icone('lista'),
            h('p', null, `${d.amigo.nome} ainda não montou a lista. Dê uma olhada de novo mais perto da troca.`))));
    }
    if (d.evento.data) out.push(blocoAgenda(d.evento));
    return out;
  }

  // "Adicionar à agenda": um toque abre o evento preenchido; salvar é com o app de agenda.
  function blocoAgenda(ev) {
    return h('section', { class: 'folha agenda' },
      h('p', { class: 'sobre' }, 'Dia da troca'),
      h('h2', null, quandoTexto(ev)),
      ev.local ? h('p', { class: 'dica' }, ev.local) : null,
      h('div', { class: 'acoes-2' },
        h('a', { class: 'btn btn-secundario', id: 'btn-google-agenda', href: linkGoogleAgenda(ev), target: '_blank', rel: 'noopener noreferrer' },
          icone('calendario'), 'Google Agenda'),
        h('a', { class: 'btn btn-secundario', id: 'btn-ics', download: 'amigo-oculto.ics',
          href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(arquivoAgenda(ev)) },
          icone('calendario'), 'Agenda do iPhone')));
  }

  function blocoTamanhos(texto) {
    const t = lerTamanhos(texto);
    const medidas = [['Camisa', t.camisa], ['Calça', t.calca], ['Calçado', t.calcado]]
      .filter(([, v]) => v).map(([r, v]) => `${r} ${v}`).join(' · ');
    return h('div', { class: 'tamanhos' },
      h('span', { class: 'tamanhos-r' }, 'Tamanhos e preferências'),
      medidas ? h('p', null, medidas) : null,
      t.outras ? h('p', null, t.outras) : null);
  }

  function itemDesejo(x, i) {
    const temLink = x.link && linkSeguro(x.link);
    return h('li', { class: 'desejo' },
      h('span', { class: 'desejo-n' }, String(i + 1).padStart(2, '0')),
      h('div', { class: 'desejo-corpo' },
        h('p', { class: 'desejo-t' }, x.descricao),
        x.obs ? h('p', { class: 'desejo-obs' }, x.obs) : null,
        temLink ? h('p', { class: 'desejo-dom' }, icone('link'), dominio(x.link)) : null),
      temLink ? h('a', { class: 'btn btn-secundario btn-p desejo-btn', href: x.link, target: '_blank', rel: 'noopener noreferrer nofollow' }, 'Ver na loja', icone('externo')) : null);
  }

  function abaMinhaLista(d) {
    const itens = (d.eu.desejos || []).map((x) => ({ descricao: x.descricao, link: x.link || '', obs: x.obs || '' }));
    if (!itens.length) itens.push({ descricao: '', link: '', obs: '' });
    const tamAtual = lerTamanhos(d.eu.tamanhos);
    const selCamisa = h('select', { id: 't-camisa' },
      h('option', { value: '' }, '—'), CAMISAS.map((c) => h('option', { value: c }, c)));
    selCamisa.value = tamAtual.camisa;
    const numero = (id, valor, exemplo) => h('input', { id, value: valor, inputmode: 'numeric', maxlength: 3, placeholder: exemplo, autocomplete: 'off' });
    const inCalca = numero('t-calca', tamAtual.calca, '40');
    const inCalcado = numero('t-calcado', tamAtual.calcado, '38');
    const inOutras = h('input', { id: 't-outras', value: tamAtual.outras, maxlength: 200, placeholder: 'Não gosto de perfume doce' });
    const listaEl = h('div', { class: 'itens' });
    const erro = h('p', { class: 'msg-erro', role: 'alert' });
    const btnSalvar = h('button', { type: 'submit', class: 'btn btn-primario btn-g btn-bloco', id: 'btn-salvar' }, 'Salvar lista');
    const btnAdd = h('button', { type: 'button', class: 'btn btn-fantasma btn-bloco', id: 'btn-add-item' }, icone('mais'), 'Adicionar presente');

    function desenhar() {
      listaEl.replaceChildren(...itens.map((it, i) => {
        const campo = (k, attrs) => h('input', Object.assign({ value: it[k], oninput: (e) => { it[k] = e.target.value; } }, attrs));
        return h('div', { class: 'item' },
          h('div', { class: 'item-cab' },
            h('span', { class: 'desejo-n' }, String(i + 1).padStart(2, '0')),
            h('button', { type: 'button', class: 'btn-icone', 'aria-label': `Remover presente ${i + 1}`,
              onclick: () => { itens.splice(i, 1); desenhar(); } }, icone('lixo'))),
          h('div', { class: 'campo' }, h('label', { for: `d-${i}` }, 'Presente'),
            campo('descricao', { id: `d-${i}`, maxlength: 120, placeholder: 'Livro Torto Arado' })),
          h('div', { class: 'campo' }, h('label', { for: `l-${i}` }, 'Link da loja ', h('span', { class: 'opcional' }, 'opcional')),
            h('div', { class: 'campo-ic' }, icone('link'),
              campo('link', { id: `l-${i}`, type: 'url', inputmode: 'url', maxlength: 600, placeholder: 'Cole o link do produto' }))),
          h('div', { class: 'campo' }, h('label', { for: `o-${i}` }, 'Observação ', h('span', { class: 'opcional' }, 'opcional')),
            campo('obs', { id: `o-${i}`, maxlength: 200, placeholder: 'Cor azul, tamanho P, qualquer edição' })));
      }));
      btnAdd.hidden = itens.length >= 20;
    }

    btnAdd.addEventListener('click', () => {
      itens.push({ descricao: '', link: '', obs: '' });
      desenhar();
      const todos = listaEl.querySelectorAll('.item');
      const ultimo = todos[todos.length - 1];
      if (ultimo) ultimo.querySelector('input').focus();
    });

    async function salvar(e) {
      e.preventDefault();
      erro.textContent = '';
      const limpos = [];
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        const descricao = it.descricao.trim(), obs = it.obs.trim();
        const link = normalizarLink(it.link);
        if (!descricao && !link && !obs) continue;
        if (!descricao) { erro.textContent = `Dê um nome para o presente ${i + 1}, por exemplo "Fone de ouvido".`; return; }
        if (link && !linkSeguro(link)) { erro.textContent = `O link do presente ${i + 1} não parece válido. Copie o endereço completo da loja.`; return; }
        limpos.push({ descricao, link: link || null, obs: obs || null });
      }
      if (limpos.length > 20) { erro.textContent = MSG.lista_invalida; return; }
      const calca = inCalca.value.trim(), calcado = inCalcado.value.trim();
      if (calca && !/^\d{1,3}$/.test(calca)) { erro.textContent = 'Na calça, coloque só o número, por exemplo 40.'; inCalca.focus(); return; }
      if (calcado && !/^\d{1,3}$/.test(calcado)) { erro.textContent = 'No calçado, coloque só o número, por exemplo 38.'; inCalcado.focus(); return; }
      const tamanhos = escreverTamanhos({ camisa: selCamisa.value, calca, calcado, outras: inOutras.value.trim() });
      btnSalvar.disabled = true; btnSalvar.replaceChildren(h('span', { class: 'spinner spinner-claro' }), 'Salvando');
      const r = await api.salvarLista(sessao.pid, sessao.pin, tamanhos, limpos);
      btnSalvar.disabled = false; btnSalvar.replaceChildren('Salvar lista');
      if (!r || !r.ok) { erro.textContent = msgErro(r); return; }
      sessao.dados = r;
      sessao.manterRolagem = true;
      viewResultado();
      toast('Lista salva. Quem te tirou já pode ver.');
    }

    desenhar();
    return [h('form', { class: 'folha', onsubmit: salvar, novalidate: true },
      h('p', { class: 'sobre' }, 'Lista de desejos'),
      h('h2', null, 'O que você gostaria de ganhar'),
      h('p', { class: 'dica dica-topo' }, 'Só quem te tirou consegue ver. Com o link da loja, ninguém erra o presente.'),
      h('div', { class: 'tamanhos-campos', role: 'group', 'aria-labelledby': 'tamanhos-r' },
        h('p', { class: 'tamanhos-titulo', id: 'tamanhos-r' }, 'Tamanhos e preferências'),
        h('div', { class: 'grade-3' },
          h('div', { class: 'campo' }, h('label', { for: 't-camisa' }, 'Camisa'), selCamisa),
          h('div', { class: 'campo' }, h('label', { for: 't-calca' }, 'Calça'), inCalca),
          h('div', { class: 'campo' }, h('label', { for: 't-calcado' }, 'Calçado'), inCalcado)),
        h('div', { class: 'campo' }, h('label', { for: 't-outras' }, 'Outras preferências ', h('span', { class: 'opcional' }, 'opcional')), inOutras)),
      listaEl, btnAdd, erro, btnSalvar)];
  }

  // ------------------------------------------------------------------
  //  Rotas
  // ------------------------------------------------------------------
  function rota() {
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const [a, b, c, dd] = partes;
    const ehPessoa = a === 'e' && b && c === 'p' && dd;
    if (!ehPessoa || !sessao || sessao.pid !== dd) sessao = null;   // saiu da página da pessoa: esquece o PIN

    if (!a) return viewInicio();
    if (a === 'criar') return viewCriar();
    if (a === 'admin' && b && c) return viewAdmin(b, c);
    if (a === 'e' && b && !c) return viewEvento(b);
    if (ehPessoa) return viewPessoa(b, dd);
    return telaErro('Página não encontrada.');
  }

  window.addEventListener('hashchange', rota);
  rota();
})();
