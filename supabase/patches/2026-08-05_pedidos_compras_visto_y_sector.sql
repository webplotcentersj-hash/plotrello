-- Bandeja de Compras: los pedidos nuevos permanecen destacados hasta abrir el detalle.
-- La lectura es compartida por el equipo de Compras (no una lectura por usuario).

ALTER TABLE public.pedidos_compras
  ADD COLUMN IF NOT EXISTS visto_por_compras_at timestamptz,
  ADD COLUMN IF NOT EXISTS visto_por_compras_id_usuario integer
    REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- No convertir todo el historial existente en "nuevo" al desplegar esta mejora.
UPDATE public.pedidos_compras
SET visto_por_compras_at = COALESCE(updated_at, created_at, now())
WHERE visto_por_compras_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_compras_sector
  ON public.pedidos_compras (sector_solicitante);

CREATE INDEX IF NOT EXISTS idx_pedidos_compras_no_visto
  ON public.pedidos_compras (fecha_solicitud DESC)
  WHERE visto_por_compras_at IS NULL;

COMMENT ON COLUMN public.pedidos_compras.visto_por_compras_at IS
  'Null = pedido nuevo para Compras. Se completa al abrir el detalle.';

COMMENT ON COLUMN public.pedidos_compras.visto_por_compras_id_usuario IS
  'Usuario de Compras que abrió el pedido por primera vez.';
