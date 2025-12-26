-- Corregir función crear_actualizar_legajo para que guarde todos los campos correctamente
-- Asegura que los valores vacíos se guarden como NULL en lugar de mantener valores anteriores

CREATE OR REPLACE FUNCTION public.crear_actualizar_legajo(
  p_id_usuario integer,
  p_nombre varchar DEFAULT NULL,
  p_apellido varchar DEFAULT NULL,
  p_telefono varchar DEFAULT NULL,
  p_ubicacion text DEFAULT NULL,
  p_foto_url text DEFAULT NULL,
  p_sector varchar DEFAULT NULL,
  p_funciones text DEFAULT NULL,
  p_fecha_ingreso date DEFAULT NULL,
  p_fecha_nacimiento date DEFAULT NULL,
  p_dni varchar DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_email varchar DEFAULT NULL,
  p_estado_civil varchar DEFAULT NULL,
  p_contacto_emergencia_nombre varchar DEFAULT NULL,
  p_contacto_emergencia_telefono varchar DEFAULT NULL,
  p_observaciones text DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  id_usuario integer,
  nombre varchar,
  apellido varchar,
  telefono varchar,
  ubicacion text,
  foto_url text,
  sector varchar,
  funciones text,
  fecha_ingreso date,
  fecha_nacimiento date,
  dni varchar,
  direccion text,
  email varchar,
  estado_civil varchar,
  contacto_emergencia_nombre varchar,
  contacto_emergencia_telefono varchar,
  observaciones text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  legajo_id integer;
BEGIN
  -- Verificar que el usuario existe
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = p_id_usuario) THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id_usuario;
  END IF;

  -- Intentar actualizar si existe
  UPDATE public.legajos_empleados
  SET
    nombre = p_nombre,
    apellido = p_apellido,
    telefono = p_telefono,
    ubicacion = p_ubicacion,
    foto_url = p_foto_url,
    sector = p_sector,
    funciones = p_funciones,
    fecha_ingreso = p_fecha_ingreso,
    fecha_nacimiento = p_fecha_nacimiento,
    dni = p_dni,
    direccion = p_direccion,
    email = p_email,
    estado_civil = p_estado_civil,
    contacto_emergencia_nombre = p_contacto_emergencia_nombre,
    contacto_emergencia_telefono = p_contacto_emergencia_telefono,
    observaciones = p_observaciones,
    updated_at = now()
  WHERE id_usuario = p_id_usuario
  RETURNING id INTO legajo_id;

  -- Si no existe, crear nuevo legajo
  IF NOT FOUND THEN
    INSERT INTO public.legajos_empleados (
      id_usuario,
      nombre,
      apellido,
      telefono,
      ubicacion,
      foto_url,
      sector,
      funciones,
      fecha_ingreso,
      fecha_nacimiento,
      dni,
      direccion,
      email,
      estado_civil,
      contacto_emergencia_nombre,
      contacto_emergencia_telefono,
      observaciones
    ) VALUES (
      p_id_usuario,
      p_nombre,
      p_apellido,
      p_telefono,
      p_ubicacion,
      p_foto_url,
      p_sector,
      p_funciones,
      p_fecha_ingreso,
      p_fecha_nacimiento,
      p_dni,
      p_direccion,
      p_email,
      p_estado_civil,
      p_contacto_emergencia_nombre,
      p_contacto_emergencia_telefono,
      p_observaciones
    )
    RETURNING id INTO legajo_id;
  END IF;

  -- Retornar todos los datos actualizados
  RETURN QUERY
  SELECT
    l.id,
    l.id_usuario,
    l.nombre,
    l.apellido,
    l.telefono,
    l.ubicacion,
    l.foto_url,
    l.sector,
    l.funciones,
    l.fecha_ingreso,
    l.fecha_nacimiento,
    l.dni,
    l.direccion,
    l.email,
    l.estado_civil,
    l.contacto_emergencia_nombre,
    l.contacto_emergencia_telefono,
    l.observaciones,
    l.created_at,
    l.updated_at
  FROM public.legajos_empleados l
  WHERE l.id = legajo_id;
END;
$$;

