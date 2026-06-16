BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  500,
  'Zapata María Romina',
  'mariarominazapata@gmail.com',
  '2644056261',
  'Analista de RRHH',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_500_cv_69722a5f615014.98952606.pdf',
  'cv_69722a5f615014.98952606.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69722a5f615014.98952606.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T13:47:11+00:00'::timestamptz,
  '2026-01-22T13:47:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  501,
  'Nicolas Escudero',
  'escuderonicolas094@gmail.com',
  '2645742746',
  'Administrativo/a de Personal',
  NULL,
  'Hola, ¿cómo están?
Mi nombre es Nicolás Escudero y me gustaría postularme para formar parte del equipo de Plot Center. Tengo experiencia en Administración Pública como Privada, también con la formación en Técnico en Gestión de Recursos Humanos. Tengo muchas ganas de sumarme y aportar al equipo.
Adjunto mi CV y quedo atento/a a cualquier novedad.
¡Gracias por su tiempo!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_501_cv_69722a6bf38f67.30136335.pdf',
  'cv_69722a6bf38f67.30136335.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69722a6bf38f67.30136335.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T13:47:23+00:00'::timestamptz,
  '2026-01-22T13:47:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  503,
  'Agustin Daniel Quiroga',
  'agustinquiroga512@gmail.com',
  '02645759141',
  'Soldador/a',
  NULL,
  'Soy estudiante universitario. Tengo un gran manejo de las redes e ideas constantes para plasmar al servicio del sector publicitario.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_503_cv_69723570cbd995.70060423.pdf',
  'cv_69723570cbd995.70060423.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69723570cbd995.70060423.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T14:34:24+00:00'::timestamptz,
  '2026-01-22T14:34:24+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  505,
  'Agustin Daniel Quiroga',
  'agustindaniel512@gmail.com',
  '02645759141',
  'Vendedor/a',
  NULL,
  'Soy estudiante universitario, con un gran manejo de las redes sociales. Tengo un perfil muy orientado a las ventas y con muchas ideas que se pueden plasmar en el sector publicitario y comercial.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_505_cv_6972366e8ea2b9.05240677.pdf',
  'cv_6972366e8ea2b9.05240677.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972366e8ea2b9.05240677.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T14:38:38+00:00'::timestamptz,
  '2026-01-22T14:38:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  506,
  'Santiago Vargas',
  'santivargas832@gmail.com',
  '2645246621',
  'Asistente Administrativo/a',
  NULL,
  'Estimados buen dia, soy Santiago Vargas, estoy en búsqueda de una oportunidad laboral. Tengo conocimientos y experiencia en el rubro.  Adjunto mi cv para su revision. Saludos cordiales',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_506_cv_69723d11d2c3a5.12408133.pdf',
  'cv_69723d11d2c3a5.12408133.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69723d11d2c3a5.12408133.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T15:06:57+00:00'::timestamptz,
  '2026-01-22T15:06:57+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  507,
  'Quiroga Javier',
  'javieralessandroquiroga@gmail.com',
  '2645816169',
  'Comunicación y marketing',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_507_cv_69723d6ee7c4e8.15140233.pdf',
  'cv_69723d6ee7c4e8.15140233.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69723d6ee7c4e8.15140233.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T15:08:30+00:00'::timestamptz,
  '2026-01-22T15:08:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  508,
  'Pablo Nahuel Centeno Ruiz',
  'pablitoce2016@gmail.com',
  '264 587 2589',
  'Vendedor/a',
  NULL,
  'soy un estudiante universitario , que busca empezar a adquirir experiencia en cualquier puesto que pueda desempeñar , no tengo experiencia pero aprendo rápido',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_508_cv_69723f6f824be3.25011222.pdf',
  'cv_69723f6f824be3.25011222.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_69723f6f824be3.25011222.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T15:17:03+00:00'::timestamptz,
  '2026-01-22T15:17:03+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  509,
  'Ana Laura Colome',
  'colome686@gmail.com',
  '2644882525',
  'Administrativo/a de Personal',
  NULL,
  'Soy Técnica en Recursos Humanos y cuento con experiencia en tareas administrativas, atención al público y gestión del personal, realizando funciones como manejo de documentación, control de ingresos y gastos, elaboración de horarios del personal y atención al cliente, además de prácticas profesionalizantes en el sector público.
Me considero una persona responsable, organizada y con buena predisposición para el trabajo, con disponibilidad para cumplir con los requisitos del puesto y muchas ganas de seguir desarrollandome profesionalmente en el área administrativa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_509_cv_69724043188ec1.79525670.pdf',
  'cv_69724043188ec1.79525670.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69724043188ec1.79525670.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T15:20:35+00:00'::timestamptz,
  '2026-01-22T15:20:35+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  511,
  'Rocío Micaela Guerra',
  'rociom.guerra01@gmail.com',
  '2646301879',
  'Cajero/a',
  NULL,
  'Tengo experiencia en ventas y cajas disponibilidad full time me adapto muy rápido y soy muy eficiente',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_511_cv_69724261495998.03924083.pdf',
  'cv_69724261495998.03924083.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69724261495998.03924083.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T15:29:37+00:00'::timestamptz,
  '2026-01-22T15:29:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  512,
  'Matias Leandro Vera Lima',
  'veralimamatias@gmail.com',
  '2645274446',
  'Desarrollador/a Backend',
  NULL,
  'Soy Estudiante del último año de la Carrera de Desarrollador de Software. Estoy muy interesado en formar parte de su equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_512_cv_69724909379860.40174215.pdf',
  'cv_69724909379860.40174215.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69724909379860.40174215.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T15:58:01+00:00'::timestamptz,
  '2026-01-22T15:58:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  513,
  'Brandon perez',
  'brandonperez074@gmail.com',
  '2646303930',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_513_cv_69724d5be4e544.26337344.pdf',
  'cv_69724d5be4e544.26337344.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69724d5be4e544.26337344.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T16:16:27+00:00'::timestamptz,
  '2026-01-22T16:16:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  514,
  'Santiago Rodriguez',
  'lic.santiagorodriguez0425@gmail.com',
  '2645074002',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_514_cv_69724e7d8f5001.11378269.pdf',
  'cv_69724e7d8f5001.11378269.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_69724e7d8f5001.11378269.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T16:21:17+00:00'::timestamptz,
  '2026-01-22T16:21:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  515,
  'Helena Riquelme',
  'helenariquelme19@gmail.com',
  '2646781638',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_515_cv_69724ff94f6ce5.03401642.pdf',
  'cv_69724ff94f6ce5.03401642.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69724ff94f6ce5.03401642.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T16:27:37+00:00'::timestamptz,
  '2026-01-22T16:27:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  516,
  'Ricardo Reyes',
  'federeyesrisavudu@gmail.com',
  '02646270764',
  'Atención al Cliente',
  NULL,
  'Saludos! Espero reunir los requisitos necesarios para poder formar parte de esta empresa. Desde ya, muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_516_cv_6972512b50e7b7.38573175.pdf',
  'cv_6972512b50e7b7.38573175.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6972512b50e7b7.38573175.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T16:32:43+00:00'::timestamptz,
  '2026-01-22T16:32:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  517,
  'Jonatan Ezequiel Contreras Tivani',
  'jonacontreras747@gmail.com',
  '2644764325',
  'Vendedor/a',
  NULL,
  'Tengo 25 años, soy futbolista, estudio ed fisica e inglés, tengo una casa de comida y creo necesario otro ingreso económico y este trabajo me gustaría mucho.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_517_cv_6972613d4ad326.81173689.docx',
  'cv_6972613d4ad326.81173689.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972613d4ad326.81173689.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T17:41:17+00:00'::timestamptz,
  '2026-01-22T17:41:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  518,
  'Enzo Robledo',
  'enzorobledoart@gmail.com',
  '2645320746',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_518_cv_697261da7a9b90.22991731.pdf',
  'cv_697261da7a9b90.22991731.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697261da7a9b90.22991731.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T17:43:54+00:00'::timestamptz,
  '2026-01-22T17:43:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  520,
  'Nadia Alanis',
  'alaniznadia13@gmail.com',
  '2644417071',
  'Atención al Cliente',
  NULL,
  'Estoy cursando mi último año de la Licenciatura en Instrumentación quirúrgica, tengo experiencia en el ámbito de atención al cliente, Recepcionista, soy una persona carismática, responsable y me gusta trabajar en equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_520_cv_697263b47fae75.29675511.pdf',
  'cv_697263b47fae75.29675511.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697263b47fae75.29675511.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T17:51:48+00:00'::timestamptz,
  '2026-01-22T17:51:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  522,
  'Ferra Nicolás',
  'nicoferra01@gmail.com',
  '2645058063',
  'Administrativo/a Contable',
  NULL,
  'Me dirijo a usted por mi interés en formar parte de su base de datos en un puesto relacionado con el área administrativa contable. Cuento con una sólida experiencia en tareas administrativas contables, desempeñándome actualmente en ese rol desde hace más de dos años en un estudio contable.

Durante este tiempo, he desarrollado habilidades clave como la organización, el análisis de datos, la gestión documental, entre otras. Me considero una persona responsable, puntual y meticulosa, cualidades que aplico diariamente para cumplir con eficiencia y precisión las tareas asignadas. También soy estudiante de la carrera Contador Público Nacional.

Estoy entusiasmado con la posibilidad de continuar creciendo profesionalmente dentro de una organización que valore el compromiso y la mejora continua. Estoy convencido de que puedo aportar positivamente sin duda alguna.

Adjunto mi currículum vitae y quedo a disposición para ampliar cualquier información en una entrevista.

Muchas gracias por su tiempo y consideración.

Atentamente,
Ferra Nicolás',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_522_cv_697263e2a2fe77.06088353.pdf',
  'cv_697263e2a2fe77.06088353.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_697263e2a2fe77.06088353.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T17:52:34+00:00'::timestamptz,
  '2026-01-22T17:52:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  523,
  'Mirko Tadeo Castro Matus',
  'mirko.castro04@gmail.com',
  '2644648077',
  'Mecánico/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_523_cv_69726410170435.71240614.pdf',
  'cv_69726410170435.71240614.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69726410170435.71240614.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T17:53:20+00:00'::timestamptz,
  '2026-01-22T17:53:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  524,
  'Agustina De la Vega',
  'delavegaagustina0@gmail.com',
  '2644717876',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_524_cv_6972645e26d911.76202187.pdf',
  'cv_6972645e26d911.76202187.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972645e26d911.76202187.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T17:54:38+00:00'::timestamptz,
  '2026-01-22T17:54:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;