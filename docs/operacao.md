# Operação

Como cuidar do Amigo Oculto no dia a dia. As seções marcadas com "a preencher" dependem de fases que ainda não foram feitas (ver [backlog](backlog.md)).

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

A tarefa agendada que evita a pausa entra na fase 6 (a preencher).

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

## Aplicar migrações

A preencher na fase 5.

## Reverter um deploy

A preencher na fase 4.

## Backup

A preencher na fase 6. O dump do banco contém quem tirou quem, então só é guardado cifrado.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Faixa "Demonstração" no site publicado | O `config.js` publicado está vazio ou é o arquivo errado. |
| "O servidor respondeu com erro (… function … not found)" | O banco não tem as funções. Aplique o SQL de `supabase/` e confira se a Data API está ligada no projeto. |
| "Não consegui falar com o servidor" | O projeto pode estar pausado (veja acima) ou a URL do `config.js` está errada. |
| "Invalid API key" | Confira a publishable key. Não pode ter espaço sobrando. |

## Limitações conhecidas

Não são defeitos; é como o site foi desenhado.

- **Quem toca primeiro num nome fica com ele.** Se alguém pegar o nome errado, o organizador redefine o PIN, mas essa pessoa já viu o resultado daquele nome. É o mesmo limite dos sites de sorteio que só pedem o nome.
- **A lista de participantes não muda depois do sorteio.** Se faltou alguém, cria-se um sorteio novo.
- **Bloqueio de PIN:** 5 tentativas erradas seguidas bloqueiam o nome por 10 minutos.
- **Qualquer pessoa com o endereço do site consegue criar sorteios.** O limite contra abuso está no backlog.
- **Quem administra o banco consegue ver o resultado.** O site não mostra o sorteio nem ao organizador, mas quem tem acesso ao projeto no Supabase (ou a um backup) pode ler as tabelas.
