-- Ejecutar en Supabase SQL Editor cuando el proyecto responda (Dashboard → SQL).
CREATE INDEX IF NOT EXISTS idx_ordenes_tablero_activas_id_desc
  ON public.ordenes_trabajo (id DESC)
  WHERE COALESCE(eliminada, false) = false
    AND COALESCE(entregado, false) = false
    AND COALESCE(visible_en_tablero, true) = true;
