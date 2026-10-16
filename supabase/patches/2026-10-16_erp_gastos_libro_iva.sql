-- Gastos → libro IVA compras (trazado)
alter table public.erp_gastos
  add column if not exists id_factura_compra bigint null,
  add column if not exists proveedor_cuit text null,
  add column if not exists numero_comprobante text null,
  add column if not exists punto_venta integer null,
  add column if not exists letra text null;

create unique index if not exists erp_gastos_id_factura_compra_uidx
  on public.erp_gastos (id_factura_compra)
  where id_factura_compra is not null;
