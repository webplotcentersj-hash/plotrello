-- ============================================
-- SISTEMA DE AUDITORÍA PROFESIONAL
-- Trazabilidad completa y confiable para decisiones críticas
-- ============================================

BEGIN;

-- ============================================
-- 1. MEJORAR TABLA DE HISTORIAL
-- ============================================

-- Agregar campos adicionales para auditoría completa
ALTER TABLE public.historial_movimientos
ADD COLUMN IF NOT EXISTS ip_address varchar(45),
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS accion_tipo varchar(50) DEFAULT 'actualizacion',
ADD COLUMN IF NOT EXISTS cambios_detallados jsonb,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Crear índice para búsquedas rápidas por usuario y fecha
CREATE INDEX IF NOT EXISTS idx_historial_usuario_fecha 
ON public.historial_movimientos(id_usuario, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_historial_orden_fecha 
ON public.historial_movimientos(id_orden, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_historial_tipo_accion 
ON public.historial_movimientos(accion_tipo, timestamp DESC);

-- ============================================
-- 2. FUNCIÓN MEJORADA PARA REGISTRAR CAMBIOS
-- ============================================

CREATE OR REPLACE FUNCTION public.registrar_historial_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  usuario_actual_id integer;
  usuario_actual_nombre varchar(255);
  estado_anterior_val varchar(50);
  estado_nuevo_val varchar(50);
  operario_anterior_val varchar(255);
  operario_nuevo_val varchar(255);
  sector_anterior_val varchar(100);
  sector_nuevo_val varchar(100);
  prioridad_anterior_val varchar(20);
  prioridad_nueva_val varchar(20);
  comentario_historial text;
  cambios_detallados_json jsonb := '{}'::jsonb;
  hay_cambio_importante boolean := false;
  accion_tipo_val varchar(50) := 'actualizacion';
BEGIN
  -- Obtener información del usuario actual desde el contexto de sesión
  BEGIN
    usuario_actual_nombre := current_setting('app.current_user_name', true);
    usuario_actual_id := NULLIF(current_setting('app.current_user_id', true), '')::integer;
  EXCEPTION WHEN OTHERS THEN
    usuario_actual_nombre := NULL;
    usuario_actual_id := NULL;
  END;
  
  -- Si no hay usuario en el contexto, intentar obtener desde operario_asignado o usuario_trabajando_nombre
  IF usuario_actual_nombre IS NULL OR usuario_actual_nombre = '' THEN
    usuario_actual_nombre := COALESCE(
      NULLIF(trim(NEW.operario_asignado), ''),
      NULLIF(trim(NEW.usuario_trabajando_nombre), ''),
      NULLIF(trim(NEW.nombre_creador), ''),
      'Sistema'
    );
  END IF;
  
  -- Intentar obtener ID del usuario si no se tiene
  IF usuario_actual_id IS NULL AND usuario_actual_nombre IS NOT NULL AND usuario_actual_nombre != 'Sistema' THEN
    SELECT id INTO usuario_actual_id
    FROM public.usuarios
    WHERE nombre = usuario_actual_nombre
    LIMIT 1;
  END IF;
  
  -- Si no se encontró ID, buscar un usuario por defecto
  IF usuario_actual_id IS NULL THEN
    SELECT id INTO usuario_actual_id
    FROM public.usuarios
    ORDER BY id
    LIMIT 1;
    
    -- Si aún no hay usuario, no podemos insertar (la FK lo requiere)
    IF usuario_actual_id IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  -- Obtener valores anteriores y nuevos
  estado_anterior_val := OLD.estado;
  estado_nuevo_val := NEW.estado;
  operario_anterior_val := COALESCE(OLD.operario_asignado, '');
  operario_nuevo_val := COALESCE(NEW.operario_asignado, '');
  sector_anterior_val := COALESCE(OLD.sector, '');
  sector_nuevo_val := COALESCE(NEW.sector, '');
  prioridad_anterior_val := COALESCE(OLD.prioridad, '');
  prioridad_nueva_val := COALESCE(NEW.prioridad, '');
  
  -- Construir comentario descriptivo y JSON detallado
  comentario_historial := '';
  
  -- Verificar cambios de estado
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    hay_cambio_importante := true;
    accion_tipo_val := 'cambio_estado';
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Estado: ' || COALESCE(OLD.estado, 'N/A') || ' → ' || COALESCE(NEW.estado, 'N/A');
    cambios_detallados_json := cambios_detallados_json || jsonb_build_object(
      'estado', jsonb_build_object(
        'anterior', OLD.estado,
        'nuevo', NEW.estado
      )
    );
  END IF;
  
  -- Verificar cambios de operario (usuario asignado)
  IF trim(COALESCE(OLD.operario_asignado, '')) IS DISTINCT FROM trim(COALESCE(NEW.operario_asignado, '')) THEN
    hay_cambio_importante := true;
    IF accion_tipo_val = 'actualizacion' THEN
      accion_tipo_val := 'cambio_operario';
    END IF;
    
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    
    IF NEW.operario_asignado IS NULL OR trim(NEW.operario_asignado) = '' THEN
      comentario_historial := comentario_historial || 'Operario desasignado';
    ELSIF OLD.operario_asignado IS NULL OR trim(OLD.operario_asignado) = '' THEN
      comentario_historial := comentario_historial || 'Operario asignado: ' || trim(NEW.operario_asignado);
    ELSE
      comentario_historial := comentario_historial || 'Operario: ' || trim(OLD.operario_asignado) || ' → ' || trim(NEW.operario_asignado);
    END IF;
    
    cambios_detallados_json := cambios_detallados_json || jsonb_build_object(
      'operario', jsonb_build_object(
        'anterior', OLD.operario_asignado,
        'nuevo', NEW.operario_asignado
      )
    );
    
    -- Si cambió el operario, actualizar el usuario del historial con el nuevo operario
    IF NEW.operario_asignado IS NOT NULL AND trim(NEW.operario_asignado) != '' THEN
      usuario_actual_nombre := trim(NEW.operario_asignado);
      -- Intentar obtener ID del nuevo operario
      SELECT id INTO usuario_actual_id
      FROM public.usuarios
      WHERE nombre = usuario_actual_nombre
      LIMIT 1;
      -- Si no se encuentra, usar el primero disponible
      IF usuario_actual_id IS NULL THEN
        SELECT id INTO usuario_actual_id
        FROM public.usuarios
        ORDER BY id
        LIMIT 1;
        IF usuario_actual_id IS NULL THEN
          RETURN NEW;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Verificar cambios de sector
  IF OLD.sector IS DISTINCT FROM NEW.sector THEN
    hay_cambio_importante := true;
    IF accion_tipo_val = 'actualizacion' THEN
      accion_tipo_val := 'cambio_sector';
    END IF;
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Sector: ' || COALESCE(OLD.sector, 'N/A') || ' → ' || COALESCE(NEW.sector, 'N/A');
    cambios_detallados_json := cambios_detallados_json || jsonb_build_object(
      'sector', jsonb_build_object(
        'anterior', OLD.sector,
        'nuevo', NEW.sector
      )
    );
  END IF;
  
  -- Verificar cambios de prioridad
  IF OLD.prioridad IS DISTINCT FROM NEW.prioridad THEN
    IF comentario_historial != '' THEN
      comentario_historial := comentario_historial || ' | ';
    END IF;
    comentario_historial := comentario_historial || 'Prioridad: ' || COALESCE(OLD.prioridad, 'N/A') || ' → ' || COALESCE(NEW.prioridad, 'N/A');
    cambios_detallados_json := cambios_detallados_json || jsonb_build_object(
      'prioridad', jsonb_build_object(
        'anterior', OLD.prioridad,
        'nuevo', NEW.prioridad
      )
    );
  END IF;
  
  -- Registrar SIEMPRE si hay un cambio importante (estado, operario o sector)
  -- O si hay cambios de prioridad (también importante para auditoría)
  IF hay_cambio_importante OR (OLD.prioridad IS DISTINCT FROM NEW.prioridad) THEN
    INSERT INTO public.historial_movimientos (
      id_orden,
      id_usuario,
      nombre_usuario,
      estado_anterior,
      estado_nuevo,
      timestamp,
      comentario,
      accion_tipo,
      cambios_detallados,
      metadata
    ) VALUES (
      NEW.id,
      usuario_actual_id,
      usuario_actual_nombre,
      estado_anterior_val,
      estado_nuevo_val,
      now(),
      CASE 
        WHEN comentario_historial != '' THEN comentario_historial
        ELSE 'Cambio registrado'
      END,
      accion_tipo_val,
      cambios_detallados_json,
      jsonb_build_object(
        'numero_op', NEW.numero_op,
        'cliente', NEW.cliente,
        'timestamp_preciso', extract(epoch from now()),
        'version_sistema', '2.0'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 3. REACTIVAR TRIGGER AUTOMÁTICO
-- ============================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_registrar_historial_movimiento ON public.ordenes_trabajo;

-- Crear trigger que se ejecuta después de cada UPDATE
CREATE TRIGGER trigger_registrar_historial_movimiento
  AFTER UPDATE ON public.ordenes_trabajo
  FOR EACH ROW
  WHEN (
    -- Registrar TODOS los cambios relevantes
    (OLD.estado IS DISTINCT FROM NEW.estado) OR
    (trim(COALESCE(OLD.operario_asignado, '')) IS DISTINCT FROM trim(COALESCE(NEW.operario_asignado, ''))) OR
    (OLD.sector IS DISTINCT FROM NEW.sector) OR
    (OLD.prioridad IS DISTINCT FROM NEW.prioridad)
  )
  EXECUTE FUNCTION public.registrar_historial_movimiento();

-- ============================================
-- 4. FUNCIÓN PARA REGISTRAR CAMBIOS MANUALMENTE (desde frontend)
-- ============================================

CREATE OR REPLACE FUNCTION public.registrar_cambio_manual(
  p_id_orden integer,
  p_id_usuario integer,
  p_nombre_usuario varchar(255),
  p_estado_anterior varchar(50),
  p_estado_nuevo varchar(50),
  p_comentario text,
  p_accion_tipo varchar(50) DEFAULT 'actualizacion',
  p_cambios_detallados jsonb DEFAULT '{}'::jsonb,
  p_ip_address varchar(45) DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.historial_movimientos (
    id_orden,
    id_usuario,
    nombre_usuario,
    estado_anterior,
    estado_nuevo,
    timestamp,
    comentario,
    accion_tipo,
    cambios_detallados,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_id_orden,
    p_id_usuario,
    p_nombre_usuario,
    p_estado_anterior,
    p_estado_nuevo,
    now(),
    p_comentario,
    p_accion_tipo,
    p_cambios_detallados,
    p_ip_address,
    p_user_agent,
    jsonb_build_object(
      'registrado_manual', true,
      'timestamp_preciso', extract(epoch from now()),
      'version_sistema', '2.0'
    )
  );
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.registrar_cambio_manual TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_cambio_manual TO anon;

-- ============================================
-- 5. VISTA PARA AUDITORÍA COMPLETA
-- ============================================

CREATE OR REPLACE VIEW public.vista_auditoria_completa AS
SELECT 
  h.id,
  h.id_orden,
  o.numero_op,
  o.cliente,
  h.id_usuario,
  h.nombre_usuario,
  u.rol as rol_usuario,
  h.estado_anterior,
  h.estado_nuevo,
  h.comentario,
  h.accion_tipo,
  h.cambios_detallados,
  h.ip_address,
  h.user_agent,
  h.timestamp,
  h.metadata,
  EXTRACT(EPOCH FROM (now() - h.timestamp)) as segundos_desde_cambio
FROM public.historial_movimientos h
LEFT JOIN public.ordenes_trabajo o ON h.id_orden = o.id
LEFT JOIN public.usuarios u ON h.id_usuario = u.id
ORDER BY h.timestamp DESC;

-- Otorgar permisos a la vista
GRANT SELECT ON public.vista_auditoria_completa TO authenticated;
GRANT SELECT ON public.vista_auditoria_completa TO anon;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que el trigger está activo
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_registrar_historial_movimiento';

