-- =====================================================================
--  AMIGO OCULTO — banco de dados (Supabase / PostgreSQL 15+)
--
--  Como usar: no painel do Supabase, abra "SQL Editor" > "New query",
--  cole ESTE ARQUIVO INTEIRO e clique em "Run". Pode rodar de novo
--  sempre que atualizar o arquivo.
--
--  Segurança em uma frase: as tabelas ficam num esquema privado que a API
--  não enxerga; o site só fala com o banco pelas funções do esquema
--  public (lá embaixo), que conferem o PIN / token antes de responder.
--  Nem o organizador consegue ver quem tirou quem.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists amigo_oculto;
revoke all on schema amigo_oculto from public;

-- Limpeza de versões anteriores (os recados anônimos foram removidos).
drop function if exists public.enviar_recado(uuid, text, text, text);
drop function if exists amigo_oculto.conversa(uuid);
drop table if exists amigo_oculto.recados;

-- ---------------------------------------------------------------------
--  Tabelas
-- ---------------------------------------------------------------------

create table if not exists amigo_oculto.eventos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,          -- vai no link do grupo
  admin_hash   text not null,                 -- sha256 do token do organizador
  titulo       text not null,
  organizador  text,
  data_evento  date,
  valor        text,
  mensagem     text,
  corrente     boolean not null default true, -- sorteio em corrente única
  criado_em    timestamptz not null default now()
);

create table if not exists amigo_oculto.participantes (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references amigo_oculto.eventos(id) on delete cascade,
  nome          text not null,
  ordem         int  not null,
  amigo_id      uuid references amigo_oculto.participantes(id),  -- quem esta pessoa tirou
  pin_hash      text,                                            -- bcrypt; null = nome ainda livre
  resgatado_em  timestamptz,
  tentativas    int not null default 0,
  bloqueado_ate timestamptz,
  tamanhos      text                                             -- "camisa M, calçado 40..."
);
create unique index if not exists participantes_nome_unico
  on amigo_oculto.participantes (evento_id, lower(nome));
create index if not exists participantes_amigo
  on amigo_oculto.participantes (amigo_id);

create table if not exists amigo_oculto.desejos (
  id              uuid primary key default gen_random_uuid(),
  participante_id uuid not null references amigo_oculto.participantes(id) on delete cascade,
  ordem           int  not null,
  descricao       text not null,
  link            text,
  obs             text
);
create index if not exists desejos_participante
  on amigo_oculto.desejos (participante_id);

-- Defesa extra: RLS ligado e sem políticas = ninguém de fora lê nada.
alter table amigo_oculto.eventos       enable row level security;
alter table amigo_oculto.participantes enable row level security;
alter table amigo_oculto.desejos       enable row level security;

-- ---------------------------------------------------------------------
--  Funções internas (não ficam expostas na API)
-- ---------------------------------------------------------------------

create or replace function amigo_oculto.lista(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', d.descricao, 'link', d.link, 'obs', d.obs) order by d.ordem),
         '[]'::jsonb)
  from amigo_oculto.desejos d
  where d.participante_id = p_id
$$;

-- Tudo o que a pessoa pode ver depois de entrar com o PIN.
create or replace function amigo_oculto.dados(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'ok', true,
    'evento', jsonb_build_object(
      'codigo', e.codigo, 'titulo', e.titulo, 'organizador', e.organizador,
      'data', e.data_evento, 'valor', e.valor, 'mensagem', e.mensagem),
    'eu', jsonb_build_object(
      'id', p.id, 'nome', p.nome, 'tamanhos', p.tamanhos,
      'desejos', amigo_oculto.lista(p.id)),
    'amigo', jsonb_build_object(
      'nome', a.nome, 'tamanhos', a.tamanhos,
      'desejos', amigo_oculto.lista(a.id))
  )
  from amigo_oculto.participantes p
  join amigo_oculto.eventos e on e.id = p.evento_id
  join amigo_oculto.participantes a on a.id = p.amigo_id
  where p.id = p_id
$$;

-- Confere o PIN. 5 erros seguidos = bloqueio de 10 minutos.
create or replace function amigo_oculto.verificar_pin(p_id uuid, p_pin text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  p amigo_oculto.participantes;
begin
  select * into p from amigo_oculto.participantes where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  if p.pin_hash is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_pin');
  end if;
  if p.bloqueado_ate is not null and p.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'erro', 'bloqueado', 'ate', p.bloqueado_ate);
  end if;
  if p_pin is null or extensions.crypt(p_pin, p.pin_hash) <> p.pin_hash then
    if p.tentativas + 1 >= 5 then
      update amigo_oculto.participantes
         set tentativas = 0, bloqueado_ate = now() + interval '10 minutes'
       where id = p_id;
      return jsonb_build_object('ok', false, 'erro', 'bloqueado',
                                'ate', now() + interval '10 minutes');
    end if;
    update amigo_oculto.participantes set tentativas = p.tentativas + 1 where id = p_id;
    return jsonb_build_object('ok', false, 'erro', 'pin_errado',
                              'restantes', 5 - (p.tentativas + 1));
  end if;
  if p.tentativas > 0 or p.bloqueado_ate is not null then
    update amigo_oculto.participantes
       set tentativas = 0, bloqueado_ate = null
     where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function amigo_oculto.evento_admin(p_codigo text, p_token text)
returns uuid language sql stable set search_path = '' as $$
  select e.id from amigo_oculto.eventos e
  where e.codigo = p_codigo
    and e.admin_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

revoke all on all functions in schema amigo_oculto from public;

-- ---------------------------------------------------------------------
--  Funções públicas (é isto que o site chama)
-- ---------------------------------------------------------------------

-- Cria o evento e já faz o sorteio no servidor.
-- p_participantes: ["Ana","Bruno",...]
-- p_exclusoes: [[0,1],[1,0]]  -> participante 0 não pode tirar o 1 e vice-versa
create or replace function public.criar_evento(
  p_titulo        text,
  p_participantes jsonb,
  p_exclusoes     jsonb   default '[]'::jsonb,
  p_organizador   text    default null,
  p_data          date    default null,
  p_valor         text    default null,
  p_mensagem      text    default null,
  p_corrente      boolean default true
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  nomes      text[];
  n          int;
  proibidos  text[] := '{}';
  ex         jsonb;
  a          int;
  b          int;
  perm       int[];
  dest       int[];
  k          int;
  tentativa  int := 0;
  valido     boolean := false;
  corrente   boolean := coalesce(p_corrente, true);
  v_evento   uuid;
  v_codigo   text;
  v_token    text;
  v_id       uuid;
  ids        uuid[] := '{}';
begin
  if coalesce(btrim(p_titulo), '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'titulo_vazio');
  end if;
  if p_participantes is null or jsonb_typeof(p_participantes) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'dados_invalidos');
  end if;

  select coalesce(array_agg(btrim(x) order by ord), '{}')
    into nomes
    from jsonb_array_elements_text(p_participantes) with ordinality as t(x, ord);
  n := coalesce(array_length(nomes, 1), 0);

  if n < 3 then
    return jsonb_build_object('ok', false, 'erro', 'minimo_3');
  end if;
  if n > 100 then
    return jsonb_build_object('ok', false, 'erro', 'maximo_100');
  end if;
  if exists (select 1 from unnest(nomes) x where x = '' or length(x) > 40) then
    return jsonb_build_object('ok', false, 'erro', 'nome_invalido');
  end if;
  if (select count(distinct lower(x)) from unnest(nomes) x) <> n then
    return jsonb_build_object('ok', false, 'erro', 'nomes_repetidos');
  end if;

  if p_exclusoes is not null and jsonb_typeof(p_exclusoes) = 'array' then
    for ex in select value from jsonb_array_elements(p_exclusoes) loop
      a := (ex ->> 0)::int + 1;
      b := (ex ->> 1)::int + 1;
      if a is null or b is null or a < 1 or a > n or b < 1 or b > n then
        return jsonb_build_object('ok', false, 'erro', 'exclusao_invalida');
      end if;
      proibidos := proibidos || (a::text || ':' || b::text);
    end loop;
  end if;

  -- Sorteio: embaralha e confere as regras; repete até dar certo.
  while not valido and tentativa < 5000 loop
    tentativa := tentativa + 1;
    select array_agg(g order by random()) into perm from generate_series(1, n) g;
    dest := array_fill(0, array[n]);
    for k in 1..n loop
      if corrente then
        dest[perm[k]] := perm[(k % n) + 1];   -- A->B->C->...->A
      else
        dest[k] := perm[k];
      end if;
    end loop;
    valido := true;
    for k in 1..n loop
      if dest[k] = k or (k::text || ':' || dest[k]::text) = any(proibidos) then
        valido := false;
        exit;
      end if;
    end loop;
  end loop;

  if not valido then
    return jsonb_build_object('ok', false, 'erro', 'impossivel');
  end if;

  loop
    v_codigo := encode(extensions.gen_random_bytes(5), 'hex');
    exit when not exists (select 1 from amigo_oculto.eventos where codigo = v_codigo);
  end loop;
  v_token := encode(extensions.gen_random_bytes(18), 'hex');

  insert into amigo_oculto.eventos
    (codigo, admin_hash, titulo, organizador, data_evento, valor, mensagem, corrente)
  values
    (v_codigo,
     encode(extensions.digest(v_token, 'sha256'), 'hex'),
     left(btrim(p_titulo), 80),
     nullif(left(btrim(coalesce(p_organizador, '')), 60), ''),
     p_data,
     nullif(left(btrim(coalesce(p_valor, '')), 40), ''),
     nullif(left(btrim(coalesce(p_mensagem, '')), 1000), ''),
     corrente)
  returning id into v_evento;

  for k in 1..n loop
    insert into amigo_oculto.participantes (evento_id, nome, ordem)
    values (v_evento, nomes[k], k)
    returning id into v_id;
    ids := ids || v_id;
  end loop;

  for k in 1..n loop
    update amigo_oculto.participantes set amigo_id = ids[dest[k]] where id = ids[k];
  end loop;

  return jsonb_build_object('ok', true, 'codigo', v_codigo, 'token', v_token);
end
$$;

-- Página do grupo: dados do evento + nomes (sem resultado nenhum).
create or replace function public.evento_publico(p_codigo text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object(
      'ok', true,
      'evento', jsonb_build_object(
        'codigo', e.codigo, 'titulo', e.titulo, 'organizador', e.organizador,
        'data', e.data_evento, 'valor', e.valor, 'mensagem', e.mensagem,
        'corrente', e.corrente),
      'participantes', (
        select jsonb_agg(jsonb_build_object(
                 'id', p.id, 'nome', p.nome, 'resgatado', p.pin_hash is not null)
               order by p.ordem)
        from amigo_oculto.participantes p where p.evento_id = e.id))
    from amigo_oculto.eventos e where e.codigo = p_codigo),
    jsonb_build_object('ok', false, 'erro', 'evento_nao_encontrado'))
$$;

-- Primeiro acesso: a pessoa "pega" o próprio nome criando um PIN.
create or replace function public.resgatar(p_participante uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'erro', 'pin_formato');
  end if;
  update amigo_oculto.participantes
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
         resgatado_em = now(), tentativas = 0, bloqueado_ate = null
   where id = p_participante and pin_hash is null;
  if not found then
    if exists (select 1 from amigo_oculto.participantes where id = p_participante) then
      return jsonb_build_object('ok', false, 'erro', 'ja_resgatado');
    end if;
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  return amigo_oculto.dados(p_participante);
end
$$;

-- Voltar depois: nome + PIN.
create or replace function public.entrar(p_participante uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  v := amigo_oculto.verificar_pin(p_participante, p_pin);
  if not (v ->> 'ok')::boolean then
    return v;
  end if;
  return amigo_oculto.dados(p_participante);
end
$$;

-- Salva a lista de desejos (substitui a anterior).
-- p_desejos: [{"descricao":"...", "link":"https://...", "obs":"..."}]
create or replace function public.salvar_lista(
  p_participante uuid, p_pin text, p_tamanhos text, p_desejos jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v    jsonb;
  item jsonb;
  ord  bigint;
  d    text;
  l    text;
  o    text;
begin
  v := amigo_oculto.verificar_pin(p_participante, p_pin);
  if not (v ->> 'ok')::boolean then
    return v;
  end if;
  if p_desejos is null then
    p_desejos := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_desejos) <> 'array' or jsonb_array_length(p_desejos) > 20 then
    return jsonb_build_object('ok', false, 'erro', 'lista_invalida');
  end if;

  -- valida tudo antes de gravar
  for item in select value from jsonb_array_elements(p_desejos) loop
    d := btrim(coalesce(item ->> 'descricao', ''));
    l := nullif(btrim(coalesce(item ->> 'link', '')), '');
    o := btrim(coalesce(item ->> 'obs', ''));
    if d = '' or length(d) > 120 or length(o) > 200 then
      return jsonb_build_object('ok', false, 'erro', 'item_invalido');
    end if;
    if l is not null and (length(l) > 600 or l !~* '^https?://[^\s]+$') then
      return jsonb_build_object('ok', false, 'erro', 'link_invalido');
    end if;
  end loop;

  update amigo_oculto.participantes
     set tamanhos = nullif(left(btrim(coalesce(p_tamanhos, '')), 300), '')
   where id = p_participante;

  delete from amigo_oculto.desejos where participante_id = p_participante;

  for item, ord in select value, ordinality from jsonb_array_elements(p_desejos) with ordinality loop
    insert into amigo_oculto.desejos (participante_id, ordem, descricao, link, obs)
    values (p_participante, ord,
            btrim(item ->> 'descricao'),
            nullif(btrim(coalesce(item ->> 'link', '')), ''),
            nullif(btrim(coalesce(item ->> 'obs', '')), ''));
  end loop;

  return amigo_oculto.dados(p_participante);
end
$$;

-- Painel do organizador: quem já pegou o nome (sem mostrar resultado).
create or replace function public.painel(p_codigo text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_evento uuid := amigo_oculto.evento_admin(p_codigo, p_token);
begin
  if v_evento is null then
    return jsonb_build_object('ok', false, 'erro', 'acesso_negado');
  end if;
  return (
    select jsonb_build_object(
      'ok', true,
      'evento', jsonb_build_object(
        'codigo', e.codigo, 'titulo', e.titulo, 'organizador', e.organizador,
        'data', e.data_evento, 'valor', e.valor, 'mensagem', e.mensagem,
        'corrente', e.corrente),
      'participantes', (
        select jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'nome', p.nome,
                 'resgatado_em', p.resgatado_em,
                 'bloqueado', coalesce(p.bloqueado_ate > now(), false),
                 'lista_pronta', exists (select 1 from amigo_oculto.desejos d
                                         where d.participante_id = p.id))
               order by p.ordem)
        from amigo_oculto.participantes p where p.evento_id = e.id))
    from amigo_oculto.eventos e where e.id = v_evento);
end
$$;

-- Organizador libera o nome de quem esqueceu o PIN.
-- O resultado do sorteio NÃO muda e continua secreto.
create or replace function public.resetar_pin(p_codigo text, p_token text, p_participante uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_evento uuid := amigo_oculto.evento_admin(p_codigo, p_token);
begin
  if v_evento is null then
    return jsonb_build_object('ok', false, 'erro', 'acesso_negado');
  end if;
  update amigo_oculto.participantes
     set pin_hash = null, resgatado_em = null, tentativas = 0, bloqueado_ate = null
   where id = p_participante and evento_id = v_evento;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  end if;
  return jsonb_build_object('ok', true);
end
$$;

-- ---------------------------------------------------------------------
--  Permissões: só as funções públicas podem ser chamadas pelo site.
-- ---------------------------------------------------------------------
revoke all on function public.criar_evento(text, jsonb, jsonb, text, date, text, text, boolean) from public;
revoke all on function public.evento_publico(text)                     from public;
revoke all on function public.resgatar(uuid, text)                     from public;
revoke all on function public.entrar(uuid, text)                       from public;
revoke all on function public.salvar_lista(uuid, text, text, jsonb)    from public;
revoke all on function public.painel(text, text)                       from public;
revoke all on function public.resetar_pin(text, text, uuid)            from public;

grant execute on function public.criar_evento(text, jsonb, jsonb, text, date, text, text, boolean) to anon, authenticated;
grant execute on function public.evento_publico(text)                  to anon, authenticated;
grant execute on function public.resgatar(uuid, text)                  to anon, authenticated;
grant execute on function public.entrar(uuid, text)                    to anon, authenticated;
grant execute on function public.salvar_lista(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.painel(text, text)                    to anon, authenticated;
grant execute on function public.resetar_pin(text, text, uuid)         to anon, authenticated;

-- Avisa a API do Supabase para recarregar as funções.
notify pgrst, 'reload schema';
