-- Evitar ambigüedad PostgREST: quedaba la firma vieja sin adjuntos/horario
-- y la nueva con adjuntos; al llamar con p_adjuntos el RPC podía fallar.
DROP FUNCTION IF EXISTS public.work_pool_operario_nota_crear(
  integer, text, text, text, integer, text, integer, text, integer, text
);
