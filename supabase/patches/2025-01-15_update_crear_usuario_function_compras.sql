-- Actualizar función crear_usuario para incluir rol 'compras'
CREATE OR REPLACE FUNCTION public.crear_usuario(
  p_nombre text,
  p_password text,
  p_rol text
)
RETURNS TABLE (id integer, nombre text, rol text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id integer;
  password_hash text;
  autentificacion_exists boolean;
BEGIN
  IF p_rol NOT IN (
    'administracion',
    'gerencia',
    'diseno',
    'imprenta',
    'taller-grafico',
    'instalaciones',
    'metalurgica',
    'caja',
    'mostrador',
    'compras',
    'recursos-humanos'
  ) THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;

  IF trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre de usuario no puede estar vacío';
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  -- Verificar si el usuario ya existe en usuarios
  IF EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE lower(u.nombre) = lower(trim(p_nombre))
  ) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', trim(p_nombre);
  END IF;

  -- Verificar si existe la tabla autentificacion
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  -- Si existe autentificacion, verificar que no exista el usuario ahí también
  IF autentificacion_exists THEN
    IF EXISTS (
      SELECT 1 FROM public.autentificacion a
      WHERE lower(a.nombre) = lower(trim(p_nombre))
    ) THEN
      RAISE EXCEPTION 'El usuario "%" ya existe en autentificacion', trim(p_nombre);
    END IF;
  END IF;

  password_hash := crypt(p_password, gen_salt('bf'));

  -- Insertar en usuarios
  INSERT INTO public.usuarios (nombre, password_hash, rol)
  VALUES (trim(p_nombre), password_hash, p_rol)
  RETURNING usuarios.id INTO new_user_id;

  -- Si existe la tabla autentificacion, sincronizar también ahí
  IF autentificacion_exists THEN
    BEGIN
      -- Intentar insertar en autentificacion con la misma estructura
      -- Asumiendo que tiene columnas similares (nombre, password_hash, rol)
      EXECUTE format('
        INSERT INTO public.autentificacion (nombre, password_hash, rol)
        VALUES (%L, %L, %L)
        ON CONFLICT (nombre) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            rol = EXCLUDED.rol
      ', trim(p_nombre), password_hash, p_rol);
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla por estructura diferente, solo registrar warning pero continuar
        RAISE WARNING 'No se pudo sincronizar con autentificacion: %', SQLERRM;
    END;
  END IF;

  RETURN QUERY
  SELECT
    new_user_id AS id,
    trim(p_nombre) AS nombre,
    p_rol AS rol;
END;
$$;

COMMENT ON FUNCTION public.crear_usuario IS
'Crea un nuevo usuario con hash de contraseña. Permite roles operativos, administrativos y compras.';

