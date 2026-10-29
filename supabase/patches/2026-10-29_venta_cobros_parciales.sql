-- Ledger de cobros parciales por venta (editable + trazable).
-- Aplicado en remoto vía MCP: venta_cobros_parciales_trazables
-- Ver funciones: venta_registrar_cobro, venta_actualizar_cobro, venta_listar_cobros,
-- venta_recalcular_pago_desde_cobros.

CREATE TABLE IF NOT EXISTS public.venta_cobros (
  id bigserial PRIMARY KEY,
  id_venta integer NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  fecha_pago date NOT NULL DEFAULT ((timezone('America/Argentina/Buenos_Aires', now()))::date),
  metodo_pago text,
  caja_slug text,
  id_usuario integer,
  usuario_nombre text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venta_cobros_venta ON public.venta_cobros(id_venta, fecha_pago, id);
