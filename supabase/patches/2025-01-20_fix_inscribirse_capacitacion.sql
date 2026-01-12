-- Fix: Corregir función inscribirse_capacitacion
-- Ejecutar esto en la base de datos si hay problemas con las inscripciones

CREATE OR REPLACE FUNCTION public.inscribirse_capacitacion(
  p_id_capacitacion integer,
  p_id_usuario integer
)
RETURNS public.capacitaciones_inscripciones
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacitacion public.capacitaciones;
  v_cupos_disponibles integer;
  v_inscripcion_existente integer;
  v_result public.capacitaciones_inscripciones;
BEGIN
  -- Verificar que la capacitación existe
  SELECT * INTO v_capacitacion FROM public.capacitaciones WHERE id = p_id_capacitacion;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capacitación no encontrada';
  END IF;

  -- Verificar que la capacitación esté abierta o planificada
  IF v_capacitacion.estado NOT IN ('abierta', 'planificada', 'en_curso') THEN
    RAISE EXCEPTION 'La capacitación no está disponible para inscripciones';
  END IF;

  -- Verificar que no esté ya inscrito
  SELECT id INTO v_inscripcion_existente 
  FROM public.capacitaciones_inscripciones 
  WHERE id_capacitacion = p_id_capacitacion 
    AND id_usuario = p_id_usuario
    AND estado NOT IN ('cancelado', 'rechazado');
  
  IF v_inscripcion_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Ya estás inscrito en esta capacitación';
  END IF;

  -- Verificar cupos disponibles
  IF v_capacitacion.cupo_maximo IS NOT NULL THEN
    SELECT COUNT(*) INTO v_cupos_disponibles
    FROM public.capacitaciones_inscripciones
    WHERE id_capacitacion = p_id_capacitacion 
      AND estado IN ('inscrito', 'aprobado', 'completado');
    
    IF v_cupos_disponibles >= v_capacitacion.cupo_maximo THEN
      RAISE EXCEPTION 'No hay cupos disponibles';
    END IF;
  END IF;

  -- Verificar fecha límite
  IF v_capacitacion.fecha_limite_inscripcion IS NOT NULL 
     AND v_capacitacion.fecha_limite_inscripcion < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha límite de inscripción ha pasado';
  END IF;

  -- Crear inscripción
  INSERT INTO public.capacitaciones_inscripciones (
    id_capacitacion, id_usuario, estado
  )
  VALUES (
    p_id_capacitacion, p_id_usuario,
    CASE WHEN v_capacitacion.requiere_aprobacion THEN 'pendiente' ELSE 'inscrito' END
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

