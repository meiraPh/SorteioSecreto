// Confere o que o deploy gera (scripts/site.js): chave pública só, CSP estrita e cache.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const site = require('../scripts/site.js');

const jwt = (papel) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: papel })).toString('base64url') + '.assinatura';

// --- chaves
assert.equal(site.conferirChave(' sb_publishable_abc '), 'sb_publishable_abc');
assert.equal(site.conferirChave(jwt('anon')), jwt('anon'));
assert.throws(() => site.conferirChave('sb_secret_abc'), /secret/);
assert.throws(() => site.conferirChave(jwt('service_role')), /service_role/);
assert.throws(() => site.conferirChave('qualquer'), /sb_publishable_/);
assert.throws(() => site.conferirChave(''), /vazia/);
console.log('✓ só a chave pública passa (secret e service_role recusadas)');

// --- URL
assert.equal(site.origemDe('https://abcd.supabase.co/'), 'https://abcd.supabase.co');
assert.equal(site.origemDe('https://abcd.supabase.co/rest/v1'), 'https://abcd.supabase.co');
assert.throws(() => site.origemDe('javascript:alert(1)'), /http/);
assert.throws(() => site.origemDe('nada'), /inválida/);
console.log('✓ URL vira só a origem; esquemas estranhos recusados');

// --- CSP
const csp = site.politica('https://abcd.supabase.co');
for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
  "connect-src 'self' https://abcd.supabase.co", "frame-ancestors 'none'", "object-src 'none'"]) {
  assert.ok(csp.includes(d), `CSP sem: ${d}`);
}
assert.ok(!csp.includes('unsafe'), 'CSP sem unsafe-*');
assert.ok(!/\*/.test(csp), 'CSP sem curingas');
assert.equal(site.politica(null).match(/connect-src ([^;]*)/)[1], "'self'");
console.log('✓ CSP estrita: sem unsafe-inline, connect-src só com a API do ambiente');

// --- cache
assert.equal(site.cacheDe('/fonts/figtree-latin-wght-normal.woff2'), 'public, max-age=31536000, immutable');
assert.equal(site.cacheDe('/index.html'), 'no-cache');
assert.equal(site.cacheDe('/app.js'), 'no-cache');
console.log('✓ cache longo só nas fontes');

// --- build de ponta a ponta numa pasta temporária
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'amigo-site-'));
const saida = path.join(tmp, 'dist');
const script = path.join(__dirname, '..', 'scripts', 'site.js');
const roda = (args, env) => execFileSync(process.execPath, [script, ...args], {
  env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env }, stdio: 'pipe', encoding: 'utf8',
});

roda(['build', saida], { SUPABASE_URL: 'https://abcd.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_teste' });
const cfg = fs.readFileSync(path.join(saida, 'config.js'), 'utf8');
assert.ok(cfg.includes('SUPABASE_URL: "https://abcd.supabase.co"') && cfg.includes('SUPABASE_KEY: "sb_publishable_teste"'));
const headers = fs.readFileSync(path.join(saida, '_headers'), 'utf8');
assert.ok(headers.includes("connect-src 'self' https://abcd.supabase.co"));
assert.ok(/\/fonts\/\*\n {2}! Cache-Control\n {2}Cache-Control: public, max-age=31536000, immutable/.test(headers));
for (const f of ['index.html', 'styles.css', 'app.js', 'api.js', 'fonts/figtree-latin-wght-normal.woff2']) {
  assert.ok(fs.existsSync(path.join(saida, f)), `falta ${f}`);
}
for (const f of ['tests', 'supabase', 'package.json', 'README.md']) {
  assert.ok(!fs.existsSync(path.join(saida, f)), `não devia publicar ${f}`);
}
console.log('✓ build: config.js e _headers do ambiente; só os arquivos do site');

assert.throws(() => roda(['build', saida], { SUPABASE_URL: 'https://abcd.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' }));
assert.throws(() => roda(['build', saida], { SUPABASE_URL: 'https://abcd.supabase.co' }));
assert.throws(() => roda(['build', saida, '--demo'], { SUPABASE_URL: 'https://abcd.supabase.co' }));
roda(['build', saida, '--demo'], {});
assert.ok(fs.readFileSync(path.join(saida, 'config.js'), 'utf8').includes('SUPABASE_URL: ""'));
console.log('✓ build recusa chave secret e configuração pela metade; --demo gera config vazio');

// --- nenhum style inline sobrou no site (a CSP bloquearia)
const fonte = ['index.html', 'app.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
// Pega atributo HTML (style="...") e atributo montado no JS com declaração CSS
// ({ style: 'position:fixed' } ou setAttribute('style', ...)). Não confunde com
// opções como Intl.NumberFormat({ style: 'currency' }), que não têm ":" nem ";".
const inline = [/\sstyle\s*=\s*['"]/, /style\s*:\s*['"][^'"]*[:;][^'"]*['"]/, /setAttribute\(\s*['"]style['"]/, /\.style\.cssText\s*=/];
for (const re of inline) assert.ok(!re.test(fonte), `atributo style inline no site (${re})`);
for (const ruim of ["h('textarea', { style: 'position:fixed;top:0;left:0;opacity:0' })", '<p style="padding:20px">', "el.setAttribute('style', 'color:red')"]) {
  assert.ok(inline.some((re) => re.test(ruim)), 'a checagem pega: ' + ruim);
}
assert.ok(!inline.some((re) => re.test("toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })")), 'opção do Intl não é style inline');
console.log('✓ nenhum atributo style inline em index.html e app.js');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nTODOS OS TESTES DO BUILD PASSARAM');
