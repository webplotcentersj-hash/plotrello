-- Tardanza automática: una sola novedad por empleado y día (entrada).
-- Limpia duplicados generados por el sync de asistencia y evita que vuelvan a crearse.

DELETE FROM public.rrhh_novedades a
USING public.rrhh_novedades b
WHERE a.codigo = 'tardanza'
  AND b.codigo = 'tardanza'
  AND a.id_usuario = b.id_usuario
  AND a.fecha_desde = b.fecha_desde
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rrhh_novedades_tardanza_usuario_dia
  ON public.rrhh_novedades (id_usuario, fecha_desde)
  WHERE codigo = 'tardanza';
