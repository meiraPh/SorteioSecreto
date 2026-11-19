// Confere se um ambiente publicado está de pé: a página abre com a CSP certa, o config.js
// aponta para o Supabase do ambiente e a função evento_publico responde.
// Chamar evento_publico com um código que não existe não grava nada, mas conta como
// atividade no banco, o que evita a pausa do plano grátis do Supabase.
// Variáveis: SITE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY.
const assert = require('assert');

const SITE = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
const API = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const CHAVE = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
if (!SITE || !API || !CHAVE) {
  console.error('Defina SITE_URL, SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.');
  process.exit(1);
}

async function checar() {
  const pagina = await fetch(SITE + '/', { redirect: 'follow' });
  assert.equal(pagina.status, 200, `página: HTTP ${pagina.status}`);
  const csp = pagina.headers.get('content-security-policy') || '';
  assert.ok(csp.includes("default-src 'self'"), `página sem a CSP: "${csp}"`);
  assert.ok(csp.includes(new URL(API).origin), 'a CSP não libera a API deste ambiente');
  assert.ok((await pagina.text()).includes('<div id="app">'), 'página não parece o Amigo Oculto');

  const cfg = await (await fetch(SITE + '/config.js')).text();
  assert.ok(cfg.includes(JSON.stringify(new URL(API).origin)), 'config.js aponta para outro Supabase');

  const headers = { 'Content-Type': 'application/json', apikey: CHAVE };
  if (CHAVE.startsWith('eyJ')) headers.Authorization = 'Bearer ' + CHAVE;
  const rpc = await fetch(`${API}/rest/v1/rpc/evento_publico`, {
    method: 'POST', headers, body: JSON.stringify({ p_codigo: 'vigia-nao-existe' }),
  });
  const corpo = await rpc.text();
  assert.equal(rpc.status, 200, `API: HTTP ${rpc.status} ${corpo.slice(0, 200)}`);
  assert.deepEqual(JSON.parse(corpo), { ok: false, erro: 'evento_nao_encontrado' });
}

(async () => {
  // Uma segunda tentativa depois de 30 s evita alarme por soluço de rede.
  for (let tentativa = 1; ; tentativa++) {
    try {
      await checar();
      console.log(`✓ ${SITE} de pé: página com CSP, config do ambiente e API respondendo`);
      return;
    } catch (e) {
      if (tentativa >= 2) throw e;
      console.log(`… falhou (${e.message}); tentando de novo em 30 s`);
      await new Promise((ok) => setTimeout(ok, 30000));
    }
  }
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
