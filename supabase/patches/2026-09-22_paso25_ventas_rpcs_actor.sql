-- Paso 25 seguridad (ventas): las RPC que escriben ventas y oportunidades piden actor.
--
-- El Paso 21 revocó el DML directo sobre ventas / ventas_items, pero dejó como vía de escritura
-- crear_venta_directa, agregar_item_venta, eliminar_item_venta y las de oportunidades, que son
-- SECURITY DEFINER SIN ningún control de quién las ejecuta y con EXECUTE para PUBLIC.
-- Con la clave anon (que viaja en el bundle público) se podían crear ventas y cambiar importes
-- —y desde el sistema de comisiones, fabricarse comisiones.
--
-- Acá no se reescribe la lógica: se envuelve cada función en una `ventas_*` que valida el actor
-- (actor_puede_escribir_comercial, Paso 21) y se revoca la original de PUBLIC / anon / authenticated.
-- Las llamadas se hacen por nombre de parámetro, así no dependen del orden de la firma viva.
--
-- IMPORTANTE: aplicar ANTES de deployar el front que llama a las nuevas funciones.
-- Idempotente.

BEGIN;

-- 0) Chequeo previo: los envoltorios llaman a las originales por nombre de parámetro.
-- Si algún nombre no coincide con lo que hay en esta base, el patch falla ACÁ (y no se aplica nada),
-- en vez de romper recién cuando alguien intente cargar una venta.
DO $$
DECLARE
  r RECORD;
  v_faltan text := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('crear_venta_directa', ARRAY['p_cliente_nombre','p_valor_total','p_id_vendedor','p_nombre_vendedor',
        'p_cliente_telefono','p_cliente_email','p_cliente_dni_cuit','p_cliente_empresa','p_cliente_direccion',
        'p_metodo_pago','p_estado_pago','p_fecha_venta','p_observaciones','p_id_cliente']),
      ('agregar_item_venta', ARRAY['p_id_venta','p_descripcion','p_precio_unitario','p_cantidad',
        'p_id_articulo_stock','p_codigo_articulo','p_descuento','p_observaciones']),
      ('eliminar_item_venta', ARRAY['p_id_item']),
      ('crear_venta_desde_oportunidad', ARRAY['p_id_oportunidad','p_id_op','p_numero_op','p_valor_total',
        'p_id_vendedor','p_nombre_vendedor','p_metodo_pago','p_estado_pago','p_fecha_venta','p_observaciones']),
      ('crear_oportunidad_venta', ARRAY['p_cliente_nombre','p_id_vendedor','p_nombre_vendedor','p_cliente_telefono',
        'p_cliente_email','p_cliente_dni_cuit','p_cliente_empresa','p_cliente_direccion','p_descripcion',
        'p_valor_estimado','p_probabilidad_cierre','p_etapa','p_fecha_cierre_estimada','p_observaciones']),
      ('actualizar_oportunidad_venta', ARRAY['p_id','p_cliente_nombre','p_cliente_telefono','p_cliente_email',
        'p_cliente_dni_cuit','p_cliente_empresa','p_cliente_direccion','p_descripcion','p_valor_estimado',
        'p_probabilidad_cierre','p_etapa','p_fecha_cierre_estimada','p_id_op','p_numero_op','p_observaciones','p_activo']),
      ('crear_seguimiento_venta', ARRAY['p_id_oportunidad','p_tipo_seguimiento','p_descripcion','p_id_usuario',
        'p_nombre_usuario','p_proxima_accion','p_fecha_proxima_accion']),
      ('crear_venta_desde_pedido_cliente', ARRAY['p_id_pedido'])
    ) AS t(fn, args)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = r.fn
        AND r.args <@ COALESCE(p.proargnames, ARRAY[]::text[])
    ) THEN
      v_faltan := v_faltan || r.fn || ' ';
    END IF;
  END LOOP;

  IF v_faltan <> '' THEN
    RAISE EXCEPTION
      'No se aplicó nada: estas funciones no existen o sus parámetros se llaman distinto: %. Para ver las firmas vivas: SELECT proname, proargnames FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = ''public'' AND proname LIKE ''%%venta%%'';',
      v_faltan;
  END IF;
END$$;

-- 1) Ventas -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ventas_crear_directa(
  p_actor_id integer,
  p_cliente_nombre varchar(255),
  p_valor_total numeric(10,2),
  p_id_vendedor integer,
  p_nombre_vendedor varchar(100),
  p_cliente_telefono varchar(50) DEFAULT NULL,
  p_cliente_email varchar(255) DEFAULT NULL,
  p_cliente_dni_cuit varchar(50) DEFAULT NULL,
  p_cliente_empresa varchar(255) DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_metodo_pago varchar(50) DEFAULT NULL,
  p_estado_pago varchar(50) DEFAULT 'Pendiente',
  p_fecha_venta date DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_id_cliente integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para crear ventas';
  END IF;

  RETURN public.crear_venta_directa(
    p_cliente_nombre => p_cliente_nombre,
    p_valor_total => p_valor_total,
    p_id_vendedor => p_id_vendedor,
    p_nombre_vendedor => p_nombre_vendedor,
    p_cliente_telefono => p_cliente_telefono,
    p_cliente_email => p_cliente_email,
    p_cliente_dni_cuit => p_cliente_dni_cuit,
    p_cliente_empresa => p_cliente_empresa,
    p_cliente_direccion => p_cliente_direccion,
    p_metodo_pago => p_metodo_pago,
    p_estado_pago => p_estado_pago,
    p_fecha_venta => p_fecha_venta,
    p_observaciones => p_observaciones,
    p_id_cliente => p_id_cliente
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ventas_agregar_item(
  p_actor_id integer,
  p_id_venta integer,
  p_descripcion text,
  p_precio_unitario numeric(10,2),
  p_cantidad numeric(10,3) DEFAULT 1.000,
  p_id_articulo_stock integer DEFAULT NULL,
  p_codigo_articulo varchar(100) DEFAULT NULL,
  p_descuento numeric(10,2) DEFAULT 0,
  p_observaciones text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para modificar ventas';
  END IF;

  RETURN public.agregar_item_venta(
    p_id_venta => p_id_venta,
    p_descripcion => p_descripcion,
    p_precio_unitario => p_precio_unitario,
    p_cantidad => p_cantidad,
    p_id_articulo_stock => p_id_articulo_stock,
    p_codigo_articulo => p_codigo_articulo,
    p_descuento => p_descuento,
    p_observaciones => p_observaciones
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ventas_eliminar_item(
  p_actor_id integer,
  p_id_item integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para modificar ventas';
  END IF;

  RETURN public.eliminar_item_venta(p_id_item => p_id_item);
END;
$$;

CREATE OR REPLACE FUNCTION public.ventas_crear_desde_oportunidad(
  p_actor_id integer,
  p_id_oportunidad integer,
  p_id_op integer,
  p_numero_op varchar(255),
  p_valor_total numeric(10,2),
  p_id_vendedor integer,
  p_nombre_vendedor varchar(100),
  p_metodo_pago varchar(50) DEFAULT NULL,
  p_estado_pago varchar(50) DEFAULT 'Pendiente',
  p_fecha_venta date DEFAULT CURRENT_DATE,
  p_observaciones text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para crear ventas';
  END IF;

  RETURN public.crear_venta_desde_oportunidad(
    p_id_oportunidad => p_id_oportunidad,
    p_id_op => p_id_op,
    p_numero_op => p_numero_op,
    p_valor_total => p_valor_total,
    p_id_vendedor => p_id_vendedor,
    p_nombre_vendedor => p_nombre_vendedor,
    p_metodo_pago => p_metodo_pago,
    p_estado_pago => p_estado_pago,
    p_fecha_venta => p_fecha_venta,
    p_observaciones => p_observaciones
  );
END;
$$;

-- 2) Oportunidades y seguimientos -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ventas_crear_oportunidad(
  p_actor_id integer,
  p_cliente_nombre varchar(255),
  p_id_vendedor integer,
  p_nombre_vendedor varchar(100),
  p_cliente_telefono varchar(50) DEFAULT NULL,
  p_cliente_email varchar(255) DEFAULT NULL,
  p_cliente_dni_cuit varchar(50) DEFAULT NULL,
  p_cliente_empresa varchar(255) DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_valor_estimado numeric(10,2) DEFAULT NULL,
  p_probabilidad_cierre integer DEFAULT 50,
  p_etapa varchar(50) DEFAULT 'Prospecto',
  p_fecha_cierre_estimada date DEFAULT NULL,
  p_observaciones text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para crear oportunidades';
  END IF;

  RETURN public.crear_oportunidad_venta(
    p_cliente_nombre => p_cliente_nombre,
    p_id_vendedor => p_id_vendedor,
    p_nombre_vendedor => p_nombre_vendedor,
    p_cliente_telefono => p_cliente_telefono,
    p_cliente_email => p_cliente_email,
    p_cliente_dni_cuit => p_cliente_dni_cuit,
    p_cliente_empresa => p_cliente_empresa,
    p_cliente_direccion => p_cliente_direccion,
    p_descripcion => p_descripcion,
    p_valor_estimado => p_valor_estimado,
    p_probabilidad_cierre => p_probabilidad_cierre,
    p_etapa => p_etapa,
    p_fecha_cierre_estimada => p_fecha_cierre_estimada,
    p_observaciones => p_observaciones
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ventas_actualizar_oportunidad(
  p_actor_id integer,
  p_id integer,
  p_cliente_nombre varchar(255) DEFAULT NULL,
  p_cliente_telefono varchar(50) DEFAULT NULL,
  p_cliente_email varchar(255) DEFAULT NULL,
  p_cliente_dni_cuit varchar(50) DEFAULT NULL,
  p_cliente_empresa varchar(255) DEFAULT NULL,
  p_cliente_direccion text DEFAULT NULL,
  p_descripcion text DEFAULT NULL,
  p_valor_estimado numeric(10,2) DEFAULT NULL,
  p_probabilidad_cierre integer DEFAULT NULL,
  p_etapa varchar(50) DEFAULT NULL,
  p_fecha_cierre_estimada date DEFAULT NULL,
  p_id_op integer DEFAULT NULL,
  p_numero_op varchar(255) DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_activo boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para modificar oportunidades';
  END IF;

  RETURN public.actualizar_oportunidad_venta(
    p_id => p_id,
    p_cliente_nombre => p_cliente_nombre,
    p_cliente_telefono => p_cliente_telefono,
    p_cliente_email => p_cliente_email,
    p_cliente_dni_cuit => p_cliente_dni_cuit,
    p_cliente_empresa => p_cliente_empresa,
    p_cliente_direccion => p_cliente_direccion,
    p_descripcion => p_descripcion,
    p_valor_estimado => p_valor_estimado,
    p_probabilidad_cierre => p_probabilidad_cierre,
    p_etapa => p_etapa,
    p_fecha_cierre_estimada => p_fecha_cierre_estimada,
    p_id_op => p_id_op,
    p_numero_op => p_numero_op,
    p_observaciones => p_observaciones,
    p_activo => p_activo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ventas_crear_seguimiento(
  p_actor_id integer,
  p_id_oportunidad integer,
  p_tipo_seguimiento varchar(50),
  p_descripcion text,
  p_id_usuario integer,
  p_nombre_usuario varchar(100),
  p_proxima_accion text DEFAULT NULL,
  p_fecha_proxima_accion date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_escribir_comercial(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para registrar seguimientos';
  END IF;

  RETURN public.crear_seguimiento_venta(
    p_id_oportunidad => p_id_oportunidad,
    p_tipo_seguimiento => p_tipo_seguimiento,
    p_descripcion => p_descripcion,
    p_id_usuario => p_id_usuario,
    p_nombre_usuario => p_nombre_usuario,
    p_proxima_accion => p_proxima_accion,
    p_fecha_proxima_accion => p_fecha_proxima_accion
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ventas_crear_directa(integer, varchar, numeric, integer, varchar, varchar, varchar, varchar, varchar, text, varchar, varchar, date, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_agregar_item(integer, integer, text, numeric, numeric, integer, varchar, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_eliminar_item(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_crear_desde_oportunidad(integer, integer, integer, varchar, numeric, integer, varchar, varchar, varchar, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_crear_oportunidad(integer, varchar, integer, varchar, varchar, varchar, varchar, varchar, text, text, numeric, integer, varchar, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_actualizar_oportunidad(integer, integer, varchar, varchar, varchar, varchar, varchar, text, text, numeric, integer, varchar, date, integer, varchar, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ventas_crear_seguimiento(integer, integer, varchar, text, integer, varchar, text, date) TO anon, authenticated;

-- 3) Portal de clientes ------------------------------------------------------------------
-- El portal necesita crear la venta del pedido sin sesión de staff, pero NO debe poder elegir
-- el vendedor (con comisiones, eso es plata): el wrapper no acepta ese dato y la función
-- original elige el usuario de portal / mostrador. Sigue siendo idempotente por pedido.
CREATE OR REPLACE FUNCTION public.pedidos_crear_venta_portal(p_id_pedido integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.crear_venta_desde_pedido_cliente(p_id_pedido => p_id_pedido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pedidos_crear_venta_portal(integer) TO anon, authenticated;

-- 4) Número de venta sin carrera -------------------------------------------------------------
-- Antes se armaba con MAX(id) + 1 leído antes de insertar: dos ventas simultáneas podían
-- quedar con el mismo número. Ahora lo asigna un trigger con una secuencia.
CREATE SEQUENCE IF NOT EXISTS public.ventas_numero_seq AS bigint START 1;

SELECT setval('public.ventas_numero_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.ventas), 1));

CREATE OR REPLACE FUNCTION public.ventas_asignar_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.numero_venta := 'VENT-'
    || to_char(COALESCE(NEW.fecha_venta, CURRENT_DATE), 'YYYYMMDD')
    || '-' || lpad(nextval('public.ventas_numero_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_asignar_numero ON public.ventas;
CREATE TRIGGER trg_ventas_asignar_numero
  BEFORE INSERT ON public.ventas
  FOR EACH ROW
  EXECUTE FUNCTION public.ventas_asignar_numero();

COMMENT ON FUNCTION public.ventas_asignar_numero() IS
  'Paso 25: numero_venta desde secuencia (sin carrera). Para importar ventas con número propio, desactivar el trigger.';

-- 5) Cerrar las originales (cualquier firma que exista en la base) --------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'crear_venta_directa',
        'agregar_item_venta',
        'eliminar_item_venta',
        'crear_venta_desde_oportunidad',
        'crear_oportunidad_venta',
        'actualizar_oportunidad_venta',
        'crear_seguimiento_venta',
        'crear_venta_desde_pedido_cliente'
      )
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || r.sig || ' FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO service_role';
  END LOOP;
END$$;

COMMENT ON FUNCTION public.ventas_crear_directa(integer, varchar, numeric, integer, varchar, varchar, varchar, varchar, varchar, text, varchar, varchar, date, text, integer) IS
  'Paso 25: crear venta con actor activo. crear_venta_directa ya no es ejecutable por anon.';

COMMIT;
