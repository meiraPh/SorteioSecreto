// Servidor de teste: entrega o site e imita a API RPC do Supabase (PostgREST)
// chamando as funções reais do schema.sql no Postgres local, como "anon".
// uso: node server.js <porta> <demo|real|supabase>
// Modo supabase: não imita nada; o site fala com a API de verdade indicada em
// SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ex.: a stack local do `supabase start`).
// Banco: usa as variáveis PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD.
// Só para desenvolvimento local. NÃO publicar este arquivo.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const site = require('../scripts/site.js');

const PORTA = Number(process.argv[2] || 8080);
const MODO = process.argv[3] || 'real';
const RAIZ = path.resolve(__dirname, '..', 'src');
const pool = new Pool();
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
if (MODO === 'supabase' && !(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY)) {
  console.error('modo supabase: defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}
// Mesmos cabeçalhos do deploy (CSP inclusive), para o E2E pegar violação de CSP.
const ORIGEM_API = MODO === 'supabase' ? site.origemDe(process.env.SUPABASE_URL)
  : MODO === 'real' ? `http://localhost:${PORTA}` : null;
const CABECALHOS = site.cabecalhos(ORIGEM_API);
const PERMITIDAS = new Set(['criar_evento', 'evento_publico', 'resgatar', 'entrar', 'salvar_lista', 'painel', 'resetar_pin']);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
  if (m && req.method === 'POST' && MODO !== 'supabase') {
    if (!req.headers.apikey) { res.writeHead(401); return res.end('{"message":"No API key"}'); }
    const fn = m[1];
    let corpo = '';
    for await (const c of req) corpo += c;
    const args = JSON.parse(corpo || '{}');
    if (!PERMITIDAS.has(fn)) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"message":"function not found"}'); }
    const keys = Object.keys(args);
    const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
    const vals = keys.map((k) => (args[k] !== null && typeof args[k] === 'object') ? JSON.stringify(args[k]) : args[k]);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role anon');
      const r = await client.query(sql, vals);
      await client.query('commit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r.rows[0].r));
    } catch (e) {
      await client.query('rollback').catch(() => {});
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: e.message }));
    } finally { client.release(); }
    return;
  }
  // arquivos estáticos
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p === '/config.js' && MODO === 'real') {
    res.writeHead(200, { ...CABECALHOS, 'Cache-Control': 'no-cache', 'Content-Type': TIPOS['.js'] });
    return res.end(site.configJs(`http://localhost:${PORTA}`, 'sb_publishable_teste'));
  }
  if (p === '/config.js' && MODO === 'supabase') {
    res.writeHead(200, { ...CABECALHOS, 'Cache-Control': 'no-cache', 'Content-Type': TIPOS['.js'] });
    return res.end(site.configJs(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY));
  }
  const arq = path.join(RAIZ, path.normalize(p));
  if (!arq.startsWith(RAIZ) || arq.includes(`${path.sep}tests${path.sep}`) || !fs.existsSync(arq)) { res.writeHead(404); return res.end('nao encontrado'); }
  res.writeHead(200, { ...CABECALHOS, 'Cache-Control': site.cacheDe(p), 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
}).listen(PORTA, () => console.log(`servidor ${MODO} em http://localhost:${PORTA}`));
