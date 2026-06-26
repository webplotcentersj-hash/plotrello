-- Cajas operativas vinculadas a usuarios (mostrador / caja).
-- Slug técnico u-{id}; id_usuario es la fuente de verdad.

BEGIN;

ALTER TABLE public.control_caja_cajas
  ADD COLUMN IF NOT EXISTS id_usuario integer REFERENCES public.usuarios(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_control_caja_cajas_id_usuario
  ON public.control_caja_cajas(id_usuario)
  WHERE id_usuario IS NOT NULL;

-- Enlazar slugs u-{id} existentes
UPDATE public.control_caja_cajas c
SET id_usuario = (substring(c.slug from 3))::integer
WHERE c.slug ~ '^u-[0-9]+$'
  AND c.id_usuario IS NULL;

-- Crear caja para usuarios mostrador/caja activos sin caja
INSERT INTO public.control_caja_cajas (slug, nombre, fondo_fijo, activa, id_usuario)
SELECT
  'u-' || u.id,
  'Caja ' || u.nombre,
  100000,
  true,
  u.id
FROM public.usuarios u
WHERE u.rol IN ('mostrador', 'caja')
  AND COALESCE(u.activo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM public.control_caja_cajas c WHERE c.id_usuario = u.id
  )
ON CONFLICT (slug) DO UPDATE
SET
  id_usuario = EXCLUDED.id_usuario,
  nombre = EXCLUDED.nombre,
  activa = true,
  updated_at = now();

-- Legacy: desactivar cajas fijas sin usuario (datos históricos conservados)
UPDATE public.control_caja_cajas
SET activa = false, updated_at = now()
WHERE slug IN ('noelia', 'rosa')
  AND id_usuario IS NULL;

-- Desactivar caja si el usuario está de baja
UPDATE public.control_caja_cajas c
SET activa = false, updated_at = now()
FROM public.usuarios u
WHERE c.id_usuario = u.id
  AND COALESCE(u.activo, true) = false;

COMMENT ON COLUMN public.control_caja_cajas.id_usuario IS
  'Usuario mostrador/caja dueño de la caja operativa. Slug u-{id} es derivado.';

-- Nota: RLS sigue abierta (auth custom vía API). El filtro por usuario es en la app.
-- Cuando migren a JWT con claim id_usuario, reemplazar policy control_caja_cajas_all.

COMMIT;
