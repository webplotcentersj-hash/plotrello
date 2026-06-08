-- PASO 1 seguridad: ocultar password_hash del rol anon
-- Login y gestión siguen vía RPC SECURITY DEFINER (login_usuario, crear_usuario, etc.)

BEGIN;

-- Vista sin password_hash (lectura segura desde cliente)
CREATE OR REPLACE VIEW public.usuarios_publico AS
SELECT id, nombre, rol, last_seen
FROM public.usuarios;

COMMENT ON VIEW public.usuarios_publico IS
  'Solo campos seguros. El cliente Plotrello debe leer usuarios desde aquí, no desde public.usuarios.';

GRANT SELECT ON public.usuarios_publico TO anon;
GRANT SELECT ON public.usuarios_publico TO authenticated;

-- IDs por rol (notificaciones, sin exponer tabla completa)
CREATE OR REPLACE FUNCTION public.usuarios_ids_por_roles(p_roles text[])
RETURNS TABLE(id integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id FROM public.usuarios u WHERE u.rol = ANY(p_roles);
$$;

GRANT EXECUTE ON FUNCTION public.usuarios_ids_por_roles(text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.usuarios_ids_por_roles(text[]) TO authenticated;

-- Sincronizar usuario para notificaciones (sin INSERT directo desde cliente)
CREATE OR REPLACE FUNCTION public.sync_usuario_notificacion(
  p_id integer,
  p_nombre text,
  p_rol text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NULL OR trim(coalesce(p_nombre, '')) = '' THEN
    RETURN;
  END IF;
  INSERT INTO public.usuarios (id, nombre, rol, password_hash)
  VALUES (
    p_id,
    trim(p_nombre),
    coalesce(nullif(trim(p_rol), ''), 'mostrador'),
    '$2a$10$placeholder.hash.notif.sync.only'
  )
  ON CONFLICT (id) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      rol = EXCLUDED.rol;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_usuario_notificacion(integer, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.sync_usuario_notificacion(integer, text, text) TO authenticated;

-- Quitar lectura/escritura directa de la tabla sensible para anon
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.usuarios FROM anon;

-- Políticas permisivas ya no necesarias para anon (revoke es la barrera)
DROP POLICY IF EXISTS "Allow login function to read users" ON public.usuarios;
DROP POLICY IF EXISTS "Allow insert via crear_usuario function" ON public.usuarios;

-- generar_password_hash: no debe ser invocable desde el navegador
REVOKE EXECUTE ON FUNCTION public.generar_password_hash(text) FROM anon;

COMMIT;
