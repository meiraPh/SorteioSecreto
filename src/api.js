// =====================================================================
//  Camada de dados.
//  - Se config.js tiver o Supabase preenchido: chama as funções do banco.
//  - Senão: MODO DEMONSTRAÇÃO, que imita o banco aqui mesmo, em memória.
//  As duas versões têm exatamente os mesmos métodos e respostas.
// =====================================================================
(function () {
  'use strict';

  const cfg = window.AMIGO_CONFIG || {};
  const URL_BASE = (cfg.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const CHAVE = (cfg.SUPABASE_KEY || '').trim();

  // -------------------------------------------------------------------
  //  Supabase (produção)
  // -------------------------------------------------------------------
  function criarApiSupabase() {
    const headers = { 'Content-Type': 'application/json', apikey: CHAVE };
    // Chaves antigas ("anon") são JWT e também vão no Authorization.
    if (CHAVE.startsWith('eyJ')) headers.Authorization = 'Bearer ' + CHAVE;

    async function rpc(fn, args) {
      let res;
      try {
        res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
          method: 'POST', headers, body: JSON.stringify(args),
        });
      } catch (e) {
        return { ok: false, erro: 'rede' };
      }
      let corpo = null;
      try { corpo = await res.json(); } catch (e) { /* vazio */ }
      if (!res.ok) {
        return { ok: false, erro: 'servidor', detalhe: (corpo && (corpo.message || corpo.hint)) || res.status };
      }
      return corpo || { ok: false, erro: 'servidor' };
    }

    return {
      modo: 'supabase',
      criarEvento: (e) => rpc('criar_evento', {
        p_titulo: e.titulo, p_participantes: e.participantes, p_exclusoes: e.exclusoes,
        p_organizador: e.organizador || null, p_data: e.data || null, p_valor: e.valor || null,
        p_mensagem: e.mensagem || null, p_corrente: !!e.corrente,
      }),
      eventoPublico: (codigo) => rpc('evento_publico', { p_codigo: codigo }),
      resgatar: (pid, pin) => rpc('resgatar', { p_participante: pid, p_pin: pin }),
      entrar: (pid, pin) => rpc('entrar', { p_participante: pid, p_pin: pin }),
      salvarLista: (pid, pin, tamanhos, desejos) => rpc('salvar_lista', {
        p_participante: pid, p_pin: pin, p_tamanhos: tamanhos, p_desejos: desejos,
      }),
      painel: (codigo, token) => rpc('painel', { p_codigo: codigo, p_token: token }),
      resetarPin: (codigo, token, pid) => rpc('resetar_pin', {
        p_codigo: codigo, p_token: token, p_participante: pid,
      }),
    };
  }

  // -------------------------------------------------------------------
  //  Modo demonstração (mesmas regras do schema.sql, em memória)
  // -------------------------------------------------------------------
  function criarApiDemo() {
    const eventos = new Map();   // codigo -> evento
    const pessoas = new Map();   // id -> participante

    const espera = () => new Promise((r) => setTimeout(r, 220));
    const copia = (x) => JSON.parse(JSON.stringify(x));
    const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)),
      (b) => b.toString(16).padStart(2, '0')).join('');
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : hex(16));
    const falha = (erro, extra) => Object.assign({ ok: false, erro }, extra || {});

    function embaralhar(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function sortear(n, proibidos, corrente) {
      const base = Array.from({ length: n }, (_, i) => i);
      for (let t = 0; t < 5000; t++) {
        const perm = embaralhar(base);
        const dest = new Array(n);
        for (let k = 0; k < n; k++) {
          if (corrente) dest[perm[k]] = perm[(k + 1) % n];
          else dest[k] = perm[k];
        }
        let ok = true;
        for (let k = 0; k < n && ok; k++) {
          if (dest[k] === k || proibidos.has(k + ':' + dest[k])) ok = false;
        }
        if (ok) return dest;
      }
      return null;
    }

    function lista(p) { return copia(p.desejos); }
    function infoEvento(e) {
      return { codigo: e.codigo, titulo: e.titulo, organizador: e.organizador,
        data: e.data, valor: e.valor, mensagem: e.mensagem, corrente: e.corrente };
    }
    function dados(p) {
      const e = [...eventos.values()].find((x) => x.id === p.evento_id);
      const a = pessoas.get(p.amigo_id);
      const ev = infoEvento(e); delete ev.corrente;
      return copia({
        ok: true,
        evento: ev,
        eu: { id: p.id, nome: p.nome, tamanhos: p.tamanhos, desejos: lista(p) },
        amigo: { nome: a.nome, tamanhos: a.tamanhos, desejos: lista(a) },
      });
    }
    function verificarPin(id, pin) {
      const p = pessoas.get(id);
      if (!p) return falha('nao_encontrado');
      if (!p.pin) return falha('sem_pin');
      if (p.bloqueado_ate && p.bloqueado_ate > Date.now()) {
        return falha('bloqueado', { ate: new Date(p.bloqueado_ate).toISOString() });
      }
      if (pin !== p.pin) {
        if (p.tentativas + 1 >= 5) {
          p.tentativas = 0; p.bloqueado_ate = Date.now() + 10 * 60 * 1000;
          return falha('bloqueado', { ate: new Date(p.bloqueado_ate).toISOString() });
        }
        p.tentativas += 1;
        return falha('pin_errado', { restantes: 5 - p.tentativas });
      }
      p.tentativas = 0; p.bloqueado_ate = null;
      return { ok: true };
    }
    function eventoPorAdmin(codigo, token) {
      const e = eventos.get(codigo);
      return e && e.token === token ? e : null;
    }
    const doEvento = (e) => [...pessoas.values()].filter((p) => p.evento_id === e.id)
      .sort((a, b) => a.ordem - b.ordem);
    const limpa = (s, max) => {
      const t = String(s == null ? '' : s).trim().slice(0, max);
      return t || null;
    };

    return {
      modo: 'demo',

      async criarEvento(e) {
        await espera();
        if (!String(e.titulo || '').trim()) return falha('titulo_vazio');
        const nomes = (e.participantes || []).map((x) => String(x).trim());
        const n = nomes.length;
        if (n < 3) return falha('minimo_3');
        if (n > 100) return falha('maximo_100');
        if (nomes.some((x) => !x || x.length > 40)) return falha('nome_invalido');
        if (new Set(nomes.map((x) => x.toLowerCase())).size !== n) return falha('nomes_repetidos');
        const proibidos = new Set();
        for (const par of e.exclusoes || []) {
          const [a, b] = par;
          if (!(a >= 0 && a < n && b >= 0 && b < n)) return falha('exclusao_invalida');
          proibidos.add(a + ':' + b);
        }
        const corrente = e.corrente !== false;
        const dest = sortear(n, proibidos, corrente);
        if (!dest) return falha('impossivel');

        let codigo;
        do { codigo = hex(5); } while (eventos.has(codigo));
        const token = hex(18);
        const ev = {
          id: uid(), codigo, token, titulo: limpa(e.titulo, 80), organizador: limpa(e.organizador, 60),
          data: e.data || null, valor: limpa(e.valor, 40), mensagem: limpa(e.mensagem, 1000), corrente,
        };
        eventos.set(codigo, ev);
        const ids = nomes.map((nome, i) => {
          const p = { id: uid(), evento_id: ev.id, nome, ordem: i + 1, amigo_id: null, pin: null,
            resgatado_em: null, tentativas: 0, bloqueado_ate: null, tamanhos: null, desejos: [] };
          pessoas.set(p.id, p);
          return p.id;
        });
        ids.forEach((id, i) => { pessoas.get(id).amigo_id = ids[dest[i]]; });
        return { ok: true, codigo, token };
      },

      async eventoPublico(codigo) {
        await espera();
        const e = eventos.get(codigo);
        if (!e) return falha('evento_nao_encontrado');
        return copia({
          ok: true, evento: infoEvento(e),
          participantes: doEvento(e).map((p) => ({ id: p.id, nome: p.nome, resgatado: !!p.pin })),
        });
      },

      async resgatar(pid, pin) {
        await espera();
        if (!/^[0-9]{4}$/.test(pin || '')) return falha('pin_formato');
        const p = pessoas.get(pid);
        if (!p) return falha('nao_encontrado');
        if (p.pin) return falha('ja_resgatado');
        p.pin = pin; p.resgatado_em = new Date().toISOString(); p.tentativas = 0; p.bloqueado_ate = null;
        return dados(p);
      },

      async entrar(pid, pin) {
        await espera();
        const v = verificarPin(pid, pin);
        return v.ok ? dados(pessoas.get(pid)) : v;
      },

      async salvarLista(pid, pin, tamanhos, desejos) {
        await espera();
        const v = verificarPin(pid, pin);
        if (!v.ok) return v;
        desejos = desejos || [];
        if (!Array.isArray(desejos) || desejos.length > 20) return falha('lista_invalida');
        const itens = [];
        for (const it of desejos) {
          const d = String(it.descricao || '').trim();
          const l = String(it.link || '').trim();
          const o = String(it.obs || '').trim();
          if (!d || d.length > 120 || o.length > 200) return falha('item_invalido');
          if (l && (l.length > 600 || !/^https?:\/\/\S+$/i.test(l))) return falha('link_invalido');
          itens.push({ descricao: d, link: l || null, obs: o || null });
        }
        const p = pessoas.get(pid);
        p.tamanhos = limpa(tamanhos, 300);
        p.desejos = itens;
        return dados(p);
      },

      async painel(codigo, token) {
        await espera();
        const e = eventoPorAdmin(codigo, token);
        if (!e) return falha('acesso_negado');
        return copia({
          ok: true, evento: infoEvento(e),
          participantes: doEvento(e).map((p) => ({
            id: p.id, nome: p.nome, resgatado_em: p.resgatado_em,
            bloqueado: !!(p.bloqueado_ate && p.bloqueado_ate > Date.now()),
            lista_pronta: p.desejos.length > 0,
          })),
        });
      },

      async resetarPin(codigo, token, pid) {
        await espera();
        const e = eventoPorAdmin(codigo, token);
        if (!e) return falha('acesso_negado');
        const p = pessoas.get(pid);
        if (!p || p.evento_id !== e.id) return falha('nao_encontrado');
        p.pin = null; p.resgatado_em = null; p.tentativas = 0; p.bloqueado_ate = null;
        return { ok: true };
      },
    };
  }

  window.Api = (URL_BASE && CHAVE) ? criarApiSupabase() : criarApiDemo();
})();
