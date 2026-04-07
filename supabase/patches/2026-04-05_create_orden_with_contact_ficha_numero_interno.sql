-- Ficha No OP (correlativo automático): no depende solo de p_es_ficha_no_op.
-- También aplica si p_numero_op trae prefijo FICHA sin correlativo numérico completo (p. ej. "FICHA-"),
-- que es cómo se alta una ficha presupuesto/asesor aunque el cliente no mande el flag.
-- Las OP reales usan otro patrón (p. ej. OP-…); no se confunde con “ficha” del tablero genérico.

DO $$
DECLARE
  func_signature text;
BEGIN
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
  p_deadline_brief date DEFAULT NULL,
  p_es_ficha_no_op boolean DEFAULT false,
  p_planilla_preliminar boolean DEFAULT false,
  p_ficha_tecnica_pdf_url text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id integer;
  v_sector_final text;
  v_sector_inicial_final text;
  etiqueta_item text;
  v_numero_op text;
  v_raw text;
  v_upper text;
  v_usa_correlativo_ficha boolean;
BEGIN
  v_raw := trim(COALESCE(p_numero_op, ''));
  v_upper := upper(v_raw);
  v_usa_correlativo_ficha :=
    COALESCE(p_es_ficha_no_op, false)
    OR (
      v_upper ~ '^FICHA'
      AND v_upper !~ '^FICHA-[0-9]+$'
    );

  IF v_usa_correlativo_ficha THEN
    v_numero_op := next_numero_ficha_no_op();
  ELSE
    v_numero_op := v_raw;
    IF v_numero_op IS NULL OR v_numero_op = '' THEN
      RAISE EXCEPTION 'p_numero_op es requerido';
    END IF;
  END IF;

  IF p_sectores IS NOT NULL AND array_length(p_sectores, 1) > 0 THEN
    v_sector_final := p_sectores[1];
    v_sector_inicial_final := COALESCE(p_sector_inicial, p_sectores[1]);
  ELSE
    v_sector_final := COALESCE(p_sector, 'Diseño Gráfico');
    v_sector_inicial_final := COALESCE(p_sector_inicial, v_sector_final);
  END IF;

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
    deadline_brief,
    es_ficha_no_op,
    planilla_preliminar,
    ficha_tecnica_pdf_url
  )
  VALUES (
    v_numero_op,
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
    p_deadline_brief,
    v_usa_correlativo_ficha,
    p_planilla_preliminar,
    p_ficha_tecnica_pdf_url
  )
  RETURNING id INTO v_new_id;

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

GRANT EXECUTE ON FUNCTION public.create_orden_with_contact TO anon;
GRANT EXECUTE ON FUNCTION public.create_orden_with_contact TO authenticated;
