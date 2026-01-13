-- Función para crear venta directamente sin oportunidad (para ventas rápidas desde mostrador)
-- Primero, hacer id_op y numero_op opcionales en la tabla ventas

ALTER TABLE public.ventas 
  ALTER COLUMN id_op DROP NOT NULL,
  ALTER COLUMN numero_op DROP NOT NULL;

-- Función para crear venta directamente sin oportunidad (para ventas rápidas desde mostrador)

CREATE OR REPLACE FUNCTION public.crear_venta_directa(
  p_cliente_nombre varchar(255),
  p_cliente_telefono varchar(50) DEFAULT NULL,
  p_cliente_email varchar(255) DEFAULT NULL,
  p_cliente_dni_cuit varchar(50) DEFAULT NULL,
  p_cliente_empresa varchar(255) DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_valor_total numeric(10,2),
  p_metodo_pago varchar(50) DEFAULT NULL,
  p_estado_pago varchar(50) DEFAULT 'Pendiente',
  p_fecha_venta date DEFAULT CURRENT_DATE,
  p_id_vendedor integer,
  p_nombre_vendedor varchar(100),
  p_observaciones text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id integer;
  v_numero_venta varchar(50);
  v_result json;
BEGIN
  -- Generar número de venta
  v_numero_venta := 'VENT-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(
    (COALESCE((SELECT MAX(id) FROM public.ventas), 0) + 1)::text,
    4,
    '0'
  );

  -- Crear venta directamente (sin oportunidad ni OP)
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
  ) VALUES (
    v_numero_venta,
    NULL, -- Sin oportunidad
    p_cliente_nombre,
    p_cliente_telefono,
    p_cliente_email,
    p_cliente_dni_cuit,
    p_cliente_empresa,
    p_cliente_direccion,
    NULL, -- Sin OP inicialmente
    NULL, -- Sin número de OP inicialmente
    p_valor_total,
    p_metodo_pago,
    p_estado_pago,
    p_fecha_venta,
    p_id_vendedor,
    p_nombre_vendedor,
    p_observaciones
  ) RETURNING id INTO v_id;

  SELECT json_build_object(
    'success', true,
    'data', json_build_object(
      'id', v_id,
      'numero_venta', v_numero_venta
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.crear_venta_directa IS 'Crea una venta directamente sin necesidad de oportunidad ni OP (para ventas rápidas desde mostrador)';

