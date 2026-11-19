# Operação

Como cuidar do Amigo Oculto no dia a dia. As seções marcadas com "a preencher" dependem de fases que ainda não foram feitas (ver [backlog](backlog.md)).

## Ambientes

| Ambiente | Site | Banco | Quando publica |
|---|---|---|---|
| Preview | `https://pr-<número>-amigo-oculto-staging.<subdomínio>.workers.dev` | Supabase de staging | A cada push num PR |
| Staging | `https://amigo-oculto-staging.<subdomínio>.workers.dev` | Supabase de staging | Merge na `main` |
| Produção | `https://amigo-oculto.<subdomínio>.workers.dev` | Supabase de produção | Depois do staging, com a sua aprovação |

O site fica na Cloudflare (Workers, só arquivos estáticos). O `config.js` e os cabeçalhos (CSP, cache) são gerados no deploy por `scripts/site.js`, a partir das variáveis do ambiente. Os valores não ficam no repositório.

## Configuração inicial (uma vez)

O workflow de deploy só roda quando a variável `DEPLOY_ATIVO` do repositório for `true`. Antes disso, monte o que está abaixo. Os ambientes `staging` e `producao` já existem no GitHub: os dois só aceitam deploy da `main`, e `producao` espera a sua aprovação.

**1. Supabase: dois projetos** na região South America (São Paulo), por exemplo `amigo-oculto-staging` e `amigo-oculto`. Em cada um, anote:

- a **Project URL** (`https://<ref>.supabase.co`);
- a **publishable key** (`sb_publishable_...`), em Project Settings > API Keys;
- a **URL do Session pooler**, em **Connect** > Session pooler, com a senha do banco no lugar de `[YOUR-PASSWORD]`. É por ela que o CI aplica as migrações: a conexão direta é só IPv6, e o GitHub não tem IPv6.

Em Project Settings > Data API, os esquemas expostos devem continuar só `public` e `graphql_public`. O esquema `amigo_oculto` não pode estar na lista.

**2. Cloudflare.** Crie a conta, abra Workers & Pages e escolha o subdomínio `workers.dev`. Depois crie um API token com o modelo **Edit Cloudflare Workers** e anote também o **Account ID**.

**3. GitHub: segredos.** Rode na pasta do repositório (`npm ci` antes, se ainda não rodou). O script pede a senha do banco sem mostrar na tela, monta a URL do Session pooler com a senha codificada (*percent-encoding*, necessário quando ela tem caracteres especiais), testa a conexão e só então grava o segredo:

```bash
node scripts/segredo-db.js staging <ref-staging>
node scripts/segredo-db.js producao <ref-producao>
```

O `SUPABASE_DB_URL` de produção fica no ambiente `producao`, que só libera o segredo depois da sua aprovação. O host padrão do pooler é o de São Paulo (`aws-1-sa-east-1.pooler.supabase.com`); se o painel mostrar outro, passe-o como terceiro argumento.

Os da Cloudflare pedem o valor sem mostrar na tela:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

**4. GitHub: variáveis.** Não são segredo: a publishable key e as URLs vão parar no site de qualquer jeito.

```bash
gh variable set STAGING_SUPABASE_URL --body "https://<ref-staging>.supabase.co"
gh variable set STAGING_SUPABASE_PUBLISHABLE_KEY --body "sb_publishable_..."
gh variable set STAGING_SITE_URL --body "https://amigo-oculto-staging.<subdomínio>.workers.dev"
gh variable set PROD_SUPABASE_URL --body "https://<ref-producao>.supabase.co"
gh variable set PROD_SUPABASE_PUBLISHABLE_KEY --body "sb_publishable_..."
gh variable set PROD_SITE_URL --body "https://amigo-oculto.<subdomínio>.workers.dev"
gh variable set DEPLOY_ATIVO --body true
```

**5. Primeiro deploy:** em Actions > Deploy > Run workflow, na `main`. O staging sobe sozinho; produção espera a sua aprovação (Review deployments > producao > Approve).

## Usando com a família

1. Abra o site, toque em **Criar sorteio**, preencha e toque em **Sortear**.
2. Você cai no **painel do organizador**. Guarde esse link: ele tem um código secreto só seu e não dá para recuperar depois.
3. Toque em **Enviar no WhatsApp** para mandar o link do grupo.
4. Acompanhe pelo painel quem já escolheu o nome.

## Redefinir o PIN de alguém

No painel do organizador, na linha da pessoa, toque em **Redefinir PIN** e confirme. O nome volta a ficar livre, a pessoa toca nele de novo e cria outro PIN. O sorteio não muda.

Serve para três casos: a pessoa esqueceu o PIN, ficou bloqueada e não quer esperar os 10 minutos, ou alguém pegou o nome errado.

## Projeto Supabase pausado

O plano grátis pausa projetos com pouca atividade em 7 dias. O sintoma no site é "Não consegui falar com o servidor".

1. Entre no painel do Supabase e abra o projeto.
2. Clique em **Resume project** (ou **Restore**). Leva alguns minutos; os dados continuam lá.
3. Abra o site e confira se o link do grupo carrega.

O workflow **Vigia** evita a pausa: a cada 6 horas ele chama `evento_publico` com um código inexistente nos dois projetos, o que conta como atividade no banco.

## Apagar um evento de teste

Não existe botão para isso. No Supabase, em **SQL Editor**, confira primeiro o que vai apagar:

```sql
select e.codigo, e.titulo, e.criado_em,
       (select count(*) from amigo_oculto.participantes p where p.evento_id = e.id) as pessoas
from amigo_oculto.eventos e
order by e.criado_em desc;
```

Depois apague pelo código (o trecho de 10 caracteres que aparece no link, depois de `#/e/`):

```sql
delete from amigo_oculto.eventos where codigo = 'COLE_O_CODIGO_AQUI';
```

Os participantes e as listas de desejos do evento vão junto. Não tem como desfazer.

## Staging acumula sorteios de teste

Cada deploy roda o E2E no staging, e cada E2E cria um sorteio de 8 pessoas fictícias. De vez em quando, **só no projeto de staging**, apague os antigos no SQL Editor:

```sql
delete from amigo_oculto.eventos where criado_em < now() - interval '1 day';
```

## Aplicar migrações

O banco é descrito pelos arquivos de `supabase/migrations/`, aplicados em ordem pelo nome. Mudança no banco é sempre um arquivo novo (`npx supabase migration new <nome>`), nunca edição de um arquivo já aplicado.

A migração inicial tem três linhas de limpeza (`drop function ... enviar_recado`, `drop function ... conversa`, `drop table ... recados`). Elas só fazem efeito num projeto que rodou a versão antiga do protótipo, que tinha recados anônimos. Num banco novo não fazem nada.

No merge na `main`, o workflow **Deploy** aplica as migrações novas no Supabase de staging (`supabase db push`), publica o staging e roda os testes nele. Produção só recebe as migrações depois da sua aprovação no ambiente `producao`. Migração já aplicada não roda de novo: o Supabase guarda o histórico.

Para ver o que seria aplicado, sem aplicar:

```bash
npx supabase db push --remote="<URL do session pooler>" --dry-run
```

Migração não tem "desfazer" automático. Para voltar atrás, escreva uma migração nova que desfaça a anterior.

## Reverter um deploy

O site e o banco voltam separados.

- **Site, rápido:** no painel da Cloudflare, Workers & Pages > `amigo-oculto` > Deployments, escolha a versão anterior e clique em **Rollback**. Pelo terminal, com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no ambiente: `npx wrangler rollback --name amigo-oculto`.
- **Site, definitivo:** reverta o commit num PR (`git revert`) e faça o merge. O deploy publica a versão revertida.
- **Banco:** veja "Aplicar migrações". O rollback do site não desfaz migração.

## Vigia (disponibilidade)

O workflow **Vigia** roda a cada 6 horas, para staging e produção. Ele confere se a página abre com a CSP certa, se o `config.js` aponta para o Supabase do ambiente e se a API responde. Se falhar duas vezes seguidas (com 30 s de intervalo), o job fica vermelho e o GitHub manda e-mail. Confira se as notificações de Actions estão ligadas em github.com > Settings > Notifications.

Para rodar na hora: Actions > Vigia > Run workflow.

Em repositório público, o GitHub desliga agendamentos depois de 60 dias sem atividade no repositório. Se acontecer, reative em Actions > Vigia.

## Backup

A preencher na fase 6. O dump do banco contém quem tirou quem, então só é guardado cifrado.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Faixa "Demonstração" no site publicado | O `config.js` publicado está vazio: confira as variáveis `*_SUPABASE_URL` e `*_SUPABASE_PUBLISHABLE_KEY` e publique de novo. |
| "O servidor respondeu com erro (… function … not found)" | O banco não tem as funções. Confira se o passo de migrações do Deploy rodou e se a Data API está ligada no projeto. |
| "Não consegui falar com o servidor" | O projeto pode estar pausado (veja acima) ou a URL do Supabase do ambiente está errada. |
| "Invalid API key" | Confira a publishable key. Não pode ter espaço sobrando. |
| Deploy falha com "IPv6 is not supported" | O `SUPABASE_DB_URL` é a conexão direta. Use a URL do **Session pooler**. |

## Limitações conhecidas

Não são defeitos; é como o site foi desenhado.

- **Quem toca primeiro num nome fica com ele.** Se alguém pegar o nome errado, o organizador redefine o PIN, mas essa pessoa já viu o resultado daquele nome. É o mesmo limite dos sites de sorteio que só pedem o nome.
- **A lista de participantes não muda depois do sorteio.** Se faltou alguém, cria-se um sorteio novo.
- **Bloqueio de PIN:** 5 tentativas erradas seguidas bloqueiam o nome por 10 minutos.
- **Qualquer pessoa com o endereço do site consegue criar sorteios.** O limite contra abuso está no backlog.
- **Quem administra o banco consegue ver o resultado.** O site não mostra o sorteio nem ao organizador, mas quem tem acesso ao projeto no Supabase (ou a um backup) pode ler as tabelas.
