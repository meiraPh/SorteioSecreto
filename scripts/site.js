// Monta o site para publicar: copia src/ para a pasta de saída e gera o que muda por
// ambiente, o config.js (URL e chave pública do Supabase) e o _headers (CSP e cache),
// que a Cloudflare aplica às respostas. Não é bundler: os arquivos vão como estão.
//
// uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
//     node scripts/site.js build dist
//   node scripts/site.js build dist --demo      # sem Supabase: modo demonstração
//
// O tests/server.js usa as mesmas funções, para os testes rodarem com a mesma CSP.
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ_SITE = path.resolve(__dirname, '..', 'src');

// Origem (esquema + host + porta) da API, sem caminho. Recusa o que não for http(s).
function origemDe(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch (e) { throw new Error(`SUPABASE_URL inválida: ${url}`); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`SUPABASE_URL precisa ser http(s): ${url}`);
  return u.origin;
}

// Só a chave pública pode ir para o site. Recusa secret/service_role.
function conferirChave(chave) {
  const k = String(chave || '').trim();
  if (!k) throw new Error('SUPABASE_PUBLISHABLE_KEY vazia');
  if (k.startsWith('sb_secret_')) throw new Error('Isto é uma chave secret. O site só pode usar a publishable (sb_publishable_...).');
  if (k.startsWith('eyJ')) {
    let papel = null;
    try { papel = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8')).role; } catch (e) { /* inválida */ }
    if (papel !== 'anon') throw new Error(`Chave JWT com papel "${papel}". O site só pode usar a anon ou a publishable.`);
    return k;
  }
  if (!k.startsWith('sb_publishable_')) throw new Error('A chave precisa começar com sb_publishable_ (ou ser a JWT anon antiga).');
  return k;
}

function configJs(url, chave) {
  return [
    '// Gerado no deploy por scripts/site.js. Não edite: os valores vêm das variáveis do ambiente.',
    'window.AMIGO_CONFIG = {',
    `  SUPABASE_URL: ${JSON.stringify(url ? origemDe(url) : '')},`,
    `  SUPABASE_KEY: ${JSON.stringify(chave ? conferirChave(chave) : '')},`,
    '};',
    '',
  ].join('\n');
}

// CSP estrita: nada inline, nada de terceiros. A única origem externa é a API do ambiente.
function politica(origemApi) {
  const conectar = ["'self'"];
  if (origemApi) conectar.push(origemApi);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${conectar.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// Cabeçalhos de segurança, iguais em toda resposta do site.
function cabecalhos(origemApi) {
  return {
    'Content-Security-Policy': politica(origemApi),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

// Fontes nunca mudam: cache longo. O resto (HTML, JS, CSS sem hash no nome) revalida sempre.
const CACHE_LONGO = 'public, max-age=31536000, immutable';
const CACHE_CURTO = 'no-cache';
function cacheDe(caminho) {
  return caminho.startsWith('/fonts/') ? CACHE_LONGO : CACHE_CURTO;
}

// Formato do _headers da Cloudflare: regra de caminho e, embaixo, "Nome: valor" indentado.
// Header repetido em duas regras é juntado com vírgula, então o Cache-Control das fontes
// primeiro é removido ("! Cache-Control") e depois definido de novo.
function arquivoHeaders(origemApi) {
  const linhas = ['# Gerado por scripts/site.js. Não edite.', '/*'];
  for (const [nome, valor] of Object.entries(cabecalhos(origemApi))) linhas.push(`  ${nome}: ${valor}`);
  linhas.push(`  Cache-Control: ${CACHE_CURTO}`);
  linhas.push('/fonts/*', '  ! Cache-Control', `  Cache-Control: ${CACHE_LONGO}`, '');
  for (const l of linhas) if (l.length > 2000) throw new Error('linha do _headers passa de 2000 caracteres');
  return linhas.join('\n');
}

function build(saida, { demo }) {
  const url = (process.env.SUPABASE_URL || '').trim();
  const chave = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (demo && (url || chave)) throw new Error('--demo com SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY definidas: escolha um');
  if (!demo && !(url && chave)) throw new Error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY, ou use --demo');

  const destino = path.resolve(saida);
  if (destino === RAIZ_SITE || destino === path.dirname(RAIZ_SITE)) throw new Error('saída inválida');
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(RAIZ_SITE, destino, { recursive: true });
  fs.writeFileSync(path.join(destino, 'config.js'), configJs(url, chave));
  fs.writeFileSync(path.join(destino, '_headers'), arquivoHeaders(demo ? null : origemDe(url)));
  const modo = demo ? 'demonstração' : origemDe(url);
  console.log(`site montado em ${path.relative(process.cwd(), destino) || '.'} (${modo})`);
}

module.exports = { origemDe, conferirChave, configJs, politica, cabecalhos, cacheDe, arquivoHeaders };

if (require.main === module) {
  const [cmd, saida, ...resto] = process.argv.slice(2);
  try {
    if (cmd !== 'build' || !saida) throw new Error('uso: node scripts/site.js build <pasta> [--demo]');
    build(saida, { demo: resto.includes('--demo') });
  } catch (e) {
    console.error('ERRO: ' + e.message);
    process.exit(1);
  }
}
