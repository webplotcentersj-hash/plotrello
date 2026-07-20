-- Vincular notificaciones de briefs públicos al brief concreto

alter table public.user_notifications
  add column if not exists brief_id integer;

create index if not exists idx_user_notifications_brief_id
  on public.user_notifications(brief_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_notifications_brief_id_fkey'
  ) then
    alter table public.user_notifications
      add constraint user_notifications_brief_id_fkey
      foreign key (brief_id) references public.briefs_publicos(id)
      on delete set null;
  end if;
exception when others then
  raise notice 'FK brief_id: %', SQLERRM;
end $$;

create or replace function public.notify_new_brief()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_record record;
begin
  for user_record in
    select * from public.get_usuarios_diseno_admin()
  loop
    begin
      insert into public.user_notifications (
        user_id, title, description, type, is_read, brief_id
      ) values (
        user_record.user_id,
        '📋 Nuevo Brief Público Creado',
        format(
          'Se creó un nuevo brief público. Cliente: %s [brief:#%s]',
          coalesce(new.cliente_nombre_completo, 'Sin nombre'),
          new.id::text
        ),
        'info',
        false,
        new.id
      );
    exception when others then
      raise warning 'Error creando notificación brief para usuario %: %',
        user_record.user_nombre, SQLERRM;
    end;
  end loop;

  return new;
end;
$$;

create or replace function public.notify_brief_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_record record;
begin
  if new.completado = true and (old.completado is null or old.completado = false) then
    for user_record in
      select * from public.get_usuarios_diseno_admin()
    loop
      begin
        insert into public.user_notifications (
          user_id, title, description, type, is_read, brief_id
        ) values (
          user_record.user_id,
          '✅ Brief Público Completado',
          format(
            'Un cliente completó el brief público. Cliente: %s%s [brief:#%s]',
            coalesce(new.cliente_nombre_completo, 'Sin nombre'),
            case when new.es_urgencia then ' ⚠️ URGENCIA' else '' end,
            new.id::text
          ),
          case when new.es_urgencia then 'warning' else 'success' end,
          false,
          new.id
        );
      exception when others then
        raise warning 'Error creando notificación brief completado para usuario %: %',
          user_record.user_nombre, SQLERRM;
      end;
    end loop;
  end if;

  return new;
end;
$$;

comment on column public.user_notifications.brief_id is
  'Brief público asociado (notificaciones de diseño /briefs-pendientes).';
