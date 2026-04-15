-- =============================================================================
-- DT: Al transformar una Ficha No OP en OP real, NO traspasar checklists.
--
-- Problema:
-- - `transformar_ficha_no_op_a_op` convierte "in-place" la fila de `ordenes_trabajo`.
-- - Eso deja "pegados" flags de checklist (planilla/FT/presupuesto) y `tarea_subitems`.
--
-- Solución:
-- - Resetear flags de checklist en `ordenes_trabajo` para la ficha principal y relacionadas.
-- - Borrar `tarea_subitems` de esas fichas (checklist por ficha).
--
-- Aplicar en Supabase (producción): Dashboard → SQL Editor → Run.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.transformar_ficha_no_op_a_op(p_id_orden integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_orden record;
  v_nuevo_numero_op text;
  v_ultimo_numero integer;
  v_año text;
  v_pdf_url text;
  v_ids integer[];
BEGIN
  SELECT * INTO v_orden
  FROM public.ordenes_trabajo
  WHERE id = p_id_orden;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada: %', p_id_orden;
  END IF;

  IF v_orden.es_ficha_no_op IS NOT TRUE THEN
    RAISE EXCEPTION 'La orden % no es una ficha No OP', p_id_orden;
  END IF;

  IF v_orden.estado NOT LIKE '%Finalizado%' AND v_orden.estado != 'finalizado-asesor-presupuestos' THEN
    RAISE EXCEPTION 'La orden debe estar en estado "Finalizado" para transformarse en OP. Estado actual: %', v_orden.estado;
  END IF;

  -- IDs a transformar (principal + fichas relacionadas por numero_op original)
  SELECT COALESCE(array_agg(id), ARRAY[p_id_orden]::integer[])
  INTO v_ids
  FROM public.ordenes_trabajo
  WHERE numero_op = v_orden.numero_op
    AND es_ficha_no_op = true;

  -- Preservar PDF de ficha técnica si existe en alguna relacionada
  v_pdf_url := v_orden.ficha_tecnica_pdf_url;
  IF v_pdf_url IS NULL OR v_pdf_url = '' THEN
    SELECT o.ficha_tecnica_pdf_url INTO v_pdf_url
    FROM public.ordenes_trabajo o
    WHERE o.numero_op = v_orden.numero_op
      AND o.es_ficha_no_op = true
      AND o.ficha_tecnica_pdf_url IS NOT NULL
      AND trim(o.ficha_tecnica_pdf_url) != ''
    LIMIT 1;
  END IF;

  -- Generar nuevo número OP
  v_año := TO_CHAR(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_op FROM 'OP-' || v_año || '([0-9]+)$') AS integer)), 0)
  INTO v_ultimo_numero
  FROM public.ordenes_trabajo
  WHERE numero_op LIKE 'OP-' || v_año || '%'
    AND numero_op NOT LIKE 'FICHA-%';

  v_ultimo_numero := v_ultimo_numero + 1;
  v_nuevo_numero_op := 'OP-' || v_año || LPAD(v_ultimo_numero::text, 5, '0');

  -- Borrar checklists/subtareas asociadas a la ficha (no deben pasar a la OP)
  DELETE FROM public.tarea_subitems WHERE id_orden = ANY(v_ids);

  -- Transformar + resetear flags de checklist (no traspasar)
  UPDATE public.ordenes_trabajo
  SET
    numero_ficha_original = COALESCE(numero_ficha_original, v_orden.numero_op),
    numero_op = v_nuevo_numero_op,
    es_ficha_no_op = false,
    estado = 'Diseño Gráfico',
    sector = 'Diseño Gráfico',
    sector_inicial = COALESCE(sector_inicial, 'Diseño Gráfico'),
    sectores = ARRAY['Diseño Gráfico']::text[],
    ficha_tecnica_pdf_url = COALESCE(ficha_tecnica_pdf_url, v_pdf_url),
    -- flags/checklists DT
    planilla_preliminar = false,
    ficha_tecnica_cargada = false,
    presupuesto_enviado_cliente = false,
    presupuesto_armado = false,
    presupuesto_en_espera = false
  WHERE id = ANY(v_ids);

  RAISE NOTICE '✅ Ficha No OP % transformada en OP % (checklists reseteados)', v_orden.numero_op, v_nuevo_numero_op;
  RETURN p_id_orden;
END;
$function$;

COMMIT;

