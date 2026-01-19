-- Crear o resetear usuario admin
-- Este script asegura que exista un usuario admin con contraseña válida
-- Si el usuario ya existe, resetea su contraseña
-- Si no existe, lo crea

BEGIN;

-- Asegurar que la extensión pgcrypto esté instalada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función auxiliar para crear o actualizar usuario admin
CREATE OR REPLACE FUNCTION public.ensure_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_exists boolean;
  admin_id integer;
  default_password text := 'admin123'; -- Contraseña por defecto (cambiar después del primer login)
  password_hash text;
BEGIN
  -- Verificar si existe un usuario admin
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE lower(trim(nombre)) = 'admin' 
       OR lower(trim(nombre)) = 'administrador'
       OR rol = 'administracion'
    LIMIT 1
  ) INTO admin_exists;

  -- Generar hash de la contraseña
  password_hash := crypt(default_password, gen_salt('bf', 10));

  IF admin_exists THEN
    -- Actualizar usuario admin existente
    UPDATE public.usuarios
    SET 
      password_hash = password_hash,
      rol = 'administracion',
      nombre = 'admin' -- Asegurar que el nombre sea 'admin'
    WHERE lower(trim(nombre)) = 'admin' 
       OR lower(trim(nombre)) = 'administrador'
       OR rol = 'administracion'
    LIMIT 1
    RETURNING id INTO admin_id;

    RAISE NOTICE 'Usuario admin actualizado. ID: %', admin_id;
  ELSE
    -- Crear nuevo usuario admin
    INSERT INTO public.usuarios (nombre, rol, password_hash)
    VALUES ('admin', 'administracion', password_hash)
    RETURNING id INTO admin_id;

    RAISE NOTICE 'Usuario admin creado. ID: %', admin_id;
  END IF;

  -- Asegurar que el usuario admin tenga permisos correctos
  -- (Los permisos se manejan a través de RLS y roles)
END;
$$;

-- Ejecutar la función
SELECT public.ensure_admin_user();

-- Limpiar función auxiliar (opcional, puede dejarse para uso futuro)
-- DROP FUNCTION IF EXISTS public.ensure_admin_user();

-- Verificar que el usuario admin existe y tiene password_hash
DO $$
DECLARE
  admin_check RECORD;
BEGIN
  SELECT id, nombre, rol, 
         CASE WHEN password_hash IS NULL OR length(password_hash) = 0 
              THEN 'SIN CONTRASEÑA' 
              ELSE 'CON CONTRASEÑA' 
         END as estado_password
  INTO admin_check
  FROM public.usuarios
  WHERE lower(trim(nombre)) = 'admin' 
     OR rol = 'administracion'
  LIMIT 1;

  IF admin_check IS NULL THEN
    RAISE EXCEPTION 'Error: No se pudo crear/actualizar el usuario admin';
  ELSE
    RAISE NOTICE 'Usuario admin verificado:';
    RAISE NOTICE '  ID: %', admin_check.id;
    RAISE NOTICE '  Nombre: %', admin_check.nombre;
    RAISE NOTICE '  Rol: %', admin_check.rol;
    RAISE NOTICE '  Estado contraseña: %', admin_check.estado_password;
    RAISE NOTICE 'Contraseña por defecto: admin123';
    RAISE NOTICE 'IMPORTANTE: Cambiar la contraseña después del primer login';
  END IF;
END;
$$;

COMMIT;

