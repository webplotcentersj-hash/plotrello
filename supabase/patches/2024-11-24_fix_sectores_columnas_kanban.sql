-- ============================================
-- FIX: Asegurar que sectores coincidan con columnas del Kanban
-- Este script actualiza el CHECK constraint y valida la lógica
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Actualizar CHECK constraint con EXACTAMENTE las columnas del Kanban
-- ============================================
DO $$
BEGIN
  -- Eliminar constraint antiguo
  ALTER TABLE public.ordenes_trabajo
    DROP CONSTRAINT IF EXISTS ordenes_trabajo_sector_check;
  
  -- Crear nuevo constraint con EXACTAMENTE los sectores de las columnas del Kanban
  -- Estos deben coincidir EXACTAMENTE con BOARD_COLUMNS en mockData.ts
  ALTER TABLE public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_sector_check CHECK (
      sector IS NULL OR sector IN (
        'Diseño Gráfico',                    -- diseno-grafico
        'Diseño en Proceso',                 -- diseno-proceso
        'En Espera',                         -- en-espera
        'Imprenta (Área de Impresión)',      -- imprenta
        'Taller de Imprenta',                -- taller-imprenta
        'Taller Gráfico',                    -- taller-grafico
        'Instalaciones',                     -- instalaciones
        'Metalúrgica',                       -- metalurgica
        'Finalizado en Taller',              -- finalizado-taller
        'Almacén de Entrega'                 -- almacen-entrega
      )
    );
  
  RAISE NOTICE '✅ CHECK constraint actualizado con sectores de columnas Kanban';
END $$;

-- ============================================
-- PASO 2: Actualizar tabla sectores para que coincida
-- ============================================
INSERT INTO public.sectores (nombre, color, activo, orden_visualizacion)
VALUES
  ('Diseño Gráfico', '#f97316', true, 1),
  ('Diseño en Proceso', '#ef4444', true, 2),
  ('En Espera', '#eab308', true, 3),
  ('Imprenta (Área de Impresión)', '#22c55e', true, 4),
  ('Taller de Imprenta', '#06b6d4', true, 5),
  ('Taller Gráfico', '#3b82f6', true, 6),
  ('Instalaciones', '#8b5cf6', true, 7),
  ('Metalúrgica', '#ec4899', true, 8),
  ('Finalizado en Taller', '#14b8a6', true, 9),
  ('Almacén de Entrega', '#a3e635', true, 10)
ON CONFLICT (nombre) DO UPDATE
SET
  color = EXCLUDED.color,
  activo = EXCLUDED.activo,
  orden_visualizacion = EXCLUDED.orden_visualizacion;

DO $$
BEGIN
  RAISE NOTICE '✅ Tabla sectores actualizada';
END $$;

-- ============================================
-- PASO 3: Crear función de validación de sectores
-- ============================================
CREATE OR REPLACE FUNCTION public.validar_sectores_kanban(
  p_sectores text[],
  p_sector_inicial text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sectores_validos text[] := ARRAY[
    'Diseño Gráfico',
    'Diseño en Proceso',
    'En Espera',
    'Imprenta (Área de Impresión)',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Instalaciones',
    'Metalúrgica',
    'Finalizado en Taller',
    'Almacén de Entrega'
  ];
  sector_item text;
BEGIN
  -- Validar que sector_inicial esté en la lista de sectores válidos
  IF p_sector_inicial IS NOT NULL AND p_sector_inicial != '' THEN
    IF NOT (p_sector_inicial = ANY(sectores_validos)) THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Validar que todos los sectores en el array sean válidos
  IF p_sectores IS NOT NULL AND array_length(p_sectores, 1) > 0 THEN
    FOREACH sector_item IN ARRAY p_sectores
    LOOP
      IF NOT (sector_item = ANY(sectores_validos)) THEN
        RETURN false;
      END IF;
    END LOOP;
    
    -- Validar que sector_inicial esté en el array de sectores
    IF p_sector_inicial IS NOT NULL AND p_sector_inicial != '' THEN
      IF NOT (p_sector_inicial = ANY(p_sectores)) THEN
        RETURN false;
      END IF;
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '✅ Función de validación creada';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LÓGICA DE MÚLTIPLES SECTORES:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. sectores[]: Array con TODOS los sectores requeridos';
  RAISE NOTICE '2. sector_inicial: Sector donde aparece la FICHA PRINCIPAL';
  RAISE NOTICE '3. Para cada sector en sectores[] (excepto sector_inicial):';
  RAISE NOTICE '   → Se crea una SUB-TAREA automáticamente';
  RAISE NOTICE '   → La sub-tarea aparece en su columna correspondiente';
  RAISE NOTICE '4. La ficha principal aparece solo en sector_inicial';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

