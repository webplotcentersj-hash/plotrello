-- Edición completa de ventas + auditoría de quién cambió + motivo al borrar.
-- Al anular/eliminar, estado Cancelado y valor 0 anulan el movimiento de caja PL-VENTA-{id}.

CREATE TABLE IF NOT EXISTS public.ventas_auditoria (
  id serial PRIMARY KEY,
  id_venta integer NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  id_item integer,
  accion text NOT NULL,
  motivo text,
  actor_id integer,
  actor_nombre text,
  detalle jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ventas_auditoria_venta_idx
  ON public.ventas_auditoria (id_venta, created_at DESC);

ALTER TABLE public.ventas_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ventas_auditoria_select ON public.ventas_auditoria;
CREATE POLICY ventas_auditoria_select ON public.ventas_auditoria
  FOR SELECT USING (true);

GRANT SELECT ON public.ventas_auditoria TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ventas_auditoria_id_seq TO anon, authenticated;
