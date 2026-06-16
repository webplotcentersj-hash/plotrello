BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  619,
  'Kevin Davor Méndez Contreras',
  'mendezcontreras.davor2000@gmail.com',
  '2645755579',
  'Soldador/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_619_cv_69a1d8e3c40554.70253685.pdf',
  'cv_69a1d8e3c40554.70253685.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_69a1d8e3c40554.70253685.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-27T17:48:19+00:00'::timestamptz,
  '2026-02-27T17:48:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  620,
  'Alejandro Valdez',
  'working247sj@gmail.com',
  '2646103092',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Soy estudiante avanzado de la carrera de Diseño gráfico, soy una persona con mucha creatividad y capacidad para resolver problemas de diseño, manejo programas como illustrator, Photoshop, Corel, Canva, Photoroom, Adobe Express, Lightroom. He tenido la oportunidad de crear contenido para redes de algunas empresas, con ganas de seguir creciendo profesionalmente. Por estas razones me creo capacitado para este puesto',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_620_cv_69a307522acb78.94993161.pdf',
  'cv_69a307522acb78.94993161.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a307522acb78.94993161.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-28T15:18:42+00:00'::timestamptz,
  '2026-02-28T15:18:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  621,
  'Ana Paula Vidal Douglas',
  'pauviidal98@gmail.com',
  '2645301037',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_621_cv_69a371d5697619.02719810.pdf',
  'cv_69a371d5697619.02719810.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a371d5697619.02719810.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-28T22:53:09+00:00'::timestamptz,
  '2026-02-28T22:53:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  622,
  'Hernán Luis Alberto Tiritera Vaneti',
  'tiriterahernan@gmail.com',
  '2645763556',
  'Instalador/a de Cartelería',
  NULL,
  'Aunque no tengo experiencia directa, he desarrollado habilidades como aprender el funcionamiento del puesto que se me otorgue y trabajar muy bien en equipo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_622_cv_69a388f4b05d56.67552403.pdf',
  'cv_69a388f4b05d56.67552403.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a388f4b05d56.67552403.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-01T00:31:48+00:00'::timestamptz,
  '2026-03-01T00:31:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  623,
  'Eliana Quinteros',
  'brunojofre2024@gmail.com',
  '2645105828',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_623_cv_69a3cae7b22a81.78488949.pdf',
  'cv_69a3cae7b22a81.78488949.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a3cae7b22a81.78488949.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-01T05:13:11+00:00'::timestamptz,
  '2026-03-01T05:13:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  624,
  'Valentín Soto',
  'marianosoto993@gmail.com',
  '2645506660',
  'Atención al Cliente',
  NULL,
  'Me interesa formar parte de Plot Center porque me gusta el trato directo con las personas y el asesoramiento personalizado. Tengo experiencia en atención al público y me destaco por mi buena predisposición, responsabilidad y capacidad para resolver consultas con claridad y respeto. Me adapto rápido, trabajo bien en equipo y tengo muchas ganas de aprender sobre los productos para brindar una excelente experiencia a cada cliente. Estoy comprometido a aportar buena energía y profesionalismo desde el primer día.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_624_cv_69a47f1127fe05.60909693.pdf',
  'cv_69a47f1127fe05.60909693.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a47f1127fe05.60909693.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-01T18:01:53+00:00'::timestamptz,
  '2026-03-01T18:01:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  625,
  'Lucas Rodríguez',
  'lucassumbayrap@gmail.com',
  '2646728196',
  'Mecánico/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_625_cv_69a4ff5b4b3706.38251720.pdf',
  'cv_69a4ff5b4b3706.38251720.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a4ff5b4b3706.38251720.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-02T03:09:15+00:00'::timestamptz,
  '2026-03-02T03:09:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  626,
  'Erick Alesandro Pasten Leguiza',
  'erick.pasten.07@gmail.com',
  '2644519980',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_626_cv_69a50a3d168584.81039966.docx',
  'cv_69a50a3d168584.81039966.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a50a3d168584.81039966.docx","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-02T03:55:41+00:00'::timestamptz,
  '2026-03-02T03:55:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  627,
  'kevin petronelli',
  'kevin.petronelli@gmail.com',
  '2645712160',
  'Desarrollador/a Backend',
  NULL,
  'Hola buen dia, 

Me presento, soy Kevin Petronelli, estoy buscando oportunidad de trabajo.
Creo poder serles muy util ya que tengo experiencia en desarrollador y en atención al público, hablo espanol y frances con fluidez.
Disponibilidad full-time, y tengo permiso de trabajo en territorio Argentino.
Me gustaría consertar una entrevista con ustedes y poder ampliar mi curriculum.

Desde ya muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_627_cv_69a59d5b029f45.97722292.pdf',
  'cv_69a59d5b029f45.97722292.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a59d5b029f45.97722292.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-02T14:23:23+00:00'::timestamptz,
  '2026-03-02T14:23:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  628,
  'Guadalupe Maldonado Riveros',
  'guadimaldonado.gm@gmail.com',
  '2644573356',
  'Proyectista',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_628_cv_69a6da126963b7.16392345.pdf',
  'cv_69a6da126963b7.16392345.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a6da126963b7.16392345.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-03T12:54:42+00:00'::timestamptz,
  '2026-03-03T12:54:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  630,
  'Guadalupe Maldonado Riveros',
  'guadamaldonado.gm@gmail.com',
  '2644573356',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_630_cv_69a6da487e4b77.77087442.pdf',
  'cv_69a6da487e4b77.77087442.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a6da487e4b77.77087442.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-03T12:55:37+00:00'::timestamptz,
  '2026-03-03T12:55:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  633,
  'Leandro Bustos',
  'veronicarivero700@gmail.com',
  '2645661116',
  'Soldador/a',
  NULL,
  'Hola, me llamo Leandro Bustos. Soy Auxiliar Técnico de Metal Mecánica y tengo experiencia en soldadura y fabricación de estructuras metálicas. Me manejo bien con la soldadura MIG y con electrodo revestido, y me gusta trabajar en equipo para cumplir con los plazos de entrega. Estoy buscando un trabajo en una metalúrgica donde pueda aplicar lo que sé y seguir aprendiendo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_633_cv_69a7098a413fc8.33735034.pdf',
  'cv_69a7098a413fc8.33735034.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a7098a413fc8.33735034.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-03T16:17:17+00:00'::timestamptz,
  '2026-03-03T16:17:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  634,
  'María Belén Jiménez Guzzo',
  'belujigu@gmail.com',
  '02644439578',
  'Atención al Cliente',
  NULL,
  'Mi experiencia en atención al cliente me permitió desarrollar autonomía, responsabilidad y organización en el trabajo diario. Me destaco por mi trato cordial, compromiso y capacidad para resolver situaciones con criterio y calma. Soy proactiva, ordenada y con predisposición para aprender y asumir nuevos desafíos.
Actualmente busco incorporarme a un puesto que me permita continuar creciendo profesionalmente, aportando eficiencia y una actitud orientada a la mejora continua. Además, soy estudiante avanzada de la Tecnicatura en Recursos Humanos, lo que fortalece mis habilidades en comunicación, gestión y trabajo en equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_634_cv_69a9788a11dea0.50649405.pdf',
  'cv_69a9788a11dea0.50649405.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a9788a11dea0.50649405.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-05T12:35:22+00:00'::timestamptz,
  '2026-03-05T12:35:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  635,
  'Leo Ferreyra',
  'leoferreyra2025@gmail.com',
  '02645737864',
  'Programador o diseño',
  NULL,
  'Hola mi nombre es Leonardo Ferreyra tengo conocimientos en programación web y app, además soy publicista digital y tengo experiencia en diseño dejo mi currículum',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_635_cv_69ab7855a8bf26.84505617.pdf',
  'cv_69ab7855a8bf26.84505617.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69ab7855a8bf26.84505617.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-07T00:59:01+00:00'::timestamptz,
  '2026-03-07T00:59:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  637,
  'Melisa Olguín',
  'melisaolguin91@gmail.com',
  '2645856643',
  'Vendedor/a',
  NULL,
  '.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_637_cv_69ac7be9cff064.90660918.pdf',
  'cv_69ac7be9cff064.90660918.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69ac7be9cff064.90660918.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-07T19:26:33+00:00'::timestamptz,
  '2026-03-07T19:26:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  639,
  'Martina Lavia',
  'martinabiscoqueso@gmail.com',
  '2645306226',
  'Fotografía, comunicación social e iluminación.',
  NULL,
  'Soy Martina Lavia, Estudiante de Fotografía en La Escuela Nacional de Fotografía, (ENFO) y Diplomada Universitaria en fotografía técnica y documental.
Mi búsqueda es por fotos con textura, rugosidad, colores vivos, saturados e intensos, la búsqueda de líneas, puntos de fuga y de composiciones con simetría,
He trabajado con diferentes artistas y en colaboraciones con otros fotógrafos, como en el colectivo “La Combi”, Milité durante años en un Partido político al cuál hice las veces de fotografa. 
Tengo dos grandes mentores: Daniel Merle profesor mío de la Universidad (periodista del diario La nación) y mi amiga Valentina Gangemi (egresada de la Univ. de Córdoba).
Ellos su camaradería y sus enseñanzas me han permitido ir paso a paso en este camino que, espero continue por muchos años.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_639_cv_69af9ccc1714b5.29293009.pdf',
  'cv_69af9ccc1714b5.29293009.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69af9ccc1714b5.29293009.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-10T04:23:40+00:00'::timestamptz,
  '2026-03-10T04:23:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  640,
  'Enzo Ariel Martinez',
  'enzo22898@gmail.com',
  '2645565956',
  'Dispuesto a cualquier oportunidad laboral',
  NULL,
  'Estimado/a 
Me gustaría presentar mi candidatura espontánea para futuros procesos de selección en Plot Center.
Admiro su trayectoria en campo laboral y tengo un gran interés en formar parte y contribuir a proyectos de la empresa.
Adjunto mi CV y quedo a plena disposición.
Un cordial saludo,',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_640_cv_69b064a3bbbbf2.53132825.pdf',
  'cv_69b064a3bbbbf2.53132825.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b064a3bbbbf2.53132825.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-10T18:36:19+00:00'::timestamptz,
  '2026-03-10T18:36:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  641,
  'Cecilia Beatriz Martinez',
  'mrtnz.ceci@gmail.com',
  '02644604336',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Mi nombre es Cecilia Martinez y me comunico para ofrecer mis servicios de diseño gráfico, producción e impresión.

Cuento con experiencia en el desarrollo de soluciones gráficas integrales, adaptadas a las necesidades y objetivos de cada proyecto, tanto para marcas, empresas y eventos. Trabajo de manera personalizada, acompañando cada etapa del proceso creativo y productivo para lograr resultados efectivos y de calidad.

Quedo a disposición para enviar mi portfolio, realizar presupuestos personalizados o coordinar una reunión para ampliar esta información.

Servicios:
https://drive.google.com/drive/folders/1gtpHzBMpUiOzhTc-7I308_NrytW_-gpk

Instagram:
https://www.instagram.com/dgmartinezcecilia
www.behance.net/cbmartinez

Saludos cordiales,
Cecilia Martinez
Diseño Gráfico · Producción · Impresión',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_641_cv_69b1cb43808f40.49763187.pdf',
  'cv_69b1cb43808f40.49763187.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b1cb43808f40.49763187.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-11T20:06:27+00:00'::timestamptz,
  '2026-03-11T20:06:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  642,
  'Manzano',
  'posmarianela@gmail.com',
  '2645603009',
  'Cajero/a',
  NULL,
  'Me encuentro en búsqueda laboral y quería postularme para el puesto. Cuento con experiencia en facturación y atención en caja, manejo de cobros y trato con clientes. Me considero una persona responsable, organizada y con buena predisposición para el trabajo. Quedo a disposición para ampliar información. Muchas gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_642_cv_69b240a25515e7.67620843.pdf',
  'cv_69b240a25515e7.67620843.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b240a25515e7.67620843.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-12T04:27:14+00:00'::timestamptz,
  '2026-03-12T04:27:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  645,
  'Mayra Marcuzzi',
  'mayramar@hotmail.com.ar',
  '2646629523',
  'Atención al Cliente',
  NULL,
  'Buenas tardes, estoy en búsqueda de experiencia laboral en el rubro de las gráficas, estudié marketing y me gusta todo lo orientado a diseño.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_645_cv_69b304cf693d39.43326654.pdf',
  'cv_69b304cf693d39.43326654.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b304cf693d39.43326654.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-12T18:24:15+00:00'::timestamptz,
  '2026-03-12T18:24:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;