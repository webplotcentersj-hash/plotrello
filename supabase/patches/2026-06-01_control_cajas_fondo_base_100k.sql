-- Fondo de caja operativo: base $100.000 (efectivo real permanente en caja)
BEGIN;

UPDATE public.control_caja_cajas
SET fondo_fijo = 100000, updated_at = now()
WHERE slug IN ('noelia', 'rosa')
  AND fondo_fijo < 100000;

COMMIT;
