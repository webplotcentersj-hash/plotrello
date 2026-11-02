-- Reactivar colaborador dado de baja (activo = true) + hito en hoja de vida
ALTER TABLE public.rrhh_eventos_laborales
  DROP CONSTRAINT IF EXISTS rrhh_eventos_laborales_tipo_check;

ALTER TABLE public.rrhh_eventos_laborales
  ADD CONSTRAINT rrhh_eventos_laborales_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'cambio_puesto'::text,
    'reconocimiento'::text,
    'sancion'::text,
    'reactivacion'::text
  ]));

CREATE OR REPLACE FUNCTION public.reactivar_usuario(
  p_id integer,
  p_registrado_por integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usuario_existente record;
BEGIN
  IF p_id IS NULL OR p_id <= 0 THEN
    RAISE EXCEPTION 'ID de usuario inválido';
  END IF;

  SELECT * INTO usuario_existente
  FROM public.usuarios
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_id;
  END IF;

  IF COALESCE(usuario_existente.activo, true) = true THEN
    RAISE EXCEPTION 'El colaborador ya está activo';
  END IF;

  UPDATE public.usuarios
  SET activo = true
  WHERE id = p_id;

  INSERT INTO public.rrhh_eventos_laborales (
    id_usuario,
    tipo,
    fecha,
    titulo,
    descripcion,
    registrado_por
  ) VALUES (
    p_id,
    'reactivacion',
    CURRENT_DATE,
    'Reactivación laboral',
    'El colaborador volvió a figurar como personal activo.',
    p_registrado_por
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivar_usuario(integer, integer) TO anon, authenticated, service_role;

COMMENT ON COLUMN public.rrhh_eventos_laborales.tipo IS
  'cambio_puesto | reconocimiento | sancion | reactivacion';
