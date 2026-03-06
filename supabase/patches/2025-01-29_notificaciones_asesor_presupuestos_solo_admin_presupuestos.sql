-- Las notificaciones de Asesor Técnico y Presupuestos solo van a admin y presupuestos
-- (no a todos los usuarios del sector, ni a asesor-tecnico)

CREATE OR REPLACE FUNCTION public.get_users_by_sector(sector_nombre text)
RETURNS TABLE (user_id integer, user_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists boolean := false;
BEGIN
  -- Para Asesor Técnico y Presupuestos: SOLO admin y presupuestos (no asesor-tecnico ni todos)
  IF sector_nombre IN ('Asesor Técnico', 'Presupuestos') THEN
    RETURN QUERY
    SELECT u.id::integer AS user_id, u.nombre::text AS user_nombre
    FROM public.usuarios u
    WHERE u.rol IN ('administracion', 'gerencia', 'presupuestos')
    ORDER BY u.nombre;
    RETURN;
  END IF;

  -- Intentar verificar si la tabla existe (con manejo de errores)
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'usuario_sectores'
    ) INTO table_exists;
  EXCEPTION WHEN OTHERS THEN
    table_exists := false;
  END;
  
  -- Si la tabla existe, intentar usarla con SQL dinámico
  IF table_exists THEN
    BEGIN
      RETURN QUERY
      EXECUTE format('
        SELECT DISTINCT u.id::integer AS user_id, u.nombre::text AS user_nombre
        FROM public.usuarios u
        INNER JOIN public.usuario_sectores us ON u.id = us.usuario_id
        INNER JOIN public.sectores s ON us.sector_id = s.id
        WHERE s.nombre = %L
        ORDER BY u.nombre
      ', sector_nombre);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error usando usuario_sectores, usando fallback: %', SQLERRM;
      table_exists := false;
    END;
  END IF;
  
  -- Fallback: mapeo de sectores a roles (para otros sectores)
  IF NOT table_exists THEN
    RETURN QUERY
    SELECT u.id::integer AS user_id, u.nombre::text AS user_nombre
    FROM public.usuarios u
    WHERE 
      (
        (sector_nombre = 'Taller de Imprenta' AND (u.rol = 'imprenta' OR u.rol = 'taller-grafico')) OR
        (sector_nombre = 'Taller Gráfico' AND u.rol = 'taller-grafico') OR
        (sector_nombre = 'Metalúrgica' AND u.rol = 'metalurgica') OR
        (sector_nombre = 'Mostrador' AND u.rol = 'mostrador') OR
        (sector_nombre = 'Caja' AND u.rol = 'caja') OR
        (sector_nombre = 'Diseño Gráfico' AND (u.rol = 'diseno' OR u.rol = 'administracion')) OR
        (sector_nombre = 'Instalaciones' AND u.rol = 'instalaciones')
      )
    ORDER BY u.nombre;
  END IF;
  
  RETURN;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error crítico en get_users_by_sector para sector "%": %', sector_nombre, SQLERRM;
  RETURN;
END;
$$;
