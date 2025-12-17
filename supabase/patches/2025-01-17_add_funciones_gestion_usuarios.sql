-- Funciones para gestionar usuarios (actualizar y eliminar)
-- Para el sistema de Recursos Humanos

BEGIN;

-- Función para actualizar usuario
CREATE OR REPLACE FUNCTION public.actualizar_usuario(
  p_id integer,
  p_nombre text DEFAULT NULL,
  p_rol text DEFAULT NULL,
  p_password text DEFAULT NULL
)
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_existente record;
  password_hash text;
  autentificacion_exists boolean;
BEGIN
  -- Verificar que el usuario existe
  SELECT * INTO usuario_existente
  FROM public.usuarios
  WHERE id = p_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id;
  END IF;
  
  -- Validar rol si se proporciona
  IF p_rol IS NOT NULL THEN
    IF p_rol NOT IN (
      'administracion',
      'gerencia',
      'recursos-humanos',
      'diseno',
      'imprenta',
      'taller-grafico',
      'instalaciones',
      'metalurgica',
      'caja',
      'mostrador',
      'compras'
    ) THEN
      RAISE EXCEPTION 'Rol inválido: %', p_rol;
    END IF;
  END IF;
  
  -- Validar nombre si se proporciona
  IF p_nombre IS NOT NULL AND trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre de usuario no puede estar vacío';
  END IF;
  
  -- Validar contraseña si se proporciona
  IF p_password IS NOT NULL AND length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;
  
  -- Verificar si el nuevo nombre ya existe (si se está cambiando)
  IF p_nombre IS NOT NULL AND lower(trim(p_nombre)) != lower(usuario_existente.nombre) THEN
    IF EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE lower(u.nombre) = lower(trim(p_nombre))
        AND u.id != p_id
    ) THEN
      RAISE EXCEPTION 'El usuario "%" ya existe', trim(p_nombre);
    END IF;
  END IF;
  
  -- Generar hash de contraseña si se proporciona
  IF p_password IS NOT NULL THEN
    password_hash := crypt(p_password, gen_salt('bf'));
  ELSE
    password_hash := usuario_existente.password_hash;
  END IF;
  
  -- Actualizar usuario
  UPDATE public.usuarios
  SET 
    nombre = COALESCE(trim(p_nombre), usuario_existente.nombre),
    rol = COALESCE(p_rol, usuario_existente.rol),
    password_hash = password_hash,
    updated_at = now()
  WHERE id = p_id;
  
  -- Verificar si existe la tabla autentificacion
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;
  
  -- Si existe autentificacion, sincronizar también ahí
  IF autentificacion_exists THEN
    BEGIN
      EXECUTE format('
        UPDATE public.autentificacion
        SET nombre = %L,
            rol = %L,
            password_hash = %L
        WHERE nombre = %L
      ', 
        COALESCE(trim(p_nombre), usuario_existente.nombre),
        COALESCE(p_rol, usuario_existente.rol),
        password_hash,
        usuario_existente.nombre
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'No se pudo sincronizar con autentificacion: %', SQLERRM;
    END;
  END IF;
  
  RETURN QUERY
  SELECT
    p_id AS id,
    COALESCE(trim(p_nombre), usuario_existente.nombre) AS nombre,
    COALESCE(p_rol, usuario_existente.rol) AS rol;
END;
$$;

COMMENT ON FUNCTION public.actualizar_usuario IS
'Actualiza un usuario existente. Permite actualizar nombre, rol y/o contraseña. Los parámetros NULL no se actualizan.';

-- Función para eliminar usuario
CREATE OR REPLACE FUNCTION public.eliminar_usuario(
  p_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_existente record;
  autentificacion_exists boolean;
BEGIN
  -- Verificar que el usuario existe
  SELECT * INTO usuario_existente
  FROM public.usuarios
  WHERE id = p_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id;
  END IF;
  
  -- No permitir eliminar usuarios administración (seguridad)
  IF usuario_existente.rol = 'administracion' THEN
    RAISE EXCEPTION 'No se puede eliminar un usuario con rol administración';
  END IF;
  
  -- Verificar si existe la tabla autentificacion
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;
  
  -- Si existe autentificacion, eliminar también ahí
  IF autentificacion_exists THEN
    BEGIN
      EXECUTE format('
        DELETE FROM public.autentificacion
        WHERE nombre = %L
      ', usuario_existente.nombre);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'No se pudo eliminar de autentificacion: %', SQLERRM;
    END;
  END IF;
  
  -- Eliminar de usuarios (CASCADE eliminará referencias relacionadas si existen)
  DELETE FROM public.usuarios
  WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.eliminar_usuario IS
'Elimina un usuario del sistema. No permite eliminar usuarios con rol administración por seguridad.';

COMMIT;

