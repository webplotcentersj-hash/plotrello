-- Fuerza la recarga del schema cache de Supabase/PostgREST
-- cuando la tabla existe pero el cliente todavía dice "Could not find ... in the schema cache".
BEGIN;

-- Comentario para invalidar/recalentar el schema cache
COMMENT ON COLUMN public.protocolos_bases.titulo IS 'Refrescar schema cache - protocolos_bases';

-- Disparar lectura del esquema (sin devolver filas)
SELECT
  id
FROM public.protocolos_bases
WHERE false;

COMMIT;

