-- Plan de cuentas: estructura estándar argentina (rubros RT 9 FACPCE) y corrección de cuentas mal ubicadas.
--
-- Problemas del plan inicial (2025-01-23):
--   1.1.1.03 Clientes            estaba dentro de "Caja y Bancos"      → 1.1.3.01 Deudores por ventas
--   1.1.2.01 IVA Débito Fiscal   estaba dentro del ACTIVO (Créditos)   → 2.1.3.01 (Pasivo · Deudas fiscales)
--   2.1.2.01 IVA Crédito Fiscal  estaba dentro del PASIVO              → 1.1.4.01 (Activo · Otros créditos)
--   Gastos sin subcuentas imputables; faltaban bienes de uso, deudas fiscales, remuneraciones,
--   resultados acumulados, percepciones y retenciones, etc.
--
-- Cómo se hace sin romper nada:
--   * Las cuentas se MUEVEN (cambia el código, no el id): los asientos ya registrados siguen apuntando
--     a la misma cuenta. Solo se mueven si el nombre coincide con el esperado y el código destino está libre.
--   * Las funciones que buscaban esas cuentas por código (asientos automáticos de facturas, notas de
--     crédito y cobros) se reescriben con los códigos nuevos.
--   * Se agrega plan_cuentas.clave_sistema: identifica las cuentas que usa cada proceso automático.
--   * Las cuentas nuevas se agregan con ON CONFLICT DO NOTHING: no pisa cuentas propias ya cargadas.
--   * Al final se recalculan nivel y cuenta_padre_id desde el código.
-- Idempotente: se puede ejecutar más de una vez.

BEGIN;

ALTER TABLE public.plan_cuentas ADD COLUMN IF NOT EXISTS clave_sistema text;
CREATE UNIQUE INDEX IF NOT EXISTS plan_cuentas_clave_sistema_uidx ON public.plan_cuentas (clave_sistema) WHERE clave_sistema IS NOT NULL;
ALTER TABLE public.plan_cuentas ADD COLUMN IF NOT EXISTS descripcion text;

-- 1) Mover las cuentas mal ubicadas ---------------------------------------------------
-- Las que se mueven en ESTA ejecución quedan anotadas: solo para ellas se reescriben funciones.
CREATE TEMP TABLE _plan_movidas (viejo text PRIMARY KEY, nuevo text NOT NULL) ON COMMIT DROP;

DO $$
DECLARE
  m record;
  v_id integer;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('1.1.1.03', '1.1.3.01', 'Deudores por ventas', 'Activo', 'Deudora', '(Clientes|Deudores)'),
      ('1.1.2.01', '2.1.3.01', 'IVA Débito Fiscal', 'Pasivo', 'Acreedora', 'IVA D.bito'),
      ('2.1.2.01', '1.1.4.01', 'IVA Crédito Fiscal', 'Activo', 'Deudora', 'IVA Cr.dito')
    ) AS t(viejo, nuevo, nombre, tipo, naturaleza, patron)
  LOOP
    SELECT id INTO v_id FROM public.plan_cuentas WHERE codigo = m.viejo AND nombre ~* m.patron;
    IF v_id IS NULL THEN
      CONTINUE; -- ya movida o personalizada
    END IF;
    IF EXISTS (SELECT 1 FROM public.plan_cuentas WHERE codigo = m.nuevo) THEN
      RAISE NOTICE 'No se movió % → %: el código destino ya existe', m.viejo, m.nuevo;
      CONTINUE;
    END IF;
    UPDATE public.plan_cuentas
    SET codigo = 'TMP-' || m.nuevo, updated_at = now()
    WHERE id = v_id;
    INSERT INTO _plan_movidas (viejo, nuevo) VALUES (m.viejo, m.nuevo);
  END LOOP;

  UPDATE public.plan_cuentas pc
  SET codigo = substr(pc.codigo, 5),
      nombre = t.nombre,
      tipo = t.tipo,
      naturaleza = t.naturaleza,
      updated_at = now()
  FROM (VALUES
    ('1.1.3.01', 'Deudores por ventas', 'Activo', 'Deudora'),
    ('2.1.3.01', 'IVA Débito Fiscal', 'Pasivo', 'Acreedora'),
    ('1.1.4.01', 'IVA Crédito Fiscal', 'Activo', 'Deudora')
  ) AS t(codigo, nombre, tipo, naturaleza)
  WHERE pc.codigo = 'TMP-' || t.codigo;
END $$;

-- 2) Funciones automáticas: códigos nuevos ------------------------------------------
-- Solo para las cuentas movidas en esta ejecución (re-ejecutar el patch no toca nada).
DO $$
DECLARE
  f record;
  v_def text;
  v_nuevo text;
  v_mover_clientes boolean := EXISTS (SELECT 1 FROM _plan_movidas WHERE viejo = '1.1.1.03');
  v_mover_debito boolean := EXISTS (SELECT 1 FROM _plan_movidas WHERE viejo = '1.1.2.01');
  v_mover_credito boolean := EXISTS (SELECT 1 FROM _plan_movidas WHERE viejo = '2.1.2.01');
BEGIN
  IF NOT (v_mover_clientes OR v_mover_debito OR v_mover_credito) THEN
    RETURN;
  END IF;
  FOR f IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.prosrc LIKE '%1.1.1.03%' OR p.prosrc LIKE '%1.1.2.01%' OR p.prosrc LIKE '%2.1.2.01%')
  LOOP
    v_def := pg_get_functiondef(f.oid);
    v_nuevo := v_def;
    IF v_mover_clientes THEN v_nuevo := replace(v_nuevo, '1.1.1.03', '@@CLI@@'); END IF;
    IF v_mover_debito THEN v_nuevo := replace(v_nuevo, '1.1.2.01', '@@DEB@@'); END IF;
    IF v_mover_credito THEN v_nuevo := replace(v_nuevo, '2.1.2.01', '@@CRE@@'); END IF;
    v_nuevo := replace(replace(replace(v_nuevo, '@@CLI@@', '1.1.3.01'), '@@DEB@@', '2.1.3.01'), '@@CRE@@', '1.1.4.01');
    IF v_nuevo <> v_def THEN
      EXECUTE v_nuevo;
    END IF;
  END LOOP;
END $$;

-- 3) Rubros: nombres del plan inicial → nombres estándar --------------------------------
UPDATE public.plan_cuentas SET nombre = 'PATRIMONIO NETO', updated_at = now() WHERE codigo = '3' AND nombre = 'PATRIMONIO';
UPDATE public.plan_cuentas SET nombre = 'Inversiones', updated_at = now() WHERE codigo = '1.1.2' AND nombre = 'Créditos';
UPDATE public.plan_cuentas SET nombre = 'Deudas bancarias y financieras', updated_at = now() WHERE codigo = '2.1.2' AND nombre = 'Obligaciones Fiscales';
UPDATE public.plan_cuentas SET nombre = 'Deudas comerciales', updated_at = now() WHERE codigo = '2.1.1' AND nombre = 'Proveedores';
UPDATE public.plan_cuentas SET nombre = 'Aportes de los propietarios', updated_at = now() WHERE codigo = '3.1' AND nombre = 'Capital';
UPDATE public.plan_cuentas SET nombre = 'Capital suscripto', updated_at = now() WHERE codigo = '3.1.1' AND nombre = 'Capital Social';
UPDATE public.plan_cuentas SET nombre = 'Ventas', updated_at = now() WHERE codigo = '4.1.1' AND nombre = 'Ventas de Productos';
UPDATE public.plan_cuentas SET nombre = 'Ventas de productos', updated_at = now() WHERE codigo = '4.1.1.01' AND nombre = 'Ventas de Productos';
UPDATE public.plan_cuentas SET nombre = 'Costo de mercaderías vendidas', updated_at = now() WHERE codigo = '5.1.1.01' AND nombre = 'Costo de Productos Vendidos';
UPDATE public.plan_cuentas SET nombre = 'Costo de ventas', updated_at = now() WHERE codigo = '5.1.1' AND nombre = 'Costo de Productos Vendidos';
UPDATE public.plan_cuentas SET nombre = 'Bancos cuenta corriente', updated_at = now() WHERE codigo = '1.1.1.02' AND nombre = 'Bancos Cta. Cte.';

-- 4) Estructura completa (no pisa cuentas existentes) ---------------------------------
INSERT INTO public.plan_cuentas (codigo, nombre, tipo, nivel, naturaleza, activa, descripcion) VALUES
-- ACTIVO
('1', 'ACTIVO', 'Activo', 1, 'Deudora', true, NULL),
('1.1', 'Activo corriente', 'Activo', 2, 'Deudora', true, NULL),
('1.1.1', 'Caja y bancos', 'Activo', 3, 'Deudora', true, NULL),
('1.1.1.01', 'Caja', 'Activo', 4, 'Deudora', true, 'Efectivo de las cajas del local'),
('1.1.1.02', 'Bancos cuenta corriente', 'Activo', 4, 'Deudora', true, NULL),
('1.1.1.03', 'Mercado Pago y billeteras virtuales', 'Activo', 4, 'Deudora', true, 'Saldos en Mercado Pago u otras billeteras'),
('1.1.1.04', 'Valores a depositar', 'Activo', 4, 'Deudora', true, 'Cheques y echeqs de terceros en cartera'),
('1.1.2', 'Inversiones', 'Activo', 3, 'Deudora', true, NULL),
('1.1.2.02', 'Plazos fijos', 'Activo', 4, 'Deudora', true, NULL),
('1.1.3', 'Créditos por ventas', 'Activo', 3, 'Deudora', true, NULL),
('1.1.3.01', 'Deudores por ventas', 'Activo', 4, 'Deudora', true, 'Clientes con saldo a cobrar'),
('1.1.3.02', 'Documentos a cobrar', 'Activo', 4, 'Deudora', true, NULL),
('1.1.3.03', 'Tarjetas de crédito a cobrar', 'Activo', 4, 'Deudora', true, 'Cupones pendientes de acreditación'),
('1.1.3.09', 'Previsión para deudores incobrables', 'Activo', 4, 'Acreedora', true, 'Regularizadora de Créditos por ventas'),
('1.1.4', 'Otros créditos', 'Activo', 3, 'Deudora', true, NULL),
('1.1.4.01', 'IVA Crédito Fiscal', 'Activo', 4, 'Deudora', true, 'IVA de las compras'),
('1.1.4.02', 'IVA saldo a favor', 'Activo', 4, 'Deudora', true, 'Saldo técnico y de libre disponibilidad'),
('1.1.4.03', 'Percepciones de IVA sufridas', 'Activo', 4, 'Deudora', true, NULL),
('1.1.4.04', 'Retenciones de IVA sufridas', 'Activo', 4, 'Deudora', true, NULL),
('1.1.4.05', 'Retenciones y percepciones de Ingresos Brutos', 'Activo', 4, 'Deudora', true, 'Incluye SIRCREB'),
('1.1.4.06', 'Retenciones de Ganancias sufridas', 'Activo', 4, 'Deudora', true, NULL),
('1.1.4.07', 'Anticipos a proveedores', 'Activo', 4, 'Deudora', true, NULL),
('1.1.5', 'Bienes de cambio', 'Activo', 3, 'Deudora', true, NULL),
('1.1.5.01', 'Materias primas e insumos', 'Activo', 4, 'Deudora', true, 'Vinilos, lonas, tintas, sustratos'),
('1.1.5.02', 'Mercaderías de reventa', 'Activo', 4, 'Deudora', true, NULL),
('1.1.5.03', 'Trabajos en proceso', 'Activo', 4, 'Deudora', true, 'Órdenes de trabajo sin terminar'),
('1.2', 'Activo no corriente', 'Activo', 2, 'Deudora', true, NULL),
('1.2.1', 'Bienes de uso', 'Activo', 3, 'Deudora', true, NULL),
('1.2.1.01', 'Maquinarias e impresoras', 'Activo', 4, 'Deudora', true, 'Plotters, impresoras, laminadoras, router'),
('1.2.1.02', 'Rodados', 'Activo', 4, 'Deudora', true, NULL),
('1.2.1.03', 'Muebles y útiles', 'Activo', 4, 'Deudora', true, NULL),
('1.2.1.04', 'Equipos de computación', 'Activo', 4, 'Deudora', true, NULL),
('1.2.1.05', 'Instalaciones', 'Activo', 4, 'Deudora', true, NULL),
('1.2.1.09', 'Amortización acumulada bienes de uso', 'Activo', 4, 'Acreedora', true, 'Regularizadora de Bienes de uso'),
('1.2.2', 'Activos intangibles', 'Activo', 3, 'Deudora', true, NULL),
('1.2.2.01', 'Software y licencias', 'Activo', 4, 'Deudora', true, NULL),
-- PASIVO
('2', 'PASIVO', 'Pasivo', 1, 'Acreedora', true, NULL),
('2.1', 'Pasivo corriente', 'Pasivo', 2, 'Acreedora', true, NULL),
('2.1.1', 'Deudas comerciales', 'Pasivo', 3, 'Acreedora', true, NULL),
('2.1.1.01', 'Proveedores', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.1.1.02', 'Cheques diferidos emitidos', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.1.2', 'Deudas bancarias y financieras', 'Pasivo', 3, 'Acreedora', true, NULL),
('2.1.2.02', 'Préstamos bancarios', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.1.2.03', 'Tarjetas de crédito a pagar', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.1.3', 'Deudas fiscales', 'Pasivo', 3, 'Acreedora', true, NULL),
('2.1.3.01', 'IVA Débito Fiscal', 'Pasivo', 4, 'Acreedora', true, 'IVA de las ventas'),
('2.1.3.02', 'IVA a pagar', 'Pasivo', 4, 'Acreedora', true, 'Saldo de la declaración jurada mensual'),
('2.1.3.03', 'Ingresos Brutos a pagar', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.1.3.04', 'Impuesto a las Ganancias a pagar', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.1.3.05', 'Retenciones y percepciones a depositar', 'Pasivo', 4, 'Acreedora', true, 'Solo si la empresa es agente'),
('2.1.4', 'Remuneraciones y cargas sociales', 'Pasivo', 3, 'Acreedora', true, NULL),
('2.1.4.01', 'Sueldos a pagar', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.1.4.02', 'Cargas sociales a pagar', 'Pasivo', 4, 'Acreedora', true, 'F.931'),
('2.1.4.03', 'Comisiones a pagar', 'Pasivo', 4, 'Acreedora', true, 'Liquidaciones de comisiones aprobadas'),
('2.1.5', 'Anticipos de clientes', 'Pasivo', 3, 'Acreedora', true, NULL),
('2.1.5.01', 'Señas y anticipos de clientes', 'Pasivo', 4, 'Acreedora', true, NULL),
('2.2', 'Pasivo no corriente', 'Pasivo', 2, 'Acreedora', true, NULL),
('2.2.1', 'Deudas financieras a largo plazo', 'Pasivo', 3, 'Acreedora', true, NULL),
('2.2.1.01', 'Préstamos a largo plazo', 'Pasivo', 4, 'Acreedora', true, NULL),
-- PATRIMONIO NETO
('3', 'PATRIMONIO NETO', 'Patrimonio', 1, 'Acreedora', true, NULL),
('3.1', 'Aportes de los propietarios', 'Patrimonio', 2, 'Acreedora', true, NULL),
('3.1.1', 'Capital suscripto', 'Patrimonio', 3, 'Acreedora', true, NULL),
('3.1.1.01', 'Capital social', 'Patrimonio', 4, 'Acreedora', true, NULL),
('3.1.2', 'Ajustes al patrimonio', 'Patrimonio', 3, 'Acreedora', true, NULL),
('3.1.2.01', 'Ajuste de capital', 'Patrimonio', 4, 'Acreedora', true, 'Reexpresión por inflación (RT 6)'),
('3.2', 'Resultados acumulados', 'Patrimonio', 2, 'Acreedora', true, NULL),
('3.2.1', 'Reservas', 'Patrimonio', 3, 'Acreedora', true, NULL),
('3.2.1.01', 'Reserva legal', 'Patrimonio', 4, 'Acreedora', true, NULL),
('3.2.2', 'Resultados no asignados', 'Patrimonio', 3, 'Acreedora', true, NULL),
('3.2.2.01', 'Resultados no asignados', 'Patrimonio', 4, 'Acreedora', true, NULL),
('3.2.2.02', 'Resultado del ejercicio', 'Patrimonio', 4, 'Acreedora', true, 'Se usa en el asiento de cierre'),
-- INGRESOS
('4', 'INGRESOS', 'Ingreso', 1, 'Acreedora', true, NULL),
('4.1', 'Ingresos por ventas', 'Ingreso', 2, 'Acreedora', true, NULL),
('4.1.1', 'Ventas', 'Ingreso', 3, 'Acreedora', true, NULL),
('4.1.1.01', 'Ventas de productos', 'Ingreso', 4, 'Acreedora', true, 'Cartelería, impresiones, ploteos'),
('4.1.1.02', 'Ventas de servicios', 'Ingreso', 4, 'Acreedora', true, 'Diseño, instalación, colocación'),
('4.1.1.09', 'Descuentos y bonificaciones otorgados', 'Ingreso', 4, 'Deudora', true, 'Regularizadora de Ventas'),
('4.2', 'Otros ingresos', 'Ingreso', 2, 'Acreedora', true, NULL),
('4.2.1', 'Resultados financieros positivos', 'Ingreso', 3, 'Acreedora', true, NULL),
('4.2.1.01', 'Intereses ganados', 'Ingreso', 4, 'Acreedora', true, NULL),
('4.2.1.02', 'Diferencias de cambio positivas', 'Ingreso', 4, 'Acreedora', true, NULL),
('4.2.2', 'Ingresos varios', 'Ingreso', 3, 'Acreedora', true, NULL),
('4.2.2.01', 'Recupero de gastos', 'Ingreso', 4, 'Acreedora', true, NULL),
-- COSTOS
('5', 'COSTOS', 'Costo', 1, 'Deudora', true, NULL),
('5.1', 'Costo de ventas', 'Costo', 2, 'Deudora', true, NULL),
('5.1.1', 'Costo de ventas', 'Costo', 3, 'Deudora', true, NULL),
('5.1.1.01', 'Costo de mercaderías vendidas', 'Costo', 4, 'Deudora', true, NULL),
('5.1.1.02', 'Materiales e insumos de producción', 'Costo', 4, 'Deudora', true, NULL),
('5.1.1.03', 'Mano de obra directa', 'Costo', 4, 'Deudora', true, NULL),
('5.1.1.04', 'Trabajos tercerizados', 'Costo', 4, 'Deudora', true, 'Talleres externos, instaladores'),
-- GASTOS
('6', 'GASTOS', 'Gasto', 1, 'Deudora', true, NULL),
('6.1', 'Gastos de administración', 'Gasto', 2, 'Deudora', true, NULL),
('6.1.1', 'Sueldos y cargas sociales', 'Gasto', 3, 'Deudora', true, NULL),
('6.1.1.01', 'Sueldos y jornales', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.1.02', 'Cargas sociales', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.2', 'Alquileres', 'Gasto', 3, 'Deudora', true, NULL),
('6.1.2.01', 'Alquiler del local', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.3', 'Servicios', 'Gasto', 3, 'Deudora', true, NULL),
('6.1.3.01', 'Energía eléctrica', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.3.02', 'Internet y telefonía', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.3.03', 'Agua y gas', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.4', 'Honorarios profesionales', 'Gasto', 3, 'Deudora', true, NULL),
('6.1.4.01', 'Honorarios contables y legales', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.5', 'Seguros', 'Gasto', 3, 'Deudora', true, NULL),
('6.1.5.01', 'Seguros', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.6', 'Gastos generales', 'Gasto', 3, 'Deudora', true, NULL),
('6.1.6.01', 'Librería, limpieza y varios', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.6.02', 'Mantenimiento y reparaciones', 'Gasto', 4, 'Deudora', true, NULL),
('6.1.7', 'Amortizaciones', 'Gasto', 3, 'Deudora', true, NULL),
('6.1.7.01', 'Amortización de bienes de uso', 'Gasto', 4, 'Deudora', true, NULL),
('6.2', 'Gastos de comercialización', 'Gasto', 2, 'Deudora', true, NULL),
('6.2.1', 'Comisiones', 'Gasto', 3, 'Deudora', true, NULL),
('6.2.1.01', 'Comisiones a vendedores', 'Gasto', 4, 'Deudora', true, NULL),
('6.2.2', 'Publicidad', 'Gasto', 3, 'Deudora', true, NULL),
('6.2.2.01', 'Publicidad y marketing', 'Gasto', 4, 'Deudora', true, NULL),
('6.2.3', 'Fletes y envíos', 'Gasto', 3, 'Deudora', true, NULL),
('6.2.3.01', 'Fletes y envíos', 'Gasto', 4, 'Deudora', true, NULL),
('6.2.4', 'Impuestos comerciales', 'Gasto', 3, 'Deudora', true, NULL),
('6.2.4.01', 'Impuesto sobre los Ingresos Brutos', 'Gasto', 4, 'Deudora', true, NULL),
('6.2.4.02', 'Tasas municipales', 'Gasto', 4, 'Deudora', true, NULL),
('6.2.5', 'Deudores incobrables', 'Gasto', 3, 'Deudora', true, NULL),
('6.2.5.01', 'Deudores incobrables', 'Gasto', 4, 'Deudora', true, NULL),
('6.3', 'Gastos financieros', 'Gasto', 2, 'Deudora', true, NULL),
('6.3.1', 'Gastos bancarios y financieros', 'Gasto', 3, 'Deudora', true, NULL),
('6.3.1.01', 'Intereses y comisiones bancarias', 'Gasto', 4, 'Deudora', true, NULL),
('6.3.1.02', 'Impuesto a los débitos y créditos bancarios', 'Gasto', 4, 'Deudora', true, 'Ley 25.413'),
('6.3.1.03', 'Comisiones de Mercado Pago y tarjetas', 'Gasto', 4, 'Deudora', true, NULL),
('6.4', 'Impuesto a las ganancias', 'Gasto', 2, 'Deudora', true, NULL),
('6.4.1', 'Impuesto a las ganancias', 'Gasto', 3, 'Deudora', true, NULL),
('6.4.1.01', 'Impuesto a las ganancias del ejercicio', 'Gasto', 4, 'Deudora', true, NULL)
ON CONFLICT (codigo) DO NOTHING;

-- 5) Cuentas que usan los procesos automáticos --------------------------------------
UPDATE public.plan_cuentas SET clave_sistema = NULL
WHERE clave_sistema IN ('caja', 'bancos', 'deudores_ventas', 'iva_debito', 'iva_credito', 'proveedores', 'ventas');
UPDATE public.plan_cuentas pc SET clave_sistema = t.clave
FROM (VALUES
  ('1.1.1.01', 'caja'),
  ('1.1.1.02', 'bancos'),
  ('1.1.3.01', 'deudores_ventas'),
  ('2.1.3.01', 'iva_debito'),
  ('1.1.4.01', 'iva_credito'),
  ('2.1.1.01', 'proveedores'),
  ('4.1.1.01', 'ventas')
) AS t(codigo, clave)
WHERE pc.codigo = t.codigo;

-- 6) Nivel y cuenta padre según el código -------------------------------------------
UPDATE public.plan_cuentas
SET nivel = LEAST(array_length(string_to_array(codigo, '.'), 1), 5)
WHERE codigo ~ '^\d+(\.\d+)*$'
  AND nivel IS DISTINCT FROM LEAST(array_length(string_to_array(codigo, '.'), 1), 5);

UPDATE public.plan_cuentas h
SET cuenta_padre_id = p.id
FROM public.plan_cuentas p
WHERE h.codigo ~ '\.'
  AND p.codigo = regexp_replace(h.codigo, '\.[^.]+$', '')
  AND h.cuenta_padre_id IS DISTINCT FROM p.id;

UPDATE public.plan_cuentas SET cuenta_padre_id = NULL WHERE codigo !~ '\.' AND cuenta_padre_id IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
