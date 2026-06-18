-- Listas de precios para Ventas (Lista 1: efectivo/débito · Lista 2: cuenta corriente)
-- y tipo de lista en presupuestos presenciales.

BEGIN;

ALTER TABLE public.articulos_empresa
  ADD COLUMN IF NOT EXISTS precio_lista_1 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_2 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_3 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_4 numeric(12, 2),
  ADD COLUMN IF NOT EXISTS precio_lista_5 numeric(12, 2);

COMMENT ON COLUMN public.articulos_empresa.precio_lista_1 IS
  'Lista 1 — efectivo o débito (Flexxus). Si es null, usar precio_base.';
COMMENT ON COLUMN public.articulos_empresa.precio_lista_2 IS
  'Lista 2 — cuenta corriente (Flexxus).';
COMMENT ON COLUMN public.articulos_empresa.precio_lista_3 IS
  'Lista 3 — Flexxus.';
COMMENT ON COLUMN public.articulos_empresa.precio_lista_4 IS
  'Lista 4 — Flexxus.';
COMMENT ON COLUMN public.articulos_empresa.precio_lista_5 IS
  'Lista 5 — Flexxus.';

UPDATE public.articulos_empresa
SET precio_lista_1 = precio_base
WHERE precio_lista_1 IS NULL AND precio_base IS NOT NULL;

ALTER TABLE public.presupuestos_ventas
  ADD COLUMN IF NOT EXISTS tipo_lista_precio varchar(20)
    CHECK (tipo_lista_precio IS NULL OR tipo_lista_precio IN ('lista_1', 'lista_2'));

COMMENT ON COLUMN public.presupuestos_ventas.tipo_lista_precio IS
  'lista_1 = efectivo/débito · lista_2 = cuenta corriente';

-- Recrear crear_presupuesto_venta con tipo de lista
CREATE OR REPLACE FUNCTION public.crear_presupuesto_venta(
  p_id_cliente integer DEFAULT NULL,
  p_cliente_nombre varchar(255) DEFAULT NULL,
  p_cliente_telefono varchar(50) DEFAULT NULL,
  p_cliente_email varchar(255) DEFAULT NULL,
  p_cliente_dni_cuit varchar(50) DEFAULT NULL,
  p_cliente_empresa varchar(255) DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_id_vendedor integer DEFAULT NULL,
  p_nombre_vendedor varchar(100) DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_fecha_vencimiento date DEFAULT NULL,
  p_observaciones_cliente text DEFAULT NULL,
  p_observaciones_internas text DEFAULT NULL,
  p_estado varchar(50) DEFAULT 'borrador',
  p_tipo_lista_precio varchar(20) DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  numero_presupuesto varchar,
  estado varchar,
  precio_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nuevo_presupuesto_id integer;
  numero_presupuesto_generado varchar(50);
  item_record jsonb;
  precio_total_calculado numeric(10,2) := 0;
BEGIN
  IF p_estado NOT IN ('borrador', 'enviado', 'aceptado', 'rechazado', 'cancelado', 'convertido') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  IF p_tipo_lista_precio IS NOT NULL AND p_tipo_lista_precio NOT IN ('lista_1', 'lista_2') THEN
    RAISE EXCEPTION 'Tipo de lista inválido: %', p_tipo_lista_precio;
  END IF;

  numero_presupuesto_generado := public.generar_numero_presupuesto_venta();

  INSERT INTO public.presupuestos_ventas (
    id_cliente,
    numero_presupuesto,
    estado,
    fecha_vencimiento,
    observaciones_cliente,
    observaciones_internas,
    fecha_envio,
    id_vendedor,
    nombre_vendedor,
    cliente_nombre,
    cliente_telefono,
    cliente_email,
    cliente_dni_cuit,
    cliente_empresa,
    cliente_direccion,
    tipo_lista_precio
  ) VALUES (
    p_id_cliente,
    numero_presupuesto_generado,
    p_estado,
    p_fecha_vencimiento,
    p_observaciones_cliente,
    p_observaciones_internas,
    CASE WHEN p_estado = 'enviado' THEN NOW() ELSE NULL END,
    p_id_vendedor,
    p_nombre_vendedor,
    p_cliente_nombre,
    p_cliente_telefono,
    p_cliente_email,
    p_cliente_dni_cuit,
    p_cliente_empresa,
    p_cliente_direccion,
    p_tipo_lista_precio
  )
  RETURNING presupuestos_ventas.id INTO nuevo_presupuesto_id;

  FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.presupuestos_ventas_items (
      id_presupuesto,
      id_articulo_stock,
      codigo_articulo,
      descripcion,
      cantidad,
      precio_unitario,
      descuento,
      precio_total,
      observaciones
    ) VALUES (
      nuevo_presupuesto_id,
      (item_record->>'id_articulo_stock')::integer,
      item_record->>'codigo_articulo',
      item_record->>'descripcion',
      COALESCE((item_record->>'cantidad')::numeric, 1),
      (item_record->>'precio_unitario')::numeric,
      COALESCE((item_record->>'descuento')::numeric, 0),
      (item_record->>'precio_total')::numeric,
      item_record->>'observaciones'
    );

    precio_total_calculado := precio_total_calculado + (item_record->>'precio_total')::numeric;
  END LOOP;

  UPDATE public.presupuestos_ventas
  SET precio_total = precio_total_calculado
  WHERE presupuestos_ventas.id = nuevo_presupuesto_id;

  RETURN QUERY
  SELECT
    p.id,
    p.numero_presupuesto,
    p.estado,
    p.precio_total
  FROM public.presupuestos_ventas p
  WHERE p.id = nuevo_presupuesto_id;
END;
$$;

COMMIT;
