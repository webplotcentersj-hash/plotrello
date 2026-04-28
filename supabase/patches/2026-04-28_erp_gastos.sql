-- ERP: Gastos corrientes + tickets (carga manual y por IA)
-- Ejecutar una sola vez en Supabase (SQL editor o migración).

create table if not exists public.erp_gastos (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  fecha_gasto date not null,
  proveedor text null,
  categoria text null,
  descripcion text null,

  total numeric(14,2) not null,
  iva numeric(14,2) null,
  neto numeric(14,2) null,
  moneda text null default 'ARS',
  metodo_pago text null,

  ticket_url text null,
  ticket_raw jsonb null,
  origen text not null default 'manual'
);

create index if not exists erp_gastos_fecha_gasto_idx on public.erp_gastos (fecha_gasto desc);
create index if not exists erp_gastos_categoria_idx on public.erp_gastos (categoria);
create index if not exists erp_gastos_proveedor_idx on public.erp_gastos (proveedor);

create or replace function public.set_updated_at_erp_gastos()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_erp_gastos_updated_at on public.erp_gastos;
create trigger trg_erp_gastos_updated_at
before update on public.erp_gastos
for each row
execute function public.set_updated_at_erp_gastos();

