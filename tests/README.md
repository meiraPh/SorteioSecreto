# Testes

Ferramentas de desenvolvimento. Esta pasta nunca é publicada: o site é só o que está em `src/`.

- `sql-test.js`: chama as funções do banco como o papel `anon` e confere as regras (permissões, validações, 80 sorteios com exclusões e corrente, PIN e bloqueio, painel, reset, lista de desejos).
- `server.js`: serve `src/`. Modo `demo` serve o `config.js` vazio. Modo `real` imita a rota RPC do Supabase (`/rest/v1/rpc/<função>`) chamando o Postgres local como `anon`, e aponta o site para o próprio servidor. Modo `supabase` não imita nada: aponta o site para a API indicada em `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
- `api-test.js`: confere, contra o PostgREST de verdade, que nenhuma tabela fica exposta e que só as 7 funções públicas podem ser chamadas. Só faz sentido com a stack do Supabase (ou um projeto real), não com o emulador.
- `stack-env.js`: lê a URL e a chave pública da stack local do Supabase, para o CI.
- `e2e.js`: fluxo completo no navegador (Playwright, 390×844): criar, 8 pessoas abrindo o papelzinho, lista com link, PIN errado e bloqueio, redefinir PIN no painel. Falha se houver erro no console. Salva capturas em `tests/shots/`.

## Rodando

Os comandos partem da raiz do repositório.

```bash
npm ci
npx playwright install chromium   # se ainda não tiver o navegador
```

Modo demonstração (não precisa de banco):

```bash
npm run serve:demo &
npm run test:e2e:demo
```

Com um Postgres 15+ local e o emulador (não precisa de Docker):

```bash
createuser anon --no-login; createuser authenticated --no-login
psql -f supabase/migrations/20261119000000_esquema_inicial.sql

export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
npm run test:sql
npm run serve:real &
npm run test:e2e:real
```

O usuário do banco precisa conseguir ler as tabelas do esquema `amigo_oculto`, porque o `sql-test.js` confere o sorteio direto nelas.

Com a stack local do Supabase (precisa de Docker; é o que o CI faz):

```bash
npx supabase start        # sobe Postgres + PostgREST
npx supabase db reset     # recria o banco só com as migrações
npx supabase status       # mostra a URL da API e a chave pública

export PGHOST=127.0.0.1 PGPORT=54322 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
export SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_PUBLISHABLE_KEY=<chave do status>
npm run test:sql
npm run test:api
npm run serve:supabase &
npm run test:e2e:supabase
```

Demo em arquivo único, se você tiver o `amigo-oculto-demo.html`:

```bash
node tests/e2e.js file:///caminho/para/amigo-oculto-demo.html arquivo
```
