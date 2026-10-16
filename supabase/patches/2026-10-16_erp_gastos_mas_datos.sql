-- Gastos: más datos fiscales y de trazado
alter table public.erp_gastos
  add column if not exists observaciones text null,
  add column if not exists iva_porcentaje numeric(6,2) null,
  add column if not exists tipo_comprobante text null,
  add column if not exists cae text null,
  add column if not exists centro_costo text null;

create index if not exists erp_gastos_cuit_idx on public.erp_gastos (proveedor_cuit);
create index if not exists erp_gastos_nro_idx on public.erp_gastos (numero_comprobante);
