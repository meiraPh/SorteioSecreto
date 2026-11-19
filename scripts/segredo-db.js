// Grava no GitHub o segredo SUPABASE_DB_URL de um ambiente, sem a senha aparecer na tela.
// Pede a senha do banco (digitação escondida), monta a URL do Session pooler com a senha
// codificada (percent-encoding), testa a conexão e só então grava com `gh secret set`.
//
// uso: node scripts/segredo-db.js <staging|producao> <ref-do-projeto> [host-do-pooler]
// ex.: node scripts/segredo-db.js staging abcdefghijklmnopqrst
'use strict';
const readline = require('readline');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

const [ambiente, ref, host = 'aws-1-sa-east-1.pooler.supabase.com'] = process.argv.slice(2);
if (!['staging', 'producao'].includes(ambiente) || !/^[a-z]{20}$/.test(ref || '')) {
  console.error('uso: node scripts/segredo-db.js <staging|producao> <ref-do-projeto> [host-do-pooler]');
  process.exit(1);
}

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
  const senha = await perguntarEscondido(`Senha do banco de ${ambiente} (não aparece ao digitar): `);
  if (!senha) { console.error('Senha vazia. Nada foi gravado.'); process.exit(1); }
  const url = `postgresql://postgres.${ref}:${encodeURIComponent(senha)}@${host}:5432/postgres`;

  process.stdout.write('Testando a conexão... ');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    await c.connect();
    await c.query('select 1');
    await c.end();
    console.log('ok.');
  } catch (e) {
    console.log('falhou.');
    console.error(`Não conectou (${e.code || e.message}). Confira a senha e o ref. Nada foi gravado.`);
    process.exit(1);
  }

  const r = spawnSync('gh', ['secret', 'set', 'SUPABASE_DB_URL', '--env', ambiente], { input: url, stdio: ['pipe', 'inherit', 'inherit'] });
  if (r.status !== 0) { console.error('O gh secret set falhou. Nada foi gravado.'); process.exit(1); }
  console.log(`Segredo SUPABASE_DB_URL do ambiente ${ambiente} gravado.`);
})();
