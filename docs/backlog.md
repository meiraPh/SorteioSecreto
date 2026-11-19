# Backlog

Cada tarefa tem critério de aceite e responsável. Estados: `a fazer`, `fazendo`, `aguardando` (depende de alguém), `pronto no código` (falta rodar com as contas), `feito`.

## Fases da infraestrutura

| # | Tarefa | Critério de aceite | Responsável | Estado |
|---|---|---|---|---|
| F0 | Reconhecimento e plano | Testes do zip rodando localmente; plano aprovado | Claude | feito (19/11/2026) |
| F1.1 | Linha de base no git | Primeiro commit idêntico ao zip, byte a byte | Claude | feito |
| F1.2 | Estrutura, README e docs | Site abre localmente em modo demonstração; testes verdes depois da reorganização | Claude | feito |
| F1.3 | Repositório no GitHub e proteção da `main` | `main` só aceita mudança por PR | Claude | feito |
| F2.1 | Supabase CLI e migração versionada | `supabase db reset` recria tudo; `sql-test` verde; SQL idêntico ao `schema.sql` | Claude | feito (CI verde no PR 1) |
| F2.2 | Prova de que nenhuma tabela aparece na API | Teste automático contra o PostgREST real (`tests/api-test.js`) | Claude | feito (CI verde no PR 1) |
| F2.3 | Criar os projetos de staging e produção no Supabase | Dois projetos em São Paulo; passo 1 de "Configuração inicial" em operacao.md | Pedro | feito (19/11/2026) |
| F3 | CI em todo PR | SQL, E2E contra PostgREST real e E2E demo obrigatórios para o merge; capturas como artefato | Claude | feito; job Testes obrigatório na `main` |
| F4.1 | Conta na Cloudflare, segredos e variáveis | Passos 2 a 4 de "Configuração inicial" em operacao.md | Pedro | feito (19/11/2026) |
| F4.2 | Deploy do site | Staging e produção no ar; `config.js` gerado no deploy; CSP sem `unsafe-inline`; smoke E2E contra staging | Claude | pronto no código (PR 2) |
| F4.3 | Trocar `style` inline por classe | `copiar` em `app.js` e `<noscript>` em `index.html` sem atributo `style`; E2E sem violação de CSP no console | Claude | feito (PR 2) |
| F5 | Pipeline de migrações | Migração inofensiva passa por staging, aprovação manual e produção | Claude | pronto no código (PR 2) |
| F6.1 | Keep-alive do plano grátis | Tarefa agendada chamando `evento_publico` com código inexistente, rodando | Claude | pronto no código (Vigia, PR 2) |
| F6.2 | Backup cifrado | `pg_dump` diário cifrado com `age`, artefato por 14 dias; restauração testada uma vez | Claude (chave pública: Pedro) | aguardando a chave pública `age` do Pedro |
| F6.3 | Monitoramento | Checagem da página e da RPC com alerta para o Pedro | Claude | pronto no código (Vigia, PR 2) |
| F6.4 | Runbook | `docs/operacao.md` completo e revisado | Pedro revisa | a fazer |
| F7 | Go-live | Sorteio de teste com 3 nomes criado e apagado em produção; teste em iOS e Android pelo WhatsApp; cabeçalhos revisados; Pedro cria o sorteio real | Pedro | a fazer |

## Ideias e pendências (sem data)

| # | Item | Critério de aceite | Responsável | Estado |
|---|---|---|---|---|
| B-01 | Limite contra abuso em `criar_evento` | Criações em excesso são recusadas sem atrapalhar o uso normal; regra igual no SQL e no modo demonstração | a definir | a fazer |
| B-02 | Domínio próprio | Site responde no domínio com HTTPS; CSP e links atualizados | Pedro decide | a fazer |
| B-03 | Docker na máquina do Pedro | `supabase start` roda localmente | Pedro decide | a fazer |
| B-04 | Atualizar comentários que ainda citam `schema.sql` | O cabeçalho da migração e os comentários de `src/api.js`, `tests/server.js` e `tests/sql-test.js` citam `supabase/migrations/` | Claude | a fazer |
| B-05 | Limpar sorteios de teste do staging automaticamente | O E2E do deploy apaga o próprio sorteio, ou um job apaga os de mais de 1 dia; nunca roda em produção | Claude | a fazer |

## Feedback da rodada 1 (staging, 19/11/2026)

Prioridade definida pelo Pedro: 4, 5, 2, 1, 3.

| # | Item | Critério de aceite | Responsável | Estado |
|---|---|---|---|---|
| R1-4 | Tamanhos em campos rotulados | Camisa PP a XG, calça e calçado só com números, outras preferências; quem tirou vê "Camisa M · Calça 40 · Calçado 37"; listas antigas continuam aparecendo (D-21) | Claude | feito no PR da rodada 1; falta o teste do Pedro no preview |
| R1-5 | Recuperar o painel do organizador | Aparelho lembra do painel; botão "Mandar para mim"; SQL de link novo no runbook, testado; nenhuma função pública nova (D-22) | Claude | feito no PR da rodada 1; falta o teste do Pedro no preview |
| R1-2 | Dedicatória e easter eggs | Título "Com carinho, para a Maria Clara."; papelzinho e selo com os recados (D-24) | Claude | feito no PR da rodada 1; falta o teste do Pedro no preview |
| R1-1 | Adicionar à agenda | Horário e local opcionais na criação; Google Agenda e `.ics` com os dados certos e sem o resultado; conferido no celular aberto pelo WhatsApp (iOS e Android) (D-23) | Claude; teste no celular: Pedro | feito no PR da rodada 1; falta o teste em iOS e Android |
| R1-3 | Foto de perfil | Ver proposta abaixo; Pedro decide antes de começar | Pedro decide | aguardando |

### Proposta para R1-3 (foto de perfil), ainda não aprovada

- **Como guardar:** sem Supabase Storage. A foto é reduzida e comprimida no próprio celular (96×96, JPEG, cerca de 6 KB) e gravada no banco por uma função nova que confere o PIN, como a lista de desejos, com limite de tamanho no servidor. A imagem volta como `data:`, que a CSP já permite (`img-src 'self' data:`). Nenhum serviço novo e nenhuma tabela exposta.
- **Onde aparece:** no lugar das iniciais, na lista do grupo, no papelzinho e no painel. Quem não tiver foto continua com as iniciais.
- **Privacidade:** a lista do grupo é aberta para quem tem o link, então as fotos também ficam. Pode haver criança na família. A foto é sempre opcional, e a pessoa pode tirar quando quiser.
- **Custo:** função nova no SQL e no modo demonstração, migração, testes e tela de upload. É a maior das cinco.
- **Quando:** depois do go-live. Ao contrário do horário e local, dá para acrescentar com o sorteio já criado, porque cada pessoa põe a própria foto.

## Design (da auditoria em [design.md](design.md))

Nenhum destes foi feito: o visual aprovado não muda sem o aval do Pedro.

| # | Item | Critério de aceite | Responsável | Estado |
|---|---|---|---|---|
| D-01 | Aumentar os alvos de toque sem mudar o desenho | "Sou {nome}", "Volte para a lista", botões pequenos e de ícone com área de toque de 44 px; capturas do E2E iguais às atuais | Pedro decide; Claude faz | a fazer |
| D-02 | Escurecer o texto apagado (`--tinta-3`) | Contraste de pelo menos 4,5:1 no branco e no fundo papel; Pedro aprova a cor | Pedro decide; Claude faz | a fazer |
| D-03 | Erros com saída e avisos legíveis | Tela de erro de rede com botão "Tentar de novo"; toast de erro fica pelo menos 5 s; erro do formulário de criação aparece junto do campo | Pedro decide; Claude faz | a fazer |
| D-04 | Manter o foco ao trocar de tela | Trocar de aba e abrir ou esconder o papelzinho deixam o foco num elemento equivalente; conferido com teclado | Pedro decide; Claude faz | a fazer |
| D-05 | Demais desvios de contraste, tokens e consistência | Cada item da lista "mudam o visual" de design.md aceito ou recusado pelo Pedro | Pedro | a fazer |
