-- Mensaje claro en login cuando el usuario existe pero está dado de baja (activo = false).
CREATE OR REPLACE FUNCTION public.usuario_inactivo_login_hint(p_usuario text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.usuarios u
     WHERE lower(trim(u.nombre)) = lower(trim(p_usuario))
       AND COALESCE(u.activo, true) = false
  );
$$;

COMMENT ON FUNCTION public.usuario_inactivo_login_hint(text) IS
  'Indica si el nombre de usuario corresponde a una cuenta inactiva (sin revelar contraseña).';

GRANT EXECUTE ON FUNCTION public.usuario_inactivo_login_hint(text) TO anon;
GRANT EXECUTE ON FUNCTION public.usuario_inactivo_login_hint(text) TO authenticated;
