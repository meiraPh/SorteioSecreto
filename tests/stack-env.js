// Lê a URL e a chave pública da stack local do Supabase (`supabase start`) e imprime
// no formato NOME=valor, para usar no CI (`node tests/stack-env.js >> "$GITHUB_ENV"`).
// A chave é a publishable (sb_publishable_...) quando a CLI informa uma; senão, a anon.
const { execSync } = require('child_process');

const bruto = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const st = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1));

const url = st.API_URL;
const chave = st.PUBLISHABLE_KEY || st.ANON_KEY;
if (!url || !chave) {
  console.error('Não achei API_URL e PUBLISHABLE_KEY/ANON_KEY no status. Campos disponíveis: ' + Object.keys(st).join(', '));
  process.exit(1);
}
console.log(`SUPABASE_URL=${url}`);
console.log(`SUPABASE_PUBLISHABLE_KEY=${chave}`);
