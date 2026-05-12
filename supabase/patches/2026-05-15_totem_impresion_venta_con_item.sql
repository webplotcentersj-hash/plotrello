-- Cada solicitud de impresión tótem genera además un ítem en ventas_items
-- para que el CRM / reportes cuenten la venta con detalle (no solo cabecera).

CREATE OR REPLACE FUNCTION public.crear_solicitud_impresion_totem (
  p_cliente_nombre varchar(255),
  p_cliente_dni varchar(80),
  p_cliente_telefono varchar(80),
  p_cantidad_hojas integer,
  p_tipo_impresion varchar(120),
  p_origen_archivo varchar(40),
  p_archivo_url text,
  p_archivo_nombre varchar(512),
  p_orden_id integer DEFAULT NULL,
  p_numero_op varchar(80) DEFAULT NULL,
  p_valor_total numeric DEFAULT NULL,
  p_id_vendedor integer DEFAULT 1,
  p_nombre_vendedor varchar(100) DEFAULT 'Totem autoservicio'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_id_venta integer;
  v_numero_venta varchar(50);
  v_valor numeric(10, 2);
  v_titulo text := 'Tótem: nueva solicitud de impresión';
  v_desc text;
  v_user record;
  v_obs_venta text;
BEGIN
  v_valor := COALESCE(p_valor_total, 0)::numeric(10, 2);
  IF v_valor < 0.01 THEN
    v_valor := 0.01;
  END IF;

  v_numero_venta := 'VENT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    (coalesce((SELECT max(id) FROM public.ventas), 0) + 1)::text,
    4,
    '0'
  );

  v_obs_venta :=
    'Venta generada desde tótem (impresión). Solicitud se crea al confirmar el pedido.' || E'\n' ||
    'Hojas: ' || p_cantidad_hojas::text || ' | Tipo: ' || trim(p_tipo_impresion) || E'\n' ||
    'Archivo: ' || trim(p_archivo_nombre) || E'\n' ||
    'Link archivo: ' || trim(p_archivo_url);

  INSERT INTO public.ventas (
    numero_venta,
    id_oportunidad,
    cliente_nombre,
    cliente_telefono,
    cliente_email,
    cliente_dni_cuit,
    cliente_empresa,
    cliente_direccion,
    id_op,
    numero_op,
    valor_total,
    metodo_pago,
    estado_pago,
    fecha_venta,
    id_vendedor,
    nombre_vendedor,
    observaciones
  )
  VALUES (
    v_numero_venta,
    NULL,
    trim(p_cliente_nombre),
    trim(p_cliente_telefono),
    NULL,
    trim(p_cliente_dni),
    NULL,
    NULL,
    p_orden_id,
    NULLIF(trim(coalesce(p_numero_op, '')), ''),
    v_valor,
    'Mercado Pago',
    'Pendiente',
    CURRENT_DATE,
    p_id_vendedor,
    trim(p_nombre_vendedor),
    v_obs_venta
  )
  RETURNING id INTO v_id_venta;

  INSERT INTO public.ventas_items (
    id_venta,
    id_articulo_stock,
    codigo_articulo,
    descripcion,
    cantidad,
    precio_unitario,
    precio_total,
    descuento,
    observaciones
  ) VALUES (
    v_id_venta,
    NULL,
    'TOTEM-IMP',
    'Impresión tótem — ' || trim(p_tipo_impresion) || ' (' || greatest(1, p_cantidad_hojas)::text || ' hojas). Origen: ' || trim(p_origen_archivo) || '. Archivo: ' || trim(p_archivo_nombre),
    1,
    v_valor,
    v_valor,
    0,
    'Generado automáticamente con la solicitud del tótem.'
  );

  UPDATE public.ventas v
  SET
    valor_total = (
      SELECT COALESCE(SUM(vi.precio_total), 0)
      FROM public.ventas_items vi
      WHERE vi.id_venta = v.id
    ),
    updated_at = now()
  WHERE v.id = v_id_venta;

  INSERT INTO public.totem_impresion_solicitudes (
    cliente_nombre,
    cliente_dni,
    cliente_telefono,
    cantidad_hojas,
    tipo_impresion,
    origen_archivo,
    archivo_url,
    archivo_nombre,
    orden_id,
    numero_op,
    id_venta
  )
  VALUES (
    trim(p_cliente_nombre),
    trim(p_cliente_dni),
    trim(p_cliente_telefono),
    p_cantidad_hojas,
    trim(p_tipo_impresion),
    trim(p_origen_archivo),
    trim(p_archivo_url),
    trim(p_archivo_nombre),
    p_orden_id,
    NULLIF(trim(coalesce(p_numero_op, '')), ''),
    v_id_venta
  )
  RETURNING id INTO v_id;

  v_desc :=
    'Cliente: ' || trim(p_cliente_nombre) || E'\n' ||
    'DNI/CUIT: ' || trim(p_cliente_dni) || ' | Tel: ' || trim(p_cliente_telefono) || E'\n' ||
    'Hojas: ' || p_cantidad_hojas::text || ' | Tipo: ' || trim(p_tipo_impresion) ||
    ' | Origen archivo: ' || trim(p_origen_archivo) || E'\n' ||
    'Archivo: ' || trim(p_archivo_nombre) || E'\n' ||
    'Descargar: ' || trim(p_archivo_url) || E'\n' ||
    'Solicitud tótem #' || v_id::text || E'\n' ||
    'Venta CRM: ' || v_numero_venta || ' (id ' || v_id_venta::text || ') — $' || trim(to_char(v_valor, 'FM999999990.00')) || E'\n' ||
    'Pago: pendiente (Mercado Pago en caja).';

  FOR v_user IN
    SELECT id FROM public.usuarios
    WHERE rol IN ('imprenta', 'mostrador', 'caja')
  LOOP
    INSERT INTO public.user_notifications (
      user_id,
      title,
      description,
      type,
      is_read,
      orden_id
    ) VALUES (
      v_user.id,
      v_titulo,
      v_desc,
      'info',
      false,
      p_orden_id
    );
  END LOOP;

  RETURN json_build_object(
    'solicitud_id', v_id,
    'id', v_id,
    'venta_id', v_id_venta,
    'numero_venta', v_numero_venta,
    'valor_total', v_valor
  );
END;
$$;

COMMENT ON FUNCTION public.crear_solicitud_impresion_totem IS 'Tótem: crea venta CRM + ítem de línea + solicitud impresión; notifica imprenta, mostrador y caja';
