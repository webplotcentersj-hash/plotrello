-- Actualizar función create_orden_with_contact para incluir campos de brief
-- Primero eliminar todas las variantes existentes

DO $$
DECLARE
  func_signature text;
BEGIN
  -- Eliminar todas las variantes de create_orden_with_contact
  FOR func_signature IN
    SELECT pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_orden_with_contact'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.create_orden_with_contact(%s) CASCADE', func_signature);
  END LOOP;
END $$;

-- Crear nueva función con campos de brief
CREATE OR REPLACE FUNCTION public.create_orden_with_contact(
  p_numero_op varchar(255),
  p_cliente varchar(255),
  p_descripcion text DEFAULT NULL,
  p_estado varchar(50) DEFAULT 'Pendiente',
  p_prioridad varchar(50) DEFAULT 'Normal',
  p_fecha_entrega date DEFAULT CURRENT_DATE,
  p_operario_asignado varchar(100) DEFAULT NULL,
  p_complejidad text DEFAULT 'Media',
  p_sector text DEFAULT 'Diseño Gráfico',
  p_sectores text[] DEFAULT NULL,
  p_sector_inicial text DEFAULT NULL,
  p_materiales text DEFAULT NULL,
  p_nombre_creador varchar(100) DEFAULT NULL,
  p_telefono_cliente text DEFAULT NULL,
  p_email_cliente text DEFAULT NULL,
  p_direccion_cliente text DEFAULT NULL,
  p_whatsapp_link text DEFAULT NULL,
  p_ubicacion_link text DEFAULT NULL,
  p_drive_link text DEFAULT NULL,
  p_foto_url text DEFAULT NULL,
  p_dni_cuit varchar(32) DEFAULT NULL,
  p_etiquetas text[] DEFAULT NULL,
  p_brief_publico text DEFAULT NULL,
  p_objetivo_proyecto text DEFAULT NULL,
  p_publico_objetivo text DEFAULT NULL,
  p_estilo_diseno text DEFAULT NULL,
  p_referencias text DEFAULT NULL,
  p_deadline_brief date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id integer;
  v_sector_final text;
  v_sector_inicial_final text;
  etiqueta_item text;
BEGIN
  -- Determinar sector final
  IF p_sectores IS NOT NULL AND array_length(p_sectores, 1) > 0 THEN
    v_sector_final := p_sectores[1];
    v_sector_inicial_final := COALESCE(p_sector_inicial, p_sectores[1]);
  ELSE
    v_sector_final := COALESCE(p_sector, 'Diseño Gráfico');
    v_sector_inicial_final := COALESCE(p_sector_inicial, v_sector_final);
  END IF;

  -- Insertar en ordenes_trabajo
  INSERT INTO public.ordenes_trabajo (
    numero_op,
    cliente,
    dni_cuit,
    descripcion,
    estado,
    prioridad,
    fecha_entrega,
    operario_asignado,
    complejidad,
    sector,
    sectores,
    sector_inicial,
    materiales,
    nombre_creador,
    foto_url,
    telefono_cliente,
    email_cliente,
    direccion_cliente,
    whatsapp_link,
    ubicacion_link,
    drive_link,
    etiquetas,
    brief_publico,
    objetivo_proyecto,
    publico_objetivo,
    estilo_diseno,
    referencias,
    deadline_brief
  )
  VALUES (
    p_numero_op,
    p_cliente,
    p_dni_cuit,
    p_descripcion,
    p_estado,
    p_prioridad,
    p_fecha_entrega,
    p_operario_asignado,
    p_complejidad,
    v_sector_final,
    p_sectores,
    v_sector_inicial_final,
    p_materiales,
    p_nombre_creador,
    p_foto_url,
    p_telefono_cliente,
    p_email_cliente,
    p_direccion_cliente,
    p_whatsapp_link,
    p_ubicacion_link,
    p_drive_link,
    p_etiquetas,
    p_brief_publico,
    p_objetivo_proyecto,
    p_publico_objetivo,
    p_estilo_diseno,
    p_referencias,
    p_deadline_brief
  )
  RETURNING id INTO v_new_id;

  -- Guardar cada etiqueta en la tabla de etiquetas disponibles
  IF p_etiquetas IS NOT NULL AND array_length(p_etiquetas, 1) > 0 THEN
    FOREACH etiqueta_item IN ARRAY p_etiquetas
    LOOP
      IF etiqueta_item IS NOT NULL AND trim(etiqueta_item) != '' THEN
        PERFORM public.agregar_etiqueta_disponible(etiqueta_item);
      END IF;
    END LOOP;
  END IF;

  RETURN v_new_id;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.create_orden_with_contact TO anon;
GRANT EXECUTE ON FUNCTION public.create_orden_with_contact TO authenticated;

