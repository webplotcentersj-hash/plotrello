-- Marca "NEW" del tablero: timestamp compartido (no localStorage).
ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS fecha_ultimo_movimiento timestamptz;

COMMENT ON COLUMN public.ordenes_trabajo.fecha_ultimo_movimiento IS
  'Momento del último cambio de columna/estado en el tablero (marca NEW compartida).';

UPDATE public.ordenes_trabajo o
SET fecha_ultimo_movimiento = h.max_ts
FROM (
  SELECT id_orden, MAX(timestamp) AS max_ts
  FROM public.historial_movimientos
  WHERE timestamp > now() - interval '2 hours'
    AND (
      accion_tipo = 'cambio_estado'
      OR (estado_anterior IS DISTINCT FROM estado_nuevo)
    )
  GROUP BY id_orden
) h
WHERE o.id = h.id_orden
  AND o.fecha_ultimo_movimiento IS NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_ultimo_movimiento
  ON public.ordenes_trabajo (fecha_ultimo_movimiento DESC NULLS LAST);
