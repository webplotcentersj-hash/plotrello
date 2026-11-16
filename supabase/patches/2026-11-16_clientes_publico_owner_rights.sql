-- Cuentas corrientes consolidadas (/erp/tesoreria/consolidadas) muestra
-- "permission denied for table clientes" y los clientes salen como "Cliente #id".
--
-- Diseño (2026-08-13_clientes_revoke_dml.sql): anon/authenticated NO leen public.clientes;
-- leen la vista public.clientes_publico, que corre con los permisos de su dueño.
-- En producción la vista está corriendo con los permisos de quien consulta
-- (security_invoker = on, típico al aplicar la sugerencia del Security Advisor de
-- Supabase, o la vista quedó con otro dueño) → anon choca contra public.clientes.
--
-- 1) Diagnóstico (opcional, antes de aplicar):
--    SELECT c.relname, c.reloptions, pg_get_userbyid(c.relowner) AS owner
--    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relname = 'clientes_publico';
--    Si reloptions trae {security_invoker=on} u owner no es postgres, este patch lo corrige.
--
-- 2) Arreglo: la vista vuelve a leer con permisos del dueño. Sigue SIN password_hash
--    y sin DML para anon/authenticated (igual que el diseño original).

BEGIN;

ALTER VIEW public.clientes_publico OWNER TO postgres;
ALTER VIEW public.clientes_publico SET (security_invoker = false);

GRANT SELECT ON public.clientes_publico TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.clientes_publico FROM anon, authenticated;

COMMIT;

-- 3) Verificación: con el rol anon esto tiene que devolver filas, no error.
--    SET ROLE anon; SELECT id, nombre FROM public.clientes_publico LIMIT 3; RESET ROLE;
