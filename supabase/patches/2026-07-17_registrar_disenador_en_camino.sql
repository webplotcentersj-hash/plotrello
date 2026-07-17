-- Persistir respuesta del diseñador para que el tótem la vea aunque falle el broadcast.

create or replace function public.registrar_disenador_en_camino(
  p_atencion_id integer,
  p_disenador_nombre text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := nullif(btrim(coalesce(p_disenador_nombre, '')), '');
  v_notas text;
begin
  if p_atencion_id is null or p_atencion_id <= 0 then
    return false;
  end if;
  if v_nombre is null then
    v_nombre := 'Un diseñador';
  end if;

  select notas into v_notas
  from public.atenciones_mostrador
  where id = p_atencion_id;

  if not found then
    return false;
  end if;

  if coalesce(v_notas, '') like '%[DISENADOR_EN_CAMINO]%' then
    update public.atenciones_mostrador
    set notas = regexp_replace(
      coalesce(v_notas, ''),
      '\[DISENADOR_EN_CAMINO\][^\n]*',
      '[DISENADOR_EN_CAMINO] ' || v_nombre || ' ya vendrá a ayudarte.',
      'g'
    )
    where id = p_atencion_id;
  else
    update public.atenciones_mostrador
    set notas = trim(both from coalesce(v_notas, '') || E'\n[DISENADOR_EN_CAMINO] ' || v_nombre || ' ya vendrá a ayudarte.')
    where id = p_atencion_id;
  end if;

  return true;
end;
$$;

grant execute on function public.registrar_disenador_en_camino(integer, text) to anon, authenticated, service_role;

comment on function public.registrar_disenador_en_camino is
  'Marca en la atención que un diseñador ya va; el tótem /totem/diseno puede leerlo por poll.';
