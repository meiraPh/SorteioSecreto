-- =====================================================================
--  Horário e local da troca de presentes (opcionais).
--  Servem para o convite e para o botão "Adicionar à agenda".
--  Só acrescenta: sorteios antigos ficam com horário e local vazios.
-- =====================================================================

alter table amigo_oculto.eventos
  add column if not exists hora  time,
  add column if not exists local text;

-- Tudo o que a pessoa pode ver depois de entrar com o PIN (agora com hora e local).
create or replace function amigo_oculto.dados(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'ok', true,
    'evento', jsonb_build_object(
      'codigo', e.codigo, 'titulo', e.titulo, 'organizador', e.organizador,
      'data', e.data_evento, 'hora', to_char(e.hora, 'HH24:MI'), 'local', e.local,
      'valor', e.valor, 'mensagem', e.mensagem),
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
revoke all on function amigo_oculto.dados(uuid) from public;

-- A assinatura de criar_evento muda (dois parâmetros novos no fim, com padrão).
-- Sem o drop, o Postgres criaria uma segunda versão da função ao lado da antiga.
drop function if exists public.criar_evento(text, jsonb, jsonb, text, date, text, text, boolean);

create function public.criar_evento(
  p_titulo        text,
  p_participantes jsonb,
  p_exclusoes     jsonb   default '[]'::jsonb,
  p_organizador   text    default null,
  p_data          date    default null,
  p_valor         text    default null,
  p_mensagem      text    default null,
  p_corrente      boolean default true,
  p_hora          text    default null,   -- "HH:MM", 24 horas
  p_local         text    default null
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
  v_hora     text := nullif(btrim(coalesce(p_hora, '')), '');
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
  if v_hora is not null and v_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
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
    (codigo, admin_hash, titulo, organizador, data_evento, valor, mensagem, corrente, hora, local)
  values
    (v_codigo,
     encode(extensions.digest(v_token, 'sha256'), 'hex'),
     left(btrim(p_titulo), 80),
     nullif(left(btrim(coalesce(p_organizador, '')), 60), ''),
     p_data,
     nullif(left(btrim(coalesce(p_valor, '')), 40), ''),
     nullif(left(btrim(coalesce(p_mensagem, '')), 1000), ''),
     corrente,
     v_hora::time,
     nullif(left(btrim(coalesce(p_local, '')), 120), ''))
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
        'data', e.data_evento, 'hora', to_char(e.hora, 'HH24:MI'), 'local', e.local,
        'valor', e.valor, 'mensagem', e.mensagem, 'corrente', e.corrente),
      'participantes', (
        select jsonb_agg(jsonb_build_object(
                 'id', p.id, 'nome', p.nome, 'resgatado', p.pin_hash is not null)
               order by p.ordem)
        from amigo_oculto.participantes p where p.evento_id = e.id))
    from amigo_oculto.eventos e where e.codigo = p_codigo),
    jsonb_build_object('ok', false, 'erro', 'evento_nao_encontrado'))
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
        'data', e.data_evento, 'hora', to_char(e.hora, 'HH24:MI'), 'local', e.local,
        'valor', e.valor, 'mensagem', e.mensagem, 'corrente', e.corrente),
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

revoke all on function public.criar_evento(text, jsonb, jsonb, text, date, text, text, boolean, text, text) from public;
grant execute on function public.criar_evento(text, jsonb, jsonb, text, date, text, text, boolean, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
