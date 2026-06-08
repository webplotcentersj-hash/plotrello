-- Paso 6 (preparación): helper para RPCs que reciban usuario_id validado desde API con JWT.
-- El JWT se verifica en Vercel; las RPCs staff recibirán p_usuario_id desde endpoints server-side.
-- Este patch NO cambia RLS todavía — solo documenta el patrón para migración incremental.

BEGIN;

COMMENT ON FUNCTION public.login_usuario(text, text) IS
  'Login Plotrello. Paso 5: el frontend prefiere /api/auth/staff-login (JWT). Esta RPC sigue disponible como fallback.';

-- Vista de referencia para policies futuras (staff activo sin password_hash)
CREATE OR REPLACE VIEW public.staff_usuarios_activos AS
  SELECT id, nombre, rol
  FROM public.usuarios_publico;

COMMENT ON VIEW public.staff_usuarios_activos IS
  'Staff activo sin datos sensibles. Usar en policies RLS Paso 6 cuando se acote ordenes_trabajo por rol.';

GRANT SELECT ON public.staff_usuarios_activos TO anon;
GRANT SELECT ON public.staff_usuarios_activos TO authenticated;

COMMIT;
