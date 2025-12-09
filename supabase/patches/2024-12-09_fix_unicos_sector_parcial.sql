-- ============================================
-- Ajustar índice único por sector:
--  - Permitir múltiples fichas en "Finalizado en Taller" para que unifique
--  - Mantener unicidad por (numero_op, sector) en el resto de sectores
-- ============================================

BEGIN;

-- Drop índice previo si existe
DROP INDEX IF EXISTS ux_ordenes_op_sector;

-- Crear índice único parcial: no aplica a "Finalizado en Taller"
CREATE UNIQUE INDEX IF NOT EXISTS ux_ordenes_op_sector
  ON public.ordenes_trabajo (numero_op, sector)
  WHERE sector IS NOT NULL
    AND sector <> 'Finalizado en Taller';

COMMIT;

