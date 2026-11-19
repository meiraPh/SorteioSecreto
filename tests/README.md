# Testes

Ferramentas de desenvolvimento. Esta pasta nunca é publicada: o site é só o que está em `src/`.

- `sql-test.js`: chama as funções do banco como o papel `anon` e confere as regras (permissões, validações, 80 sorteios com exclusões e corrente, PIN e bloqueio, painel, reset, lista de desejos).
- `server.js`: serve `src/` e imita a rota RPC do Supabase (`/rest/v1/rpc/<função>`) chamando o Postgres local como `anon`. Modo `demo` serve o `config.js` vazio; modo `real` aponta o site para o próprio servidor.
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

Com banco (Postgres 15+ local, com os papéis do Supabase):

```bash
createuser anon --no-login; createuser authenticated --no-login
psql -f supabase/schema.sql

export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
npm run test:sql
npm run serve:real &
npm run test:e2e:real
```

O usuário do banco precisa conseguir ler as tabelas do esquema `amigo_oculto`, porque o `sql-test.js` confere o sorteio direto nelas.

Demo em arquivo único, se você tiver o `amigo-oculto-demo.html`:

```bash
node tests/e2e.js file:///caminho/para/amigo-oculto-demo.html arquivo
```
