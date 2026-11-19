# Amigo Oculto

Site de amigo oculto feito para a família. O organizador cadastra os nomes e o servidor faz o sorteio. Cada pessoa pega o próprio nome criando um PIN de 4 números e pode rever o resultado quando quiser. Nem o organizador consegue ver quem tirou quem.

## O que ele faz

- **Sorteio no servidor**, de 3 a 100 participantes, com bloqueio de nomes repetidos.
- **Quem não pode tirar quem**: restrições para casais, pais e filhos etc., num sentido só ou nos dois.
- **Sorteio em corrente** (opcional, já vem ligado): forma uma roda única A → B → C → … → A.
- **Um link só para o grupo do WhatsApp**, com botão de envio pronto.
- **Pegar o nome com PIN**: no primeiro acesso a pessoa cria o PIN e o nome fica preso a ela. Depois é só nome + PIN.
- **Proteção do PIN**: guardado com bcrypt. Depois de 5 erros seguidos, o nome bloqueia por 10 minutos.
- **Painel do organizador** num link secreto: quem já escolheu, quem falta, quem foi bloqueado, e o botão **Redefinir PIN**. O resultado do sorteio não muda e não aparece ali. O aparelho que abriu o painel lembra dele na página inicial, e há um botão para mandar o link para si mesmo.
- **Lista de desejos com links**: camisa, calça e calçado em campos próprios, outras preferências, e presentes com nome, link da loja, preço aproximado e observação. O cartão mostra o nome da loja (Amazon, Mercado Livre, Magalu...) e "cerca de R$ 90". Só quem tirou a pessoa vê.
- **Horário, local e agenda**: o sorteio pode ter horário e local da troca, e cada pessoa adiciona o evento ao Google Agenda ou à agenda do iPhone (o evento nunca leva quem ela tirou).

## Estrutura

```
src/                o site (é só isto que vai para a hospedagem)
  index.html        página única
  styles.css        visual
  app.js            telas e rotas por hash
  api.js            camada de dados: Supabase ou modo demonstração
  config.js         URL e chave pública do Supabase (vazio = modo demonstração; o deploy gera o seu)
  fonts/            Instrument Serif e Figtree (licença OFL)
supabase/           banco (PostgreSQL no Supabase)
  config.toml       configuração da stack local da Supabase CLI
  migrations/       o SQL do banco, em migrações versionadas
scripts/site.js     monta o site para publicar: config.js e cabeçalhos (CSP, cache) do ambiente
tests/              testes de SQL, da API, do build e de navegador (ver tests/README.md)
.github/workflows/  CI, deploy e vigia
wrangler.jsonc      Worker da Cloudflare que serve o site
docs/               decisões, backlog, operação e design
```

O site não tem framework nem bundler: são arquivos estáticos. O "build" só copia `src/` e gera o que muda por ambiente.

## Rodar local

Abra `src/index.html` no navegador. Com o `config.js` vazio o site roda em **modo demonstração**: tudo funciona, mas os dados ficam só naquela aba. Na tela de criação há o botão "Preencher exemplo".

Para servir por HTTP, como na hospedagem:

```bash
npm ci
npm run serve:demo    # http://localhost:8091
```

## Testar

```bash
npm ci
npx playwright install chromium
npm run serve:demo &
npm run test:e2e:demo
```

Os testes com banco precisam de um Postgres local ou da stack local do Supabase (`npx supabase start`, que exige Docker). O passo a passo está em [tests/README.md](tests/README.md).

O CI (`.github/workflows/ci.yml`) roda tudo em todo pull request: sobe a stack do Supabase, recria o banco só com as migrações e roda os testes de SQL, os testes da API, o E2E contra o PostgREST de verdade e o E2E em modo demonstração.

Toda regra de negócio existe em dois lugares: no SQL (`supabase/`) e no modo demonstração (`src/api.js`). Mudou num, muda no outro e nos testes.

## Deploy

Automático, pelo GitHub Actions (`.github/workflows/deploy.yml`):

- **Pull request:** preview do site apontando para o Supabase de staging, com E2E.
- **Merge na `main`:** migrações e site em staging, com testes; depois produção, com aprovação manual.

O site vai para a Cloudflare (Workers, só arquivos estáticos). `npm run build` copia `src/` para `dist/` e gera o `config.js` e os cabeçalhos (CSP estrita, cache) do ambiente. URLs e chaves ficam em variáveis e segredos do GitHub, nunca no repositório. O build recusa chave secret ou service_role.

A configuração inicial (contas, segredos, variáveis), como reverter um deploy e o workflow Vigia (disponibilidade e keep-alive) estão em [docs/operacao.md](docs/operacao.md).

## Segurança

- As tabelas ficam no esquema `amigo_oculto`, que a API do Supabase não expõe. O RLS está ligado, sem nenhuma política.
- O site só chama 7 funções do esquema `public` (`criar_evento`, `evento_publico`, `resgatar`, `entrar`, `salvar_lista`, `painel`, `resetar_pin`). Cada uma confere o PIN ou o token antes de responder.
- `evento_publico` e `painel` nunca devolvem o resultado do sorteio. Ele só sai por `resgatar` ou `entrar`, e só para a própria pessoa.
- O link do organizador tem um token de 144 bits; o banco guarda só o SHA-256 dele.
- Links das listas só são aceitos com `http://` ou `https://`, no site e no banco.
- Os caminhos de PIN respondem com `{ok:false, erro:'...'}` em vez de `raise`, para o contador de tentativas não sofrer rollback.

## Para quem for mexer

- Menor mudança necessária. O visual foi aprovado e não muda sem pedido.
- Sem framework, sem bundler, sem analytics nem scripts de terceiros.
- Recados anônimos foram removidos de propósito e não voltam.
- Decisões vão para [docs/decisoes.md](docs/decisoes.md); ideias e tarefas, para [docs/backlog.md](docs/backlog.md).
- O dia a dia (redefinir PIN, projeto pausado, apagar evento de teste) está em [docs/operacao.md](docs/operacao.md).
- As diretrizes de design e a auditoria do visual atual estão em [docs/design.md](docs/design.md).
