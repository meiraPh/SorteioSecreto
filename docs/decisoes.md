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
- **Confirmado em 19/11/2026:** a conta não tinha organização nem projetos. Foi criada a organização grátis "meiraPh's Org", com `amigo-oculto-staging` e `amigo-oculto` em São Paulo.
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

## D-16 · Build mínimo: copiar `src/` e gerar config e cabeçalhos

- **Data:** 19/11/2026
- **Decisão:** `scripts/site.js` copia `src/` para `dist/` sem transformar nada e gera o `config.js` e o `_headers` do ambiente. O build recusa chave secret e service_role. O servidor de teste usa as mesmas funções, então o E2E roda com a CSP de verdade.
- **Alternativas:** bundler; publicar `src/` direto com o `config.js` versionado.
- **Motivo:** a regra é sem bundler e sem valores no repositório. Gerar a CSP com a origem da API de cada ambiente deixa o `connect-src` restrito a ela.
- **Quem decidiu:** Claude, dentro do pedido da fase 4.

## D-17 · CSP estrita e cabeçalhos

- **Data:** 19/11/2026
- **Decisão:** `default-src 'self'`, `script-src` e `style-src` só `'self'` (sem `unsafe-inline`), `img-src 'self' data:`, `font-src 'self'`, `connect-src` com a API do ambiente, `frame-ancestors 'none'`, além de `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` fechada e `nosniff`. Cache: `no-cache` em tudo e um ano nas fontes. Os dois `style` inline (`copiar` em `app.js` e o `<noscript>`) viraram classes com o mesmo efeito.
- **Alternativas:** cache longo em JS e CSS, que exigiria hash no nome dos arquivos, ou seja, um build de verdade.
- **Motivo:** `no-cache` ainda aproveita o cache (o navegador revalida) e garante que todo mundo recebe a versão nova logo depois de um deploy. A CSP foi conferida com uma prova negativa: o `textarea` antigo, com a CSP nova, é bloqueado e gera erro no console, que o E2E acusa.
- **Quem decidiu:** Claude, dentro do pedido da fase 4.

## D-18 · Migrações pela URL do session pooler

- **Data:** 19/11/2026
- **Decisão:** o CI aplica migrações com `supabase db push --remote=<URL do session pooler>`. A URL fica como segredo `SUPABASE_DB_URL` em cada ambiente do GitHub, e a de produção só é liberada depois da aprovação manual.
- **Alternativas:** token pessoal do Supabase mais senha do banco (`supabase link`).
- **Motivo:** a conexão direta do Supabase é só IPv6, e os runners do GitHub não têm IPv6 (a CLI avisa). A URL do pooler resolve isso e dispensa o token pessoal, que daria acesso à conta inteira.
- **Quem decidiu:** Claude, dentro do pedido da fase 5. Substitui os segredos `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD_*` sugeridos antes.

## D-19 · Configuração em variáveis do repositório; deploy desligado até tudo estar pronto

- **Data:** 19/11/2026
- **Decisão:** URLs e publishable keys ficam em variáveis do repositório com prefixo `STAGING_` e `PROD_`. O deploy e o vigia só rodam com `DEPLOY_ATIVO=true`. Os ambientes `staging` e `producao` do GitHub só aceitam deploy da `main`, e `producao` exige aprovação do Pedro.
- **Alternativas:** variáveis por ambiente do GitHub.
- **Motivo:** o vigia precisa ler as URLs de produção sem pedir aprovação a cada 6 horas. Com o interruptor, os PRs não ficam vermelhos enquanto as contas não existem.
- **Quem decidiu:** Claude, dentro do pedido das fases 4 a 6.

## D-20 · Vigia a cada 6 horas faz o keep-alive e o monitoramento

- **Data:** 19/11/2026
- **Decisão:** um workflow agendado confere a página, o `config.js` e a API dos dois ambientes a cada 6 horas. A chamada a `evento_publico` com código inexistente é o keep-alive, e o alerta é o e-mail do GitHub quando o job falha.
- **Alternativas:** keep-alive semanal separado; serviço externo de monitoramento.
- **Motivo:** um workflow só cobre as duas coisas, sem conta nova e sem mudar o schema. Seis horas basta para o prazo e fica longe do limite de uso do Actions.
- **Quem decidiu:** Claude, dentro do pedido da fase 6.

## D-21 · Tamanhos em campos, guardados no mesmo texto

- **Data:** 19/11/2026
- **Decisão:** "Tamanhos e preferências" virou camisa (PP a XG), calça e calçado (só números) e outras preferências. Tudo continua na coluna `tamanhos` (texto), uma linha por campo: `Camisa: M`, `Calça: 40`, `Calçado: 37`, `Outras: ...`. Texto antigo, sem rótulo, aparece como "Outras".
- **Alternativas:** colunas novas no banco, com migração e regra no SQL e no modo demonstração.
- **Motivo:** menor mudança. O banco e o modo demonstração não mudam (o limite de 300 caracteres continua), e as listas já salvas seguem aparecendo.
- **Quem decidiu:** pedido do Pedro (feedback 4 da rodada 1); formato de gravação escolhido pelo Claude.

## D-22 · Painel do organizador: recuperar sem abrir porta nova

- **Data:** 19/11/2026
- **Decisão:** três caminhos, nenhum público: (1) o aparelho que abriu o painel lembra dele na página inicial (armazenamento do navegador, até 5 sorteios, nunca no modo demonstração); (2) botão "Mandar para mim", que usa o compartilhar do celular ou, sem ele, o WhatsApp; (3) quem administra o banco gera um link novo por SQL, e o antigo para de funcionar (passo a passo em operacao.md).
- **Alternativas:** código de recuperação de 12 caracteres, guardado como hash e com bloqueio após erros; senha do organizador.
- **Motivo:** quem entra no painel pode redefinir o PIN de alguém e ver o resultado daquela pessoa, então o acesso ao painel é tão sensível quanto o próprio sorteio. Senha seria adivinhável por quem tem o link do grupo. O código de recuperação seria seguro, mas é mais uma função pública, e quem perde o link costuma perder o código junto. Limite: no aparelho que lembra do painel, quem pegar o celular destravado também abre, como já acontece com a conversa do WhatsApp.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-23 · Horário, local e "Adicionar à agenda"

- **Data:** 19/11/2026
- **Decisão:** o sorteio ganha horário (`HH:MM`) e local, ambos opcionais (migração `20261119180000_horario_e_local.sql`, com a mesma regra no SQL e no modo demonstração). No papelzinho, dois botões: **Google Agenda** (link que abre o evento preenchido) e **Agenda do iPhone** (arquivo `.ics`). O evento dura 3 horas, usa o horário de Brasília (UTC-3 o ano todo) e leva título, organização, valor, recado e o link do grupo. **Nunca leva quem a pessoa tirou.** Sem horário, vira evento de dia inteiro.
- **Alternativas:** só a data, sem mexer no banco; integração com a API das agendas.
- **Motivo:** sem horário e local o evento sai incompleto. Integração de verdade exigiria login e permissões. Limite honesto: um toque abre o evento preenchido; salvar é o toque do próprio app de agenda. O `.ics` no iPhone, aberto de dentro do WhatsApp, precisa ser conferido num aparelho de verdade (checklist do go-live).
- **Consequência:** o sorteio não pode ser editado depois, então o sorteio real da família precisa ser criado depois que esta mudança estiver em produção.
- **Quem decidiu:** Pedro, sobre recomendação do Claude.

## D-24 · Dedicatória e dois easter eggs

- **Data:** 19/11/2026
- **Decisão:** o título da página inicial passou a ser "Com carinho, *para a Maria Clara.*". Dois easter eggs: tocar no papelzinho da ilustração da página inicial troca "Júlia" por "Maria Clara" e o rodapé por "Eu tiraria você todo ano." (tocar de novo desfaz); três toques seguidos no selo da marca mostram o aviso "Este site existe por sua causa, Maria Clara.". Nenhuma animação nova.
- **Alternativas:** "Feito para a família da Maria Clara."; "Para a Maria Clara e a nossa família."
- **Motivo:** pedido do Pedro, com o texto escolhido entre três opções. É uma exceção deliberada à regra de não mexer no visual aprovado. Quando o nome está trocado, a fonte do papelzinho diminui um pouco para "Maria Clara" caber em telas de 320 px.
- **Quem decidiu:** Pedro.

## D-25 · Papelzinho da página inicial mostra "XXXX"

- **Data:** 19/11/2026
- **Decisão:** a ilustração da página inicial mostra "XXXX" (no mesmo itálico serifado) no lugar de "Júlia". O easter egg de D-24 continua: tocar troca por "Maria Clara" e o recado, e tocar de novo volta para "XXXX".
- **Alternativas:** manter um nome de exemplo.
- **Motivo:** pedido do Pedro depois de ver o staging. Revê D-24 só neste ponto.
- **Quem decidiu:** Pedro.
