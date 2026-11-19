# Decisões

Registro das decisões relevantes do projeto. Cada entrada tem data, decisão, alternativas consideradas, motivo e quem decidiu. Entradas novas vão no fim; decisão revista ganha entrada nova que cita a antiga.

## D-01 · Padrões de infraestrutura: os dos repositórios da Akyoma

- **Data:** 19/11/2026
- **Decisão:** estrutura, branches, commits e CI seguem o que os repositórios da Akyoma já usam (olhado no `jogo-template`): branches `tipo/descricao`, commits em frase em português sem prefixo, PR com merge commit, um `ci.yml` no GitHub Actions com Node 22 e `npm ci`, dependências com versão exata, segredos no cofre do GitHub Actions.
- **Alternativas:** inventar um padrão novo; Conventional Commits.
- **Motivo:** a referência passada no início (artigo do Emil Kowalski) fala de animação, não de repositório. Usar o padrão que o Pedro já pratica evita aprender outro.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-02 · Produção publica no merge na `main`; PR ganha preview

- **Data:** 19/11/2026
- **Decisão:** merge na `main` publica em produção; cada PR ganha um preview apontando para o Supabase de staging.
- **Alternativas:** publicar só em release ou disparo manual, como os jogos da Akyoma.
- **Motivo:** foi o pedido original e o prazo é curto. Diverge de propósito do padrão dos jogos (D-01).
- **Quem decidiu:** Pedro.

## D-03 · Hospedagem do site: Cloudflare Workers com assets estáticos

- **Data:** 19/11/2026
- **Decisão:** Cloudflare Workers só de assets, na conta pessoal do Pedro.
- **Alternativas:** Vercel, Netlify, Cloudflare Pages, GitHub Pages (este não permite cabeçalhos próprios, então não atende à CSP pedida).
- **Motivo:** é o que os jogos já usam, aceita cabeçalhos de segurança por arquivo e tem URL de preview. Os detalhes são confirmados na documentação na fase 4.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-04 · Supabase: dois projetos, staging e produção

- **Data:** 19/11/2026
- **Decisão:** dois projetos separados na região de São Paulo.
- **Alternativas:** um projeto só, com os previews em modo demonstração.
- **Motivo:** testar migração e deploy sem tocar nos dados da família.
- **Pendente:** confirmar que há duas vagas livres no plano grátis da organização.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-05 · Domínio: subdomínio do provedor

- **Data:** 19/11/2026
- **Decisão:** usar o subdomínio do provedor de hospedagem. Domínio próprio fica no backlog.
- **Alternativas:** comprar e configurar um domínio agora.
- **Motivo:** prazo; o link chega por WhatsApp e ninguém digita o endereço.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-06 · Backup: `pg_dump` diário cifrado

- **Data:** 19/11/2026
- **Decisão:** `pg_dump` diário cifrado com `age`, guardado como artefato do GitHub Actions por 14 dias. A chave privada fica só com o Pedro.
- **Alternativas:** dump em claro num repositório privado; pasta no Google Drive; não fazer backup.
- **Motivo:** o plano grátis do Supabase não tem backup. O dump contém quem tirou quem, e o repositório é público (D-07), então o arquivo precisa estar cifrado.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-07 · Dono e visibilidade: conta pessoal, repositório público

- **Data:** 19/11/2026
- **Decisão:** repositório na conta pessoal `meiraPh`, público. Supabase e Cloudflare também em contas pessoais.
- **Alternativas:** organização Akyoma-Studio; repositório privado.
- **Motivo:** é um projeto de família, não da empresa. No plano grátis do GitHub, proteção de branch e ambiente com aprovação manual só existem em repositório público. O repositório não guarda segredo nenhum: a chave publicável do Supabase não é secreta e, mesmo assim, entra só no deploy.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-08 · Limite contra abuso em `criar_evento`: backlog

- **Data:** 19/11/2026
- **Decisão:** não fazer agora.
- **Alternativas:** limitar por IP ou por tempo já na primeira versão.
- **Motivo:** uso em família, link não divulgado, prazo curto.
- **Quem decidiu:** Pedro.

## D-09 · Site em `src/`, `package.json` na raiz

- **Data:** 19/11/2026
- **Decisão:** os arquivos do site foram movidos para `src/` sem alteração de conteúdo; o `package.json` dos testes subiu para a raiz.
- **Alternativas:** deixar o site na raiz e filtrar no deploy o que não pode ser publicado.
- **Motivo:** segue a estrutura dos repositórios da Akyoma (D-01) e cria uma fronteira clara: só `src/` vai para a hospedagem, então `tests/` e `supabase/` não são publicados por engano.
- **Quem decidiu:** Claude, dentro do pedido da fase 1.

## D-10 · Banco local: Postgres portátil; stack do Supabase só no CI

- **Data:** 19/11/2026
- **Decisão:** nesta máquina os testes de banco rodam num PostgreSQL portátil. `supabase start` e `supabase db reset` são comprovados no GitHub Actions.
- **Alternativas:** instalar Docker Desktop e WSL2 na máquina do Pedro.
- **Motivo:** a máquina não tem Docker nem WSL; instalar exige admin e reinício, e o CI já tem Docker.
- **Quem decidiu:** Pedro.

## D-11 · Animações ficam como estão

- **Data:** 19/11/2026
- **Decisão:** nenhuma mudança nas animações.
- **Alternativas:** encurtar a abertura do papelzinho (0,9 s).
- **Motivo:** conferido contra o artigo "You Don't Need Animations": as transições de interface ficam entre 150 e 250 ms, a única animação longa é a do papelzinho, que é rara e tem propósito, e `prefers-reduced-motion` já é respeitado.
- **Quem decidiu:** Claude, sobre a referência indicada pelo Pedro.

## D-12 · Fluxo de PR: Claude abre, Pedro faz o merge

- **Data:** 19/11/2026
- **Decisão:** depois da linha de base, toda mudança entra por PR contra a `main`. O Claude abre o PR e o Pedro faz o merge. A `main` exige PR e, a partir da fase 3, CI verde. Não exige aprovação de segunda pessoa, porque o Pedro é o único responsável.
- **Alternativas:** o Claude fazer o merge sozinho quando o CI passar.
- **Motivo:** o merge na `main` vai publicar em produção (D-02); essa decisão fica com o dono.
- **Quem decidiu:** recomendação do Claude, a confirmar com o Pedro.

## D-13 · Migração inicial idêntica ao `schema.sql`

- **Data:** 19/11/2026
- **Decisão:** o `supabase/schema.sql` virou `supabase/migrations/20261119000000_esquema_inicial.sql` por renomeação, sem mudar nenhum byte. O `schema.sql` deixou de existir; as migrações são a única fonte do banco.
- **Alternativas:** manter o `schema.sql` ao lado das migrações; limpar a migração (tirar a remoção de recados e o comentário que manda colar no SQL Editor).
- **Motivo:** arquivo idêntico prova que o comportamento não mudou. Duas fontes do mesmo SQL acabam divergindo. A limpeza de recados é inofensiva em banco novo e está explicada em [operacao.md](operacao.md); os comentários desatualizados ficaram no backlog (B-04).
- **Quem decidiu:** Claude, dentro do pedido da fase 2.

## D-14 · O emulador da API continua, para desenvolvimento

- **Data:** 19/11/2026
- **Decisão:** `tests/server.js` mantém o modo `real` (emulador da rota RPC) e ganha o modo `supabase`, que aponta o site para uma API de verdade. O CI usa só a API de verdade.
- **Alternativas:** apagar o emulador.
- **Motivo:** nesta máquina não há Docker (D-10), então o emulador é o único jeito de rodar o E2E com o SQL real fora do CI.
- **Quem decidiu:** Claude, dentro do pedido da fase 3.

## D-15 · Diretrizes de design: referências do Pedro e do Matheus

- **Data:** 19/11/2026
- **Decisão:** as cinco referências que o Matheus mandou (designsystemchecklist.com, transitions.dev, beautifului.dev, `heliocosta-dev/revenue-centric-design` e `heydamir/unslop`), mais o artigo do Emil Kowalski, valem como diretriz de design para tudo o que for criado ou alterado daqui para a frente. O resumo aplicável e a auditoria do site atual estão em [design.md](design.md).
- **Alternativas:** redesenhar o site atual para seguir as referências; instalar as skills e plugins que três delas oferecem para agentes.
- **Motivo:** o visual atual foi aprovado e não muda sem pedido, então os desvios da auditoria viraram itens de backlog (D-01 a D-05 do backlog) para o Pedro decidir. Nada foi instalado: as referências foram lidas como texto.
- **Quem decidiu:** Pedro.
