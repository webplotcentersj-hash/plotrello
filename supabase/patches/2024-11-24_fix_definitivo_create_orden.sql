-- ============================================
-- FIX DEFINITIVO: create_orden_with_contact
-- Este script asegura que la función funcione correctamente
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Eliminar TODAS las variantes (método agresivo)
-- ============================================
DO $$
DECLARE
  func_record record;
  drop_sql text;
BEGIN
  RAISE NOTICE 'Eliminando todas las variantes de create_orden_with_contact...';
  
  -- Método 1: Eliminar por nombre y argumentos
  FOR func_record IN
    SELECT 
      p.oid,
      p.proname,
      n.nspname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_orden_with_contact'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
        func_record.nspname,
        func_record.proname, 
        func_record.args
      );
      RAISE NOTICE '✅ Eliminada: %(%)', func_record.proname, func_record.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '⚠️ Error al eliminar: %', SQLERRM;
    END;
  END LOOP;
  
  -- Método 2: Eliminar por OID directamente (más agresivo)
  FOR func_record IN
    SELECT p.oid, p.proname, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_orden_with_contact'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func_record.oid::regprocedure);
      RAISE NOTICE '✅ Eliminada por OID: %', func_record.oid;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar errores si ya fue eliminada
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================
-- PASO 2: Actualizar CHECK constraint del sector
-- ============================================
DO $$
BEGIN
  ALTER TABLE public.ordenes_trabajo
    DROP CONSTRAINT IF EXISTS ordenes_trabajo_sector_check;
  
  ALTER TABLE public.ordenes_trabajo
    ADD CONSTRAINT ordenes_trabajo_sector_check CHECK (
      sector IS NULL OR sector IN (
        'Diseño Gráfico',
        'Taller de Imprenta',
        'Taller Gráfico',
        'Instalaciones',
        'Metalúrgica',
        'Mostrador',
        'Caja',
        'Diseño en Proceso',
        'En Espera',
        'Imprenta (Área de Impresión)',
        'Finalizado en Taller',
        'Almacén de Entrega'
      )
    );
  
  RAISE NOTICE '✅ CHECK constraint actualizado';
END $$;

-- ============================================
-- PASO 3: Crear la función con la firma EXACTA
-- ============================================
CREATE FUNCTION public.create_orden_with_contact(
  p_numero_op varchar,
  p_cliente varchar,
  p_fecha_entrega date,
  p_descripcion text DEFAULT NULL,
  p_estado varchar DEFAULT 'Pendiente',
  p_prioridad varchar DEFAULT 'Normal',
  p_operario_asignado varchar DEFAULT NULL,
  p_complejidad text DEFAULT 'Media',
  p_sector text DEFAULT 'Diseño Gráfico',
  p_sectores text[] DEFAULT NULL,
  p_sector_inicial text DEFAULT NULL,
  p_materiales text DEFAULT NULL,
  p_nombre_creador varchar DEFAULT NULL,
  p_telefono_cliente text DEFAULT NULL,
  p_email_cliente text DEFAULT NULL,
  p_direccion_cliente text DEFAULT NULL,
  p_whatsapp_link text DEFAULT NULL,
  p_ubicacion_link text DEFAULT NULL,
  p_drive_link text DEFAULT NULL,
  p_foto_url text DEFAULT NULL,
  p_dni_cuit text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id integer;
  sectores_final text[];
  sector_inicial_final text;
  sectores_permitidos text[] := ARRAY[
    'Diseño Gráfico',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Instalaciones',
    'Metalúrgica',
    'Mostrador',
    'Caja',
    'Diseño en Proceso',
    'En Espera',
    'Imprenta (Área de Impresión)',
    'Finalizado en Taller',
    'Almacén de Entrega'
  ];
BEGIN
  -- Validar parámetros requeridos
  IF p_numero_op IS NULL OR p_numero_op = '' THEN
    RAISE EXCEPTION 'p_numero_op es requerido';
  END IF;
  
  IF p_cliente IS NULL OR p_cliente = '' THEN
    RAISE EXCEPTION 'p_cliente es requerido';
  END IF;
  
  IF p_fecha_entrega IS NULL THEN
    RAISE EXCEPTION 'p_fecha_entrega es requerido';
  END IF;
  
  -- Determinar sectores: usar p_sectores si existe, sino usar p_sector como array
  IF p_sectores IS NOT NULL AND array_length(p_sectores, 1) > 0 THEN
    sectores_final := p_sectores;
  ELSIF p_sector IS NOT NULL AND p_sector != '' THEN
    sectores_final := ARRAY[p_sector];
  ELSE
    sectores_final := ARRAY['Diseño Gráfico']::text[];
  END IF;
  
  -- Determinar sector_inicial: usar p_sector_inicial si existe, sino usar p_sector
  IF p_sector_inicial IS NOT NULL AND p_sector_inicial != '' THEN
    sector_inicial_final := p_sector_inicial;
  ELSIF p_sector IS NOT NULL AND p_sector != '' THEN
    sector_inicial_final := p_sector;
  ELSE
    sector_inicial_final := 'Diseño Gráfico';
  END IF;
  
  -- Validar que sector_inicial_final esté en la lista de sectores permitidos
  IF NOT (sector_inicial_final = ANY(sectores_permitidos)) THEN
    RAISE EXCEPTION 'Sector inicial "%" no está permitido. Sectores permitidos: %', 
      sector_inicial_final, 
      array_to_string(sectores_permitidos, ', ');
  END IF;
  
  -- Validar que todos los sectores en sectores_final estén permitidos
  IF sectores_final IS NOT NULL AND array_length(sectores_final, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(sectores_final) AS s
      WHERE NOT (s = ANY(sectores_permitidos))
    ) THEN
      RAISE EXCEPTION 'Uno o más sectores en el array no están permitidos. Sectores permitidos: %', 
        array_to_string(sectores_permitidos, ', ');
    END IF;
  END IF;
  
  -- Insertar la orden con todos los campos
  INSERT INTO public.ordenes_trabajo (
    numero_op,
    cliente,
    descripcion,
    estado,
    prioridad,
    fecha_entrega,
    operario_asignado,
    complejidad,
    sector,              -- Campo único para compatibilidad (usa sector_inicial)
    sectores,            -- Array de sectores requeridos
    sector_inicial,      -- Sector donde aparece la ficha principal
    materiales,
    nombre_creador,
    telefono_cliente,
    email_cliente,
    direccion_cliente,
    whatsapp_link,
    ubicacion_link,
    drive_link,
    foto_url,
    dni_cuit,
    fecha_creacion,
    fecha_ingreso
  ) VALUES (
    p_numero_op,
    p_cliente,
    p_descripcion,
    p_estado,
    p_prioridad,
    p_fecha_entrega,
    p_operario_asignado,
    p_complejidad,
    sector_inicial_final,  -- sector único = sector_inicial
    sectores_final,        -- sectores múltiples
    sector_inicial_final,  -- sector inicial
    p_materiales,
    p_nombre_creador,
    p_telefono_cliente,
    p_email_cliente,
    p_direccion_cliente,
    p_whatsapp_link,
    p_ubicacion_link,
    p_drive_link,
    p_foto_url,
    p_dni_cuit,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_id;
  
  -- El trigger automáticamente creará las sub-tareas si hay múltiples sectores
  
  -- Retornar SOLO el ID (integer)
  RETURN new_id;
EXCEPTION
  WHEN check_violation THEN
    RAISE EXCEPTION 'Error de constraint: %', SQLERRM;
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Error de unicidad: %', SQLERRM;
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Error de clave foránea: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al crear orden: % (Código: %)', SQLERRM, SQLSTATE;
END;
$$;

-- ============================================
-- PASO 4: Otorgar permisos explícitos
-- ============================================
GRANT EXECUTE ON FUNCTION public.create_orden_with_contact(
  varchar, varchar, date, text, varchar, varchar, varchar, text, text, text[], text, text, varchar, text, text, text, text, text, text, text, text
) TO anon;

GRANT EXECUTE ON FUNCTION public.create_orden_with_contact(
  varchar, varchar, date, text, varchar, varchar, varchar, text, text, text[], text, text, varchar, text, text, text, text, text, text, text, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_orden_with_contact(
  varchar, varchar, date, text, varchar, varchar, varchar, text, text, text[], text, text, varchar, text, text, text, text, text, text, text, text
) TO service_role;

-- ============================================
-- PASO 5: Verificación final
-- ============================================
DO $$
DECLARE
  func_count integer;
  func_return_type text;
  func_params text;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'create_orden_with_contact';
  
  IF func_count = 1 THEN
    SELECT 
      pg_get_function_result(p.oid),
      pg_get_function_identity_arguments(p.oid)
    INTO func_return_type, func_params
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_orden_with_contact'
    LIMIT 1;
    
    RAISE NOTICE '✅ Función creada correctamente';
    RAISE NOTICE '   Tipo de retorno: %', func_return_type;
    RAISE NOTICE '   Parámetros: %', func_params;
    
    IF func_return_type = 'integer' THEN
      RAISE NOTICE '✅✅✅ TIPO DE RETORNO CORRECTO: integer ✅✅✅';
    ELSE
      RAISE WARNING '❌ TIPO DE RETORNO INCORRECTO: %', func_return_type;
    END IF;
  ELSE
    RAISE WARNING '❌ Se encontraron % funciones (debería haber solo 1)', func_count;
  END IF;
END $$;

COMMIT;

-- ============================================
-- NOTA: Después de ejecutar este script, verifica en la consola del navegador
-- que los errores hayan desaparecido. Si persisten, ejecuta el script de
-- diagnóstico: 2024-11-24_diagnostico_completo_create_orden.sql
-- ============================================

