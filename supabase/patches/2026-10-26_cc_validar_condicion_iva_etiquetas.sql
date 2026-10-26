-- La ficha CC a veces guarda la etiqueta ("Responsable Inscripto") y no el código
-- (responsable_inscripto). Una cuenta aprobada quedaba bloqueada para vender a cuenta.

CREATE OR REPLACE FUNCTION public._cc_validar_condicion_iva(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalizar_condicion_iva_cliente(p) IS NOT NULL;
$$;

UPDATE public.clientes_cuenta_corriente
SET condicion_iva = CASE lower(trim(regexp_replace(COALESCE(condicion_iva, ''), '[_]+', ' ', 'g')))
  WHEN 'responsable inscripto' THEN 'responsable_inscripto'
  WHEN 'iva responsable inscripto' THEN 'responsable_inscripto'
  WHEN 'monotributo' THEN 'monotributo'
  WHEN 'monotributista' THEN 'monotributo'
  WHEN 'responsable monotributo' THEN 'monotributo'
  WHEN 'exento' THEN 'exento'
  WHEN 'iva sujeto exento' THEN 'exento'
  WHEN 'iva exento' THEN 'exento'
  WHEN 'no responsable' THEN 'no_responsable'
  WHEN 'consumidor final' THEN 'consumidor_final'
  ELSE condicion_iva
END
WHERE public.normalizar_condicion_iva_cliente(condicion_iva) IS NOT NULL
  AND condicion_iva NOT IN ('responsable_inscripto', 'monotributo', 'exento', 'no_responsable', 'consumidor_final');
