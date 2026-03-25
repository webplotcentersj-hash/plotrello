-- Mismo algoritmo que crear_usuario y login_usuario (pgcrypto bf).
-- El fallback de la app usaba bcryptjs en el navegador: esos hashes no siempre pasan crypt() en Postgres y el usuario no podía entrar.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generar_password_hash(p_password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(p_password, gen_salt('bf'::text));
$$;

COMMENT ON FUNCTION public.generar_password_hash(text) IS
  'Hash compatible con login_usuario. Usar en el fallback de createUsuario (no bcryptjs en cliente).';

GRANT EXECUTE ON FUNCTION public.generar_password_hash(text) TO anon;
GRANT EXECUTE ON FUNCTION public.generar_password_hash(text) TO authenticated;
