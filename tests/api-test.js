// Confere, contra a API de verdade (PostgREST), que nenhuma tabela fica exposta e que
// só as 7 funções públicas podem ser chamadas.
// Variáveis: SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ex.: da stack local do `supabase start`).
const assert = require('assert');

const URL_BASE = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const CHAVE = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
if (!URL_BASE || !CHAVE) {
  console.error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.');
  process.exit(1);
}

// Mesmos cabeçalhos que o site manda (src/api.js).
const base = { 'Content-Type': 'application/json', apikey: CHAVE };
if (CHAVE.startsWith('eyJ')) base.Authorization = 'Bearer ' + CHAVE;

const TABELAS = ['eventos', 'participantes', 'desejos'];
const PUBLICAS = ['criar_evento', 'evento_publico', 'resgatar', 'entrar', 'salvar_lista', 'painel', 'resetar_pin'];
const INTERNAS = ['lista', 'dados', 'verificar_pin', 'evento_admin'];
const UUID = '00000000-0000-0000-0000-000000000000';

async function pedir(metodo, caminho, { headers, corpo } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    method: metodo, headers: { ...base, ...headers }, body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* sem corpo */ }
  return { status: res.status, json };
}

(async () => {
  // --- a API responde e a função de leitura pública funciona
  const viva = await pedir('POST', 'rpc/evento_publico', { corpo: { p_codigo: 'naoexiste' } });
  assert.equal(viva.status, 200, JSON.stringify(viva));
  assert.deepEqual(viva.json, { ok: false, erro: 'evento_nao_encontrado' });
  console.log('✓ API no ar: evento_publico responde');

  // --- sem chave não entra. Quem barra é o gateway do Supabase hospedado; o gateway da
  // stack local (`supabase start`) deixa passar como anon, então lá só registramos.
  // Não é furo do nosso modelo: a chave publicável é pública e dá o mesmo acesso de anon.
  const semChave = await fetch(`${URL_BASE}/rest/v1/rpc/evento_publico`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_codigo: 'naoexiste' }),
  });
  if (/\.supabase\.co$/.test(new URL(URL_BASE).hostname)) {
    assert.equal(semChave.status, 401, 'sem apikey o Supabase hospedado recusa');
    console.log('✓ sem apikey: 401');
  } else {
    console.log(`– sem apikey: ${semChave.status} (stack local não exige a chave; checado só em projeto hospedado)`);
  }

  // --- tabelas não existem para a API
  for (const t of TABELAS) {
    const ler = await pedir('GET', `${t}?select=*`);
    assert.equal(ler.status, 404, `GET ${t}: ${JSON.stringify(ler)}`);
    const gravar = await pedir('POST', t, { corpo: {} });
    assert.equal(gravar.status, 404, `POST ${t}: ${JSON.stringify(gravar)}`);
  }
  console.log('✓ tabelas não aparecem na API (404 para ler e gravar)');

  // --- o esquema privado não pode ser escolhido pelo cabeçalho de perfil
  for (const t of TABELAS) {
    const r = await pedir('GET', `${t}?select=*`, { headers: { 'Accept-Profile': 'amigo_oculto' } });
    assert.equal(r.status, 406, `Accept-Profile em ${t}: ${JSON.stringify(r)}`);
    assert.equal(r.json && r.json.code, 'PGRST106');
  }
  const perfilRpc = await pedir('POST', 'rpc/dados', { headers: { 'Content-Profile': 'amigo_oculto' }, corpo: { p_id: UUID } });
  assert.equal(perfilRpc.status, 406, JSON.stringify(perfilRpc));
  console.log('✓ esquema amigo_oculto não é aceito como perfil (406)');

  // --- funções internas não podem ser chamadas
  for (const [fn, args] of [['lista', { p_id: UUID }], ['dados', { p_id: UUID }],
    ['verificar_pin', { p_id: UUID, p_pin: '0000' }], ['evento_admin', { p_codigo: 'x', p_token: 'x' }]]) {
    const r = await pedir('POST', `rpc/${fn}`, { corpo: args });
    assert.equal(r.status, 404, `rpc/${fn}: ${JSON.stringify(r)}`);
  }
  console.log('✓ funções internas não podem ser chamadas (404)');

  // --- o que a API anuncia: só as 7 funções, nenhuma tabela
  const spec = await pedir('GET', '');
  if (spec.status === 200 && spec.json && spec.json.paths) {
    const caminhos = Object.keys(spec.json.paths).filter((c) => c !== '/').sort();
    assert.deepEqual(caminhos, PUBLICAS.map((f) => `/rpc/${f}`).sort(), 'a API anuncia exatamente as 7 funções');
    assert.deepEqual(Object.keys(spec.json.definitions || {}), [], 'nenhuma tabela anunciada');
    for (const fn of INTERNAS) assert.ok(!JSON.stringify(spec.json.paths).includes(`/rpc/${fn}"`));
    console.log('✓ descrição da API (OpenAPI): só as 7 funções, nenhuma tabela');
  } else {
    console.log(`– descrição da API (OpenAPI) indisponível para esta chave (status ${spec.status}); checagem pulada`);
  }

  console.log('\nTODOS OS TESTES DE API PASSARAM');
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
