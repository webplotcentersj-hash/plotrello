-- Flota: ampliar CHECK de estado + vehículo Camión LED
--
-- CUÁNDO USAR ESTE ARCHIVO:
--   • Ya ejecutaste el patch 2025-01-21 ANTIGUO (solo en_uso|retrasado|finalizado).
--
-- SI TE DA ERROR "relation registros_salidas_vehiculos does not exist":
--   → En Supabase SQL Editor ejecutá PRIMERO (completo):
--     supabase/patches/2025-01-21_create_sistema_gestion_flota.sql
--   → Ese archivo ya incluye pendiente_autorizacion y Camión LED en instalaciones nuevas.
--   → Luego NO necesitás este 2026-03-25 salvo que tu 2025 fuera una copia vieja sin esos cambios.

BEGIN;

-- Ampliar estados permitidos (solicitud → autorización → en uso → finalizado)
ALTER TABLE public.registros_salidas_vehiculos
  DROP CONSTRAINT IF EXISTS registros_salidas_vehiculos_estado_check;

ALTER TABLE public.registros_salidas_vehiculos
  ADD CONSTRAINT registros_salidas_vehiculos_estado_check
  CHECK (estado IN ('pendiente_autorizacion', 'en_uso', 'retrasado', 'finalizado'));

-- Vehículo faltante (resto ya en patch original con nombres similares)
INSERT INTO public.vehiculos (nombre, patente, activo) VALUES
  ('Camión LED', NULL, true)
ON CONFLICT (nombre) DO NOTHING;

-- La función de retrasos solo afecta salidas ya autorizadas (en_uso)
-- (definición existente ya filtra estado = 'en_uso'; no requiere cambio)

COMMIT;
