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

// O terminal pode embrulhar o que foi colado em marcadores de "bracketed paste"
// (ESC[200~ ... ESC[201~) e mandar outros caracteres de controle; nada disso faz parte do token.
function limpar(bruto) {
  const s = String(bruto).replace(/\x1b\[20[01]~/g, '').replace(/[\x00-\x1f\x7f]/g, '').trim();
  // Colou o comando de teste da Cloudflare (curl ... "Authorization: Bearer <token>")? Fica só o token.
  const dentro = s.match(/Bearer\s+([A-Za-z0-9_-]{30,})/i);
  if (dentro) return dentro[1];
  return s
    .replace(/^authorization:\s*/i, '')
    .replace(/^bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

// Descreve o que há de errado sem mostrar o token.
function problemas(t) {
  const p = [`${t.length} caracteres`];
  if (/\s/.test(t)) p.push('tem espaço no meio');
  const outros = [...new Set(t.replace(/[A-Za-z0-9_\s-]/g, ''))];
  if (outros.length) p.push(`tem os símbolos ${outros.map((c) => JSON.stringify(c)).join(' ')}`);
  return p.join(', ');
}

module.exports = { limpar, problemas };

if (require.main === module) (async () => {
  const token = limpar(await perguntarEscondido('Token da Cloudflare (não aparece ao digitar): '));
  if (!/^[A-Za-z0-9_-]{30,}$/.test(token)) {
    console.error(`Isso não parece um token (${problemas(token)}). Copie só o token. Nada foi gravado.`);
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
