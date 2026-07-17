-- Publicar atenciones para postgres_changes (panel /disenador + /asesor)
-- y RPC de poll para solicitudes de diseñador desde el tótem.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'atenciones_mostrador'
  ) then
    execute 'alter publication supabase_realtime add table public.atenciones_mostrador';
  end if;
end $$;

create or replace function public.listar_solicitudes_disenador_totem(
  p_minutos integer default 180
)
returns table (
  id integer,
  cliente_nombre varchar,
  notas text,
  fecha_atencion timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.cliente_nombre, a.notas, a.fecha_atencion
  from public.atenciones_mostrador a
  where coalesce(a.notas, '') like '%[SOLICITUD_DISENADOR_TOTEM]%'
    and a.fecha_atencion >= now() - make_interval(mins => greatest(coalesce(p_minutos, 180), 15))
  order by a.fecha_atencion desc
  limit 50;
$$;

grant execute on function public.listar_solicitudes_disenador_totem(integer) to anon, authenticated, service_role;

comment on function public.listar_solicitudes_disenador_totem is
  'Lista solicitudes recientes del tótem Diseño para el panel /disenador.';
