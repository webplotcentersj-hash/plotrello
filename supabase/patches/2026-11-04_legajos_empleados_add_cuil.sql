-- CUIT/CUIL en legajo para libro de sueldos / recibo
ALTER TABLE public.legajos_empleados
  ADD COLUMN IF NOT EXISTS cuil varchar(20);

COMMENT ON COLUMN public.legajos_empleados.cuil IS
  'CUIT o CUIL del empleado (11 dígitos); se usa en libro de sueldos y recibo.';

DROP FUNCTION IF EXISTS public.crear_actualizar_legajo(
  integer, character varying, character varying, character varying, text, text,
  character varying, text, date, date, character varying, text, character varying,
  character varying, character varying, character varying, text
);

CREATE OR REPLACE FUNCTION public.crear_actualizar_legajo(
  p_id_usuario integer,
  p_nombre character varying DEFAULT NULL,
  p_apellido character varying DEFAULT NULL,
  p_telefono character varying DEFAULT NULL,
  p_ubicacion text DEFAULT NULL,
  p_foto_url text DEFAULT NULL,
  p_sector character varying DEFAULT NULL,
  p_funciones text DEFAULT NULL,
  p_fecha_ingreso date DEFAULT NULL,
  p_fecha_nacimiento date DEFAULT NULL,
  p_dni character varying DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_email character varying DEFAULT NULL,
  p_estado_civil character varying DEFAULT NULL,
  p_contacto_emergencia_nombre character varying DEFAULT NULL,
  p_contacto_emergencia_telefono character varying DEFAULT NULL,
  p_observaciones text DEFAULT NULL,
  p_cuil character varying DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  id_usuario integer,
  nombre character varying,
  apellido character varying,
  telefono character varying,
  ubicacion text,
  foto_url text,
  sector character varying,
  funciones text,
  fecha_ingreso date,
  fecha_nacimiento date,
  dni character varying,
  direccion text,
  email character varying,
  estado_civil character varying,
  contacto_emergencia_nombre character varying,
  contacto_emergencia_telefono character varying,
  observaciones text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  cuil character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  legajo_id integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_id_usuario) THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id_usuario;
  END IF;

  UPDATE public.legajos_empleados l
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
    cuil = p_cuil,
    updated_at = now()
  WHERE l.id_usuario = p_id_usuario
  RETURNING l.id INTO legajo_id;

  IF NOT FOUND THEN
    INSERT INTO public.legajos_empleados (
      id_usuario, nombre, apellido, telefono, ubicacion, foto_url, sector, funciones,
      fecha_ingreso, fecha_nacimiento, dni, direccion, email, estado_civil,
      contacto_emergencia_nombre, contacto_emergencia_telefono, observaciones, cuil
    ) VALUES (
      p_id_usuario, p_nombre, p_apellido, p_telefono, p_ubicacion, p_foto_url, p_sector, p_funciones,
      p_fecha_ingreso, p_fecha_nacimiento, p_dni, p_direccion, p_email, p_estado_civil,
      p_contacto_emergencia_nombre, p_contacto_emergencia_telefono, p_observaciones, p_cuil
    )
    RETURNING legajos_empleados.id INTO legajo_id;
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.id_usuario, l.nombre, l.apellido, l.telefono, l.ubicacion, l.foto_url,
    l.sector, l.funciones, l.fecha_ingreso, l.fecha_nacimiento, l.dni, l.direccion,
    l.email, l.estado_civil, l.contacto_emergencia_nombre, l.contacto_emergencia_telefono,
    l.observaciones, l.created_at, l.updated_at, l.cuil
  FROM public.legajos_empleados l
  WHERE l.id = legajo_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.obtener_legajo_empleado(integer);

CREATE OR REPLACE FUNCTION public.obtener_legajo_empleado(p_id_usuario integer)
RETURNS TABLE (
  id integer,
  id_usuario integer,
  nombre character varying,
  apellido character varying,
  telefono character varying,
  ubicacion text,
  foto_url text,
  sector character varying,
  funciones text,
  fecha_ingreso date,
  fecha_nacimiento date,
  dni character varying,
  direccion text,
  email character varying,
  estado_civil character varying,
  contacto_emergencia_nombre character varying,
  contacto_emergencia_telefono character varying,
  observaciones text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  cuil character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.id_usuario, l.nombre, l.apellido, l.telefono, l.ubicacion, l.foto_url,
    l.sector, l.funciones, l.fecha_ingreso, l.fecha_nacimiento, l.dni, l.direccion,
    l.email, l.estado_civil, l.contacto_emergencia_nombre, l.contacto_emergencia_telefono,
    l.observaciones, l.created_at, l.updated_at, l.cuil
  FROM public.legajos_empleados l
  WHERE l.id_usuario = p_id_usuario
  LIMIT 1;
END;
$function$;
