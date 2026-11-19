// Grava no GitHub o segredo CLOUDFLARE_API_TOKEN, sem o token aparecer na tela.
// Pede o token (digitação escondida), limpa espaços e um "Bearer " colado junto, confere
// com a Cloudflare (/user/tokens/verify) e só então grava com `gh secret set`.
//
// uso: node scripts/segredo-cloudflare.js
'use strict';
const readline = require('readline');
const { spawnSync } = require('child_process');

function perguntarEscondido(texto) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = (s) => { if (!rl.stdoutMuted) rl.output.write(s); };
    rl.question(texto, (resposta) => { rl.close(); process.stdout.write('\n'); ok(resposta); });
    rl.stdoutMuted = true;
  });
}

(async () => {
  let token = (await perguntarEscondido('Token da Cloudflare (não aparece ao digitar): ')).trim();
  token = token.replace(/^authorization:\s*/i, '').replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
  if (!/^[A-Za-z0-9_-]{30,}$/.test(token)) {
    console.error(`Isso não parece um token (${token.length} caracteres, com espaços ou símbolos). Copie só o token. Nada foi gravado.`);
    process.exit(1);
  }

  process.stdout.write('Conferindo com a Cloudflare... ');
  let corpo;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { Authorization: `Bearer ${token}` } });
    corpo = await r.json();
  } catch (e) {
    console.log('falhou.');
    console.error(`Sem resposta da Cloudflare (${e.message}). Nada foi gravado.`);
    process.exit(1);
  }
  if (!corpo.success || !corpo.result || corpo.result.status !== 'active') {
    console.log('recusado.');
    const erros = (corpo.errors || []).map((e) => `${e.code} ${e.message}`).join('; ');
    console.error(`A Cloudflare não aceitou o token (${erros || (corpo.result && corpo.result.status) || 'sem detalhe'}). Nada foi gravado.`);
    process.exit(1);
  }
  console.log(`ok (ativo${corpo.result.expires_on ? ', vence em ' + corpo.result.expires_on.slice(0, 10) : ''}).`);

  const g = spawnSync('gh', ['secret', 'set', 'CLOUDFLARE_API_TOKEN'], { input: token, stdio: ['pipe', 'inherit', 'inherit'] });
  if (g.status !== 0) { console.error('O gh secret set falhou. Nada foi gravado.'); process.exit(1); }
  console.log('Segredo CLOUDFLARE_API_TOKEN gravado.');
})();
