-- Historial de fichas: conservar el número FICHA-* al convertir a OP (numero_ficha_original)

ALTER TABLE public.ordenes_trabajo
  ADD COLUMN IF NOT EXISTS numero_ficha_original text;

COMMENT ON COLUMN public.ordenes_trabajo.numero_ficha_original IS
  'Si la fila fue ficha No OP y se transformó en OP, guarda el numero_op anterior (ej. FICHA-123).';

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

  v_año := TO_CHAR(CURRENT_DATE, 'YY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_op FROM 'OP-' || v_año || '([0-9]+)$') AS integer)), 0)
  INTO v_ultimo_numero
  FROM public.ordenes_trabajo
  WHERE numero_op LIKE 'OP-' || v_año || '%'
    AND numero_op NOT LIKE 'FICHA-%';

  v_ultimo_numero := v_ultimo_numero + 1;
  v_nuevo_numero_op := 'OP-' || v_año || LPAD(v_ultimo_numero::text, 5, '0');

  UPDATE public.ordenes_trabajo
  SET
    numero_ficha_original = COALESCE(numero_ficha_original, v_orden.numero_op),
    numero_op = v_nuevo_numero_op,
    es_ficha_no_op = false,
    estado = 'Diseño Gráfico',
    sector = 'Diseño Gráfico',
    sector_inicial = COALESCE(sector_inicial, 'Diseño Gráfico'),
    sectores = ARRAY['Diseño Gráfico']::text[],
    ficha_tecnica_pdf_url = COALESCE(ficha_tecnica_pdf_url, v_pdf_url)
  WHERE id = p_id_orden;

  UPDATE public.ordenes_trabajo
  SET
    numero_ficha_original = COALESCE(numero_ficha_original, numero_op),
    numero_op = v_nuevo_numero_op,
    es_ficha_no_op = false,
    estado = 'Diseño Gráfico',
    sector = 'Diseño Gráfico',
    sectores = ARRAY['Diseño Gráfico']::text[],
    ficha_tecnica_pdf_url = COALESCE(ficha_tecnica_pdf_url, v_pdf_url)
  WHERE numero_op = v_orden.numero_op
    AND id != p_id_orden
    AND es_ficha_no_op = true;

  RAISE NOTICE '✅ Ficha No OP % transformada en OP % (PDF ficha técnica preservado)', v_orden.numero_op, v_nuevo_numero_op;

  RETURN p_id_orden;
END;
$function$;
