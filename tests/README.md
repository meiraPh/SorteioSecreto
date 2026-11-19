# Testes

Ferramentas usadas para validar o protótipo. Só para desenvolvimento: não publique esta pasta.

- `sql-test.js`: chama as funções do `supabase/schema.sql` como o papel `anon` e confere as regras (validações, 80 sorteios com exclusões e corrente, PIN e bloqueio, painel, reset, lista de desejos).
- `server.js`: serve o site e imita a rota RPC do Supabase (`/rest/v1/rpc/<função>`) chamando o Postgres local como `anon`. Modo `demo` serve o `config.js` vazio; modo `real` aponta o site para o próprio servidor.
- `e2e.js`: fluxo completo no navegador (Playwright, 390×844): criar, 8 pessoas abrindo o papelzinho, lista com link, PIN errado e bloqueio, redefinir PIN no painel. Salva capturas em `shots/`.

## Rodando

```bash
# Postgres 15+ local com os papéis do Supabase
createuser anon --no-login; createuser authenticated --no-login
psql -f ../supabase/schema.sql

npm install
npx playwright install chromium   # se ainda não tiver o navegador

export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
npm run test:sql
npm run serve:real &                # e/ou: npm run serve:demo &
npm run test:e2e:real               # e/ou: npm run test:e2e:demo
node e2e.js file://$PWD/../amigo-oculto-demo.html arquivo   # demo em arquivo único, se tiver
```
