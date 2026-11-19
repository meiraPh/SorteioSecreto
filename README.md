# Amigo Oculto

Site de amigo oculto feito para a família. O organizador cadastra os nomes e o servidor faz o sorteio. Cada pessoa pega o próprio nome criando um PIN de 4 números e pode rever o resultado quando quiser. Nem o organizador consegue ver quem tirou quem.

## O que ele faz

- **Sorteio no servidor**, de 3 a 100 participantes, com bloqueio de nomes repetidos.
- **Quem não pode tirar quem**: restrições para casais, pais e filhos etc., num sentido só ou nos dois.
- **Sorteio em corrente** (opcional, já vem ligado): forma uma roda única A → B → C → … → A.
- **Um link só para o grupo do WhatsApp**, com botão de envio pronto.
- **Pegar o nome com PIN**: no primeiro acesso a pessoa cria o PIN e o nome fica preso a ela. Depois é só nome + PIN.
- **Proteção do PIN**: guardado com bcrypt. Depois de 5 erros seguidos, o nome bloqueia por 10 minutos.
- **Painel do organizador** num link secreto: quem já escolheu, quem falta, quem foi bloqueado, e o botão **Redefinir PIN**. O resultado do sorteio não muda e não aparece ali.
- **Lista de desejos com links**: tamanhos e preferências, e presentes com nome, link da loja e observação. Só quem tirou a pessoa vê.

## Estrutura

```
src/                o site (é só isto que vai para a hospedagem)
  index.html        página única
  styles.css        visual
  app.js            telas e rotas por hash
  api.js            camada de dados: Supabase ou modo demonstração
  config.js         URL e chave pública do Supabase (vazio = modo demonstração)
  fonts/            Instrument Serif e Figtree (licença OFL)
supabase/           banco (PostgreSQL no Supabase)
tests/              testes de SQL e de navegador (ver tests/README.md)
docs/               decisões, backlog e operação
```

O site não tem framework nem build: são arquivos estáticos.

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

Os testes com banco (`test:sql` e `test:e2e:real`) precisam de um Postgres local. O passo a passo está em [tests/README.md](tests/README.md).

Toda regra de negócio existe em dois lugares: no SQL (`supabase/`) e no modo demonstração (`src/api.js`). Mudou num, muda no outro e nos testes.

## Deploy

Ainda não automatizado: entra nas fases 4 e 5 do [backlog](docs/backlog.md). O destino decidido é Cloudflare para o site e dois projetos Supabase (staging e produção) para o banco; veja [docs/decisoes.md](docs/decisoes.md).

Até lá, o caminho manual é:

1. No Supabase, rodar `supabase/schema.sql` inteiro no SQL Editor do projeto.
2. Preencher `src/config.js` com a Project URL e a **publishable key** (`sb_publishable_...`). Nunca a chave secret / service_role.
3. Publicar a pasta `src/` numa hospedagem de site estático.

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
