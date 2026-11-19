-- =====================================================================
--  Preço aproximado de cada presente da lista de desejos (opcional).
--  Quem tem o presente digita; o site mostra "cerca de R$ 90" no cartão.
--  Só acrescenta: presentes já salvos ficam sem preço.
-- =====================================================================

alter table amigo_oculto.desejos
  add column if not exists preco numeric(10, 2);

-- Lista de desejos de uma pessoa (agora com o preço).
create or replace function amigo_oculto.lista(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', d.descricao, 'link', d.link, 'obs', d.obs, 'preco', d.preco) order by d.ordem),
         '[]'::jsonb)
  from amigo_oculto.desejos d
  where d.participante_id = p_id
$$;
revoke all on function amigo_oculto.lista(uuid) from public;

-- Salva a lista de desejos (substitui a anterior).
-- p_desejos: [{"descricao":"...", "link":"https://...", "obs":"...", "preco": 89.9}]
-- preco: número de 0,01 a 100.000, ou ausente/null.
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
  pr   jsonb;
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
    pr := item -> 'preco';
    if d = '' or length(d) > 120 or length(o) > 200 then
      return jsonb_build_object('ok', false, 'erro', 'item_invalido');
    end if;
    if l is not null and (length(l) > 600 or l !~* '^https?://[^\s]+$') then
      return jsonb_build_object('ok', false, 'erro', 'link_invalido');
    end if;
    if pr is not null and jsonb_typeof(pr) <> 'null'
       and (jsonb_typeof(pr) <> 'number' or (pr #>> '{}')::numeric <= 0 or (pr #>> '{}')::numeric > 100000) then
      return jsonb_build_object('ok', false, 'erro', 'preco_invalido');
    end if;
  end loop;

  update amigo_oculto.participantes
     set tamanhos = nullif(left(btrim(coalesce(p_tamanhos, '')), 300), '')
   where id = p_participante;

  delete from amigo_oculto.desejos where participante_id = p_participante;

  for item, ord in select value, ordinality from jsonb_array_elements(p_desejos) with ordinality loop
    insert into amigo_oculto.desejos (participante_id, ordem, descricao, link, obs, preco)
    values (p_participante, ord,
            btrim(item ->> 'descricao'),
            nullif(btrim(coalesce(item ->> 'link', '')), ''),
            nullif(btrim(coalesce(item ->> 'obs', '')), ''),
            case when jsonb_typeof(item -> 'preco') = 'number'
                 then round((item ->> 'preco')::numeric, 2) end);
  end loop;

  return amigo_oculto.dados(p_participante);
end
$$;

notify pgrst, 'reload schema';
