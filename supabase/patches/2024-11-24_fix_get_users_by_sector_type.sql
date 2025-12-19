-- ============================================
-- FIX: Corregir tipo de retorno en get_users_by_sector
-- Error: "Returned type character varying(100) does not match expected type text in column 2"
-- ============================================

BEGIN;

-- ============================================
-- Corregir función get_users_by_sector
-- ============================================
CREATE OR REPLACE FUNCTION public.get_users_by_sector(sector_nombre text)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists boolean;
BEGIN
  -- Verificar si la tabla usuario_sectores existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'usuario_sectores'
  ) INTO table_exists;
  
  -- Si la tabla existe, intentar usarla
  IF table_exists THEN
    BEGIN
      RETURN QUERY
      SELECT DISTINCT 
        u.id::integer AS user_id, 
        u.nombre::text AS user_nombre  -- ⚠️ Conversión explícita a text
      FROM public.usuarios u
      INNER JOIN public.usuario_sectores us ON u.id = us.usuario_id
      INNER JOIN public.sectores s ON us.sector_id = s.id
      WHERE s.nombre = sector_nombre
      ORDER BY u.nombre;
    EXCEPTION WHEN OTHERS THEN
      -- Si hay error (tabla no existe o no tiene datos), usar fallback
      RAISE WARNING 'Error usando usuario_sectores, usando fallback: %', SQLERRM;
      table_exists := false;
    END;
  END IF;
  
  -- Fallback: mapeo de sectores a roles (si la tabla no existe o hubo error)
  IF NOT table_exists THEN
    RETURN QUERY
    SELECT 
      u.id::integer AS user_id, 
      u.nombre::text AS user_nombre  -- ⚠️ Conversión explícita a text
    FROM public.usuarios u
    WHERE 
      -- Mapeo de sectores a roles
      (
        (sector_nombre = 'Taller de Imprenta' AND (u.rol = 'imprenta' OR u.rol = 'taller-grafico')) OR
        (sector_nombre = 'Taller Gráfico' AND u.rol = 'taller-grafico') OR
        (sector_nombre = 'Metalúrgica' AND u.rol = 'metalurgica') OR
        (sector_nombre = 'Mostrador' AND u.rol = 'mostrador') OR
        (sector_nombre = 'Caja' AND u.rol = 'caja') OR
        (sector_nombre = 'Diseño Gráfico' AND (u.rol = 'diseno' OR u.rol = 'administracion')) OR
        (sector_nombre = 'Instalaciones' AND u.rol = 'instalaciones') OR
        (sector_nombre = 'Asesor Técnico' AND (u.rol = 'asesor-tecnico' OR u.rol = 'administracion')) OR
        (sector_nombre = 'Presupuestos' AND (u.rol = 'presupuestos' OR u.rol = 'asesor-tecnico' OR u.rol = 'administracion'))
      )
    ORDER BY u.nombre;
  END IF;
END;
$$;

COMMIT;

-- ============================================
-- Verificación
-- ============================================
DO $$
DECLARE
  func_return_type text;
BEGIN
  SELECT pg_get_function_result(p.oid)
  INTO func_return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'get_users_by_sector'
  LIMIT 1;
  
  RAISE NOTICE '✅ Función get_users_by_sector actualizada';
  RAISE NOTICE '   Tipo de retorno: %', func_return_type;
END $$;

