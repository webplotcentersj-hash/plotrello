-- OP trabada: solo el operario asignado puede destablar (la app también permite administración/gerencia).
-- Aplicar en Supabase SQL Editor o vía CLI.

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS op_bloqueada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ordenes_trabajo.op_bloqueada IS
  'Si true, la OP no debe editarse ni moverse salvo destaque por operario asignado o admin/gerencia en la app.';
