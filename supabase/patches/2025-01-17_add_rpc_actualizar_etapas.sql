-- Crear funciones RPC para actualizar etapas con nombre de usuario
-- Esto permite pasar el nombre del usuario desde el frontend

BEGIN;

-- Función para actualizar etapa de Taller Gráfico
CREATE OR REPLACE FUNCTION public.actualizar_etapa_taller_grafico(
  p_id_orden integer,
  p_nueva_etapa varchar(100),
  p_nombre_usuario varchar(255)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  etapa_anterior_val varchar(100);
  fecha_inicio_anterior timestamptz;
  tiempo_segundos integer;
  usuario_actual_id integer;
BEGIN
  -- Obtener etapa anterior
  SELECT etapa_taller_grafico INTO etapa_anterior_val
  FROM public.ordenes_trabajo
  WHERE id = p_id_orden;

  -- Obtener ID del usuario
  SELECT id INTO usuario_actual_id
  FROM public.usuarios
  WHERE nombre = p_nombre_usuario
  LIMIT 1;

  -- Si hay una etapa anterior, cerrar su registro y calcular tiempo
  IF etapa_anterior_val IS NOT NULL AND etapa_anterior_val != '' THEN
    -- Obtener fecha de inicio de la etapa anterior
    SELECT fecha_inicio_etapa INTO fecha_inicio_anterior
    FROM public.historial_etapas_taller_grafico
    WHERE id_orden = p_id_orden
      AND etapa_nueva = etapa_anterior_val
      AND fecha_fin_etapa IS NULL
    ORDER BY fecha_cambio DESC
    LIMIT 1;
    
    -- Si no se encontró fecha_inicio, usar la fecha de cambio más reciente
    IF fecha_inicio_anterior IS NULL THEN
      SELECT etapa_taller_grafico_fecha_inicio INTO fecha_inicio_anterior
      FROM public.ordenes_trabajo
      WHERE id = p_id_orden;
      
      IF fecha_inicio_anterior IS NULL THEN
        fecha_inicio_anterior := now();
      END IF;
    END IF;
    
    -- Calcular tiempo en segundos
    tiempo_segundos := EXTRACT(EPOCH FROM (now() - fecha_inicio_anterior))::integer;
    
    -- Cerrar el registro de la etapa anterior
    UPDATE public.historial_etapas_taller_grafico
    SET fecha_fin_etapa = now(),
        tiempo_en_etapa_seg = tiempo_segundos
    WHERE id_orden = p_id_orden
      AND etapa_nueva = etapa_anterior_val
      AND fecha_fin_etapa IS NULL;
  END IF;
  
  -- Actualizar la orden
  UPDATE public.ordenes_trabajo
  SET etapa_taller_grafico = p_nueva_etapa,
      etapa_taller_grafico_fecha_inicio = now()
  WHERE id = p_id_orden;
  
  -- Registrar el nuevo cambio de etapa
  INSERT INTO public.historial_etapas_taller_grafico (
    id_orden,
    etapa_anterior,
    etapa_nueva,
    id_usuario,
    nombre_usuario,
    fecha_cambio,
    fecha_inicio_etapa
  ) VALUES (
    p_id_orden,
    etapa_anterior_val,
    p_nueva_etapa,
    usuario_actual_id,
    p_nombre_usuario,
    now(),
    now()
  );
END;
$$;

-- Función para actualizar etapa de Instalaciones
CREATE OR REPLACE FUNCTION public.actualizar_etapa_instalaciones(
  p_id_orden integer,
  p_nueva_etapa varchar(100),
  p_nombre_usuario varchar(255)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  etapa_anterior_val varchar(100);
  fecha_inicio_anterior timestamptz;
  tiempo_segundos integer;
  usuario_actual_id integer;
BEGIN
  -- Obtener etapa anterior
  SELECT etapa_instalaciones INTO etapa_anterior_val
  FROM public.ordenes_trabajo
  WHERE id = p_id_orden;

  -- Obtener ID del usuario
  SELECT id INTO usuario_actual_id
  FROM public.usuarios
  WHERE nombre = p_nombre_usuario
  LIMIT 1;

  -- Si hay una etapa anterior, cerrar su registro y calcular tiempo
  IF etapa_anterior_val IS NOT NULL AND etapa_anterior_val != '' THEN
    -- Obtener fecha de inicio de la etapa anterior
    SELECT fecha_inicio_etapa INTO fecha_inicio_anterior
    FROM public.historial_etapas_instalaciones
    WHERE id_orden = p_id_orden
      AND etapa_nueva = etapa_anterior_val
      AND fecha_fin_etapa IS NULL
    ORDER BY fecha_cambio DESC
    LIMIT 1;
    
    -- Si no se encontró fecha_inicio, usar la fecha de cambio más reciente
    IF fecha_inicio_anterior IS NULL THEN
      SELECT etapa_instalaciones_fecha_inicio INTO fecha_inicio_anterior
      FROM public.ordenes_trabajo
      WHERE id = p_id_orden;
      
      IF fecha_inicio_anterior IS NULL THEN
        fecha_inicio_anterior := now();
      END IF;
    END IF;
    
    -- Calcular tiempo en segundos
    tiempo_segundos := EXTRACT(EPOCH FROM (now() - fecha_inicio_anterior))::integer;
    
    -- Cerrar el registro de la etapa anterior
    UPDATE public.historial_etapas_instalaciones
    SET fecha_fin_etapa = now(),
        tiempo_en_etapa_seg = tiempo_segundos
    WHERE id_orden = p_id_orden
      AND etapa_nueva = etapa_anterior_val
      AND fecha_fin_etapa IS NULL;
  END IF;
  
  -- Actualizar la orden
  UPDATE public.ordenes_trabajo
  SET etapa_instalaciones = p_nueva_etapa,
      etapa_instalaciones_fecha_inicio = now()
  WHERE id = p_id_orden;
  
  -- Registrar el nuevo cambio de etapa
  INSERT INTO public.historial_etapas_instalaciones (
    id_orden,
    etapa_anterior,
    etapa_nueva,
    id_usuario,
    nombre_usuario,
    fecha_cambio,
    fecha_inicio_etapa
  ) VALUES (
    p_id_orden,
    etapa_anterior_val,
    p_nueva_etapa,
    usuario_actual_id,
    p_nombre_usuario,
    now(),
    now()
  );
END;
$$;

-- Función para actualizar etapa de Taller de Imprenta
CREATE OR REPLACE FUNCTION public.actualizar_etapa_taller_imprenta(
  p_id_orden integer,
  p_nueva_etapa varchar(100),
  p_nombre_usuario varchar(255)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  etapa_anterior_val varchar(100);
  fecha_inicio_anterior timestamptz;
  tiempo_segundos integer;
  usuario_actual_id integer;
BEGIN
  -- Obtener etapa anterior
  SELECT etapa_taller_imprenta INTO etapa_anterior_val
  FROM public.ordenes_trabajo
  WHERE id = p_id_orden;

  -- Obtener ID del usuario
  SELECT id INTO usuario_actual_id
  FROM public.usuarios
  WHERE nombre = p_nombre_usuario
  LIMIT 1;

  -- Si hay una etapa anterior, cerrar su registro y calcular tiempo
  IF etapa_anterior_val IS NOT NULL AND etapa_anterior_val != '' THEN
    -- Obtener fecha de inicio de la etapa anterior
    SELECT fecha_inicio_etapa INTO fecha_inicio_anterior
    FROM public.historial_etapas_taller_imprenta
    WHERE id_orden = p_id_orden
      AND etapa_nueva = etapa_anterior_val
      AND fecha_fin_etapa IS NULL
    ORDER BY fecha_cambio DESC
    LIMIT 1;
    
    -- Si no se encontró fecha_inicio, usar la fecha de cambio más reciente
    IF fecha_inicio_anterior IS NULL THEN
      SELECT etapa_taller_imprenta_fecha_inicio INTO fecha_inicio_anterior
      FROM public.ordenes_trabajo
      WHERE id = p_id_orden;
      
      IF fecha_inicio_anterior IS NULL THEN
        fecha_inicio_anterior := now();
      END IF;
    END IF;
    
    -- Calcular tiempo en segundos
    tiempo_segundos := EXTRACT(EPOCH FROM (now() - fecha_inicio_anterior))::integer;
    
    -- Cerrar el registro de la etapa anterior
    UPDATE public.historial_etapas_taller_imprenta
    SET fecha_fin_etapa = now(),
        tiempo_en_etapa_seg = tiempo_segundos
    WHERE id_orden = p_id_orden
      AND etapa_nueva = etapa_anterior_val
      AND fecha_fin_etapa IS NULL;
  END IF;
  
  -- Actualizar la orden
  UPDATE public.ordenes_trabajo
  SET etapa_taller_imprenta = p_nueva_etapa,
      etapa_taller_imprenta_fecha_inicio = now()
  WHERE id = p_id_orden;
  
  -- Registrar el nuevo cambio de etapa
  INSERT INTO public.historial_etapas_taller_imprenta (
    id_orden,
    etapa_anterior,
    etapa_nueva,
    id_usuario,
    nombre_usuario,
    fecha_cambio,
    fecha_inicio_etapa
  ) VALUES (
    p_id_orden,
    etapa_anterior_val,
    p_nueva_etapa,
    usuario_actual_id,
    p_nombre_usuario,
    now(),
    now()
  );
END;
$$;

COMMIT;

