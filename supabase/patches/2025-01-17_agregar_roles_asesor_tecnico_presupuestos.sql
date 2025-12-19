-- Agregar roles: asesor-tecnico y presupuestos
-- Agregar sectores: Asesor Técnico y Presupuestos
-- El asesor técnico sale a hacer medidas y explica factibilidad de proyectos
-- Tiene vinculación con presupuestos

BEGIN;

-- ============================================
-- PASO 1: Actualizar constraint de roles en usuarios
-- ============================================
DO $$
BEGIN
  -- Eliminar constraint existente
  ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS usuarios_rol_check;

  -- Crear nuevo constraint con los nuevos roles
  ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_rol_check CHECK (
      rol IN (
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
        'compras',
        'asesor-tecnico',
        'presupuestos'
      )
    );
  
  RAISE NOTICE '✅ Constraint de roles actualizado';
END $$;

-- ============================================
-- PASO 2: Agregar nuevos sectores
-- ============================================
INSERT INTO public.sectores (nombre, color, activo, orden_visualizacion)
VALUES
  ('Asesor Técnico', '#06b6d4', true, 13),
  ('Presupuestos', '#f59e0b', true, 14)
ON CONFLICT (nombre) DO UPDATE
SET
  color = EXCLUDED.color,
  activo = EXCLUDED.activo,
  orden_visualizacion = EXCLUDED.orden_visualizacion;

-- ============================================
-- PASO 3: Actualizar constraint de sectores en ordenes_trabajo
-- ============================================
DO $$
BEGIN
  -- Eliminar constraint existente
  ALTER TABLE public.ordenes_trabajo
    DROP CONSTRAINT IF EXISTS ordenes_trabajo_sector_check;

  -- Crear nuevo constraint con los nuevos sectores
  ALTER TABLE public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_sector_check CHECK (
      sector IS NULL OR sector IN (
        'Diseño Gráfico',
        'Diseño en Proceso',
        'En Espera',
        'Imprenta (Área de Impresión)',
        'Taller de Imprenta',
        'Taller Gráfico',
        'Instalaciones',
        'Metalúrgica',
        'Mostrador',
        'Caja',
        'Finalizado en Taller',
        'Almacén de Entrega',
        'Asesor Técnico',
        'Presupuestos'
      )
    );
  
  RAISE NOTICE '✅ Constraint de sectores actualizado';
END $$;

-- ============================================
-- PASO 4: Actualizar función crear_usuario
-- ============================================
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
    'recursos-humanos',
    'diseno',
    'imprenta',
    'taller-grafico',
    'instalaciones',
    'metalurgica',
    'caja',
    'mostrador',
    'compras',
    'asesor-tecnico',
    'presupuestos'
  ) THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;

  IF trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre de usuario no puede estar vacío';
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE lower(u.nombre) = lower(trim(p_nombre))
  ) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', trim(p_nombre);
  END IF;

  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'autentificacion'
  ) INTO autentificacion_exists;

  IF autentificacion_exists THEN
    -- Usar tabla autentificacion si existe
    INSERT INTO public.autentificacion (nombre, password_hash, rol)
    VALUES (trim(p_nombre), crypt(p_password, gen_salt('bf')), p_rol)
    RETURNING id INTO new_user_id;
  ELSE
    -- Usar tabla usuarios
    password_hash := crypt(p_password, gen_salt('bf'));
    INSERT INTO public.usuarios (nombre, password_hash, rol)
    VALUES (trim(p_nombre), password_hash, p_rol)
    RETURNING id INTO new_user_id;
  END IF;

  RETURN QUERY
  SELECT new_user_id, trim(p_nombre)::text, p_rol::text;
END;
$$;

-- ============================================
-- PASO 5: Actualizar función validar_sectores_kanban
-- ============================================
CREATE OR REPLACE FUNCTION public.validar_sectores_kanban(
  p_sectores text[],
  p_sector_inicial text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sectores_validos text[] := ARRAY[
    'Diseño Gráfico',
    'Diseño en Proceso',
    'En Espera',
    'Imprenta (Área de Impresión)',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Instalaciones',
    'Metalúrgica',
    'Finalizado en Taller',
    'Almacén de Entrega',
    'Asesor Técnico',
    'Presupuestos'
  ];
  sector_item text;
BEGIN
  -- Validar que sector_inicial esté en la lista de sectores válidos
  IF p_sector_inicial IS NOT NULL AND NOT (p_sector_inicial = ANY(sectores_validos)) THEN
    RETURN false;
  END IF;

  -- Validar que todos los sectores en el array sean válidos
  IF p_sectores IS NOT NULL THEN
    FOREACH sector_item IN ARRAY p_sectores
    LOOP
      IF NOT (sector_item = ANY(sectores_validos)) THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ROLES Y SECTORES AGREGADOS';
  RAISE NOTICE '   - Rol: asesor-tecnico';
  RAISE NOTICE '   - Rol: presupuestos';
  RAISE NOTICE '   - Sector: Asesor Técnico (#06b6d4)';
  RAISE NOTICE '   - Sector: Presupuestos (#f59e0b)';
  RAISE NOTICE '   - Asesor Técnico tiene vinculación con Presupuestos';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

