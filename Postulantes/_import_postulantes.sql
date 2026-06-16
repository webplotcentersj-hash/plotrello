-- Import legacy postulantes: 553
BEGIN;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  7,
  'YESICA ALANIZ YUSTI',
  'yesicaalanizyusti@gmail.com',
  '2644039240',
  'ADMINISTRATIVO',
  NULL,
  'Buenas tardes: me encuentro en la búsqueda de nuevas experiencias laborales por ello adjunto cv.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_7_cv_68acb5d8ea3150.01529513.pdf',
  'cv_68acb5d8ea3150.01529513.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68acb5d8ea3150.01529513.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-25T19:13:28+00:00'::timestamptz,
  '2025-08-25T19:13:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  8,
  'Alexis Herrera',
  'alexisherrerankdg@gmail.com',
  '2646621720',
  'Diseñador Gráfico, Atención al público',
  NULL,
  'Buenas que tal, adjunto mi cv. Estoy a disposición, gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_8_cv_68acd9769e6491.53977292.pdf',
  'cv_68acd9769e6491.53977292.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68acd9769e6491.53977292.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-25T21:45:26+00:00'::timestamptz,
  '2025-08-25T21:45:26+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  9,
  'Marcos David Molina',
  'marcosdavidmolina2690@gmail.com',
  '2645858826',
  'Electricista',
  NULL,
  'Trabaje en Chacón y la verdad que me  gusta el rubro . obviamente que me gustaría hacerlo de forma elegante como lo es PlotC.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_9_cv_68b1be6b6e6e00.55180535.pdf',
  'cv_68b1be6b6e6e00.55180535.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68b1be6b6e6e00.55180535.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-29T14:51:23+00:00'::timestamptz,
  '2025-08-29T14:51:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  10,
  'Lucas Juan Gonzalez',
  'mateomimi21@gmail.com',
  '2645892272',
  'Diseñador gráfico, también administrativo, chófer, electricista domiciliario.',
  NULL,
  'Me gusta todo con respecto a diseños, tengo muchas ideas, aprendo demasiado rápido y se que puedo ayudarles en el puesto que ustedes necesiten.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_10_cv_68b1db4109ca69.57847902.docx',
  'cv_68b1db4109ca69.57847902.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68b1db4109ca69.57847902.docx","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-29T16:54:25+00:00'::timestamptz,
  '2025-08-29T16:54:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  11,
  'Facundo Burgo',
  'facundoburgo2@gmail.com',
  '2644470256',
  'Vendedor',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_11_cv_68b1fb0f9f4375.38617626.pdf',
  'cv_68b1fb0f9f4375.38617626.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b1fb0f9f4375.38617626.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-29T19:10:07+00:00'::timestamptz,
  '2025-08-29T19:10:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  12,
  'Federico Rivero',
  'federicorivero18@gmail.com',
  '2644710202',
  'Desarrollador web',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_12_cv_68b1fe5cc54021.25626337.pdf',
  'cv_68b1fe5cc54021.25626337.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b1fe5cc54021.25626337.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-29T19:24:12+00:00'::timestamptz,
  '2025-08-29T19:24:12+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  13,
  'Bustos Leandro',
  'bustosleandro84@gmail.com',
  '2644582758',
  'Metalúrgico',
  NULL,
  'Me gusta su forma de trabajo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_13_cv_68b20b66694388.03205581.pdf',
  'cv_68b20b66694388.03205581.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b20b66694388.03205581.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-29T20:19:50+00:00'::timestamptz,
  '2025-08-29T20:19:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  14,
  'Yamila Heredia',
  'yamilajr12@gmail.com',
  '2646269628',
  'Atención al público/ Diseñadora gráfica',
  NULL,
  'Me encantaría trabajar de lo que más amo, que es mi oficio.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_14_cv_68b23062d3e208.79816450.pdf',
  'cv_68b23062d3e208.79816450.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b23062d3e208.79816450.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-29T22:57:38+00:00'::timestamptz,
  '2025-08-29T22:57:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  15,
  'Mercedes Maria Eva Asaro Turco Greco',
  'merceasaro@gmail.com',
  '2646215666',
  'Diseñador, administrativo, communnity manager.',
  NULL,
  'Diseñador gráfico apasionado y detallista con habilidades para crear soluciones visuales atractivas y efectivas. Comprometido con la entrega de trabajos de alta calidad dentro de los plazos establecidos, priorizando la precisión y la atención al detalle. Busco oportunidades para aplicar mis habilidades y conocimientos en proyectos desafiantes y colaborativos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_15_cv_68b2399c14bbf5.21295438.pdf',
  'cv_68b2399c14bbf5.21295438.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b2399c14bbf5.21295438.pdf","migrated_at":"2026-06-09T11:23:49.251Z"}'::jsonb,
  '2025-08-29T23:37:00+00:00'::timestamptz,
  '2025-08-29T23:37:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  16,
  'Martina Lavia',
  'martinalavia07@gmail.com',
  '2645306226',
  'Fotografía, Community Manager, Manejo de Redes',
  NULL,
  'Soy Martina Lavia, estudiante de fotografía en ENFO (Escuela Nacional de Fotografía), mi busqueda es por romper con las ideas minimalistas en la fotografía y hacer critica dura  y pura de acontecimientos sociales, marchas y eventos fotoperiodisticos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_16_cv_68b247ec3726c3.52568051.pdf',
  'cv_68b247ec3726c3.52568051.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68b247ec3726c3.52568051.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-08-30T00:38:04+00:00'::timestamptz,
  '2025-08-30T00:38:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  17,
  'Agustina Sarmiento',
  'agustinadelvallesarmientop@gmail.com',
  '2644155493',
  'Administrativo. Atención al cliente.',
  NULL,
  'Hola! Mi nombre es Agustina Sarmiento, tengo 27 años y estoy buscando un puesto laboral que me permita aplicar y desarrollar mis habilidades en dibujo publicitario. Me encantaría trabajar en Plot Center porque me apasiona la innovación en el sector de la impresión y las diferentes técnicas que utilizan. Además, soy una clienta fiel desde hace un par de años y me gustaría formar parte del equipo que me ha brindado un servicio excelente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_17_cv_68b24e0174ea55.97004503.pdf',
  'cv_68b24e0174ea55.97004503.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b24e0174ea55.97004503.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-08-30T01:04:01+00:00'::timestamptz,
  '2025-08-30T01:04:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  18,
  'Ysamar Ynojoza',
  'ysamar512@gmail.com',
  '2645778353',
  'La vacante que más se adecúe a mi perfil.',
  NULL,
  'Hola ! Mi.nombre es Ysamar y además de ser cliente mi hermano y mi sobrino son empleados de Plot Center ... siempre es un lugar donde me gusta ir y escucho la manera en que trabajan a través de mis familiares,  la cual admiro! Siempre quise trabajar con ustedes. Tengo varias habilidades y he aprendido diferentes oficios estando aquí en Argentina.  Aunque soy Licenciada en Comunicación Social y Venezolana, soy emigrante y sabemos aprender y adaptarnos a cualquier desafío.  Les dejo mi CV y les saludo. Gracias!!!!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_18_cv_68b2e8d95ac753.64277143.pdf',
  'cv_68b2e8d95ac753.64277143.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68b2e8d95ac753.64277143.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-08-30T12:04:41+00:00'::timestamptz,
  '2025-08-30T12:04:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  19,
  'Joaquín Javier Morales',
  'joaquin-84@hotmail.com',
  '02644649783',
  'Administrativo',
  NULL,
  'Tengo experiencia en tareas administrativas en general.
Creo que puedo ser un gran aporte a la organización.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_19_cv_68b2ffe58bca26.61651258.pdf',
  'cv_68b2ffe58bca26.61651258.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b2ffe58bca26.61651258.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-08-30T13:43:01+00:00'::timestamptz,
  '2025-08-30T13:43:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  20,
  'Santiago Robledo',
  'santiago.robledo91@hotmail.com',
  '2645765705',
  'Caja, administración',
  NULL,
  'Cuento con experiencia en emision, validación y carga de facturas, manejo de caja , emisión de cheques y eCheq .  
También cuento con experiencia en logística, arribo de mercadería, zonificación , armado de rutas y distribución.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_20_cv_68b4df6175ede2.66784535.pdf',
  'cv_68b4df6175ede2.66784535.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b4df6175ede2.66784535.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-08-31T23:48:49+00:00'::timestamptz,
  '2025-08-31T23:48:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  21,
  'Tobias Emanuel Lima Amato',
  'tobiasemanuellimaamato@gmail.com',
  '2644601240',
  'personal de atención al público',
  NULL,
  'hola, soy estudiante de la FAUD (facultad de arquitectura,urbanismo y diseño) ,tengo experiencia con programas como clip studio paint ,word actualmente trabajo tambien de pedidos de dibujos independiente, y soy responsable y alguien que le gusta aprender y tener mejores conocimientos para el futuro laboral y personal , actualmente estoy buscando experiencia laboral',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_21_cv_68b65722dbada7.70695422.pdf',
  'cv_68b65722dbada7.70695422.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b65722dbada7.70695422.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-02T02:32:02+00:00'::timestamptz,
  '2025-09-02T02:32:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  22,
  'Valentina Torres',
  'valentinatorreslujan475@gmail.com',
  '2645611389',
  'Vendedora,Administradora, marketing',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_22_cv_68b6df8e6f3c04.42227054.pdf',
  'cv_68b6df8e6f3c04.42227054.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b6df8e6f3c04.42227054.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-02T12:14:06+00:00'::timestamptz,
  '2025-09-02T12:14:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  23,
  'Matias Herrera',
  'matias733.az@gmail.com',
  '2646108655',
  'Atención al publico o administrativo',
  NULL,
  'Soy Matias Herrera, secretario administrativo con 2 años de
experiencia, y me entusiasma la posibilidad de
formar parte de Plot Center.
En mi experiencia previa, he desarrollado
habilidades efectivas en la atención al cliente
gestión de documentación y resolución de
problemas. Sé que puedo aportar ese mismo
enfoque en su equipo.
Me encantaria conversar más sobre cómo puedo
sumar a su empresa. Quedo a disposición para una
entrevista. iGracias por su tiempo!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_23_cv_68b8c0b85825a9.70132216.pdf',
  'cv_68b8c0b85825a9.70132216.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b8c0b85825a9.70132216.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-03T22:27:04+00:00'::timestamptz,
  '2025-09-03T22:27:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  24,
  'Melisa Delfina Pino Castro',
  'cpmelisapino@gmail.com',
  '2645839180',
  'Contador Interno',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_24_cv_68b9afb358bd98.54862065.pdf',
  'cv_68b9afb358bd98.54862065.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9afb358bd98.54862065.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T15:26:43+00:00'::timestamptz,
  '2025-09-04T15:26:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  25,
  'Alejandro Patricio Sandandez Oropel',
  'patosandandez.24@gmail.com',
  '02644153735',
  'Administrativo contable/compras',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_25_cv_68b9b4ec67ac34.88659125.pdf',
  'cv_68b9b4ec67ac34.88659125.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9b4ec67ac34.88659125.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T15:49:00+00:00'::timestamptz,
  '2025-09-04T15:49:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  26,
  'Celina Nahir Martínez Retamar',
  'celinamartinez1999@gmail.com',
  '2646230045',
  'Administrativa. Facturación. Tesorería',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_26_cv_68b9bb346320b1.35444648.pdf',
  'cv_68b9bb346320b1.35444648.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9bb346320b1.35444648.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T16:15:48+00:00'::timestamptz,
  '2025-09-04T16:15:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  27,
  'Angela Denice Neira Carrizo',
  'angeladeniceneira@gmail.com',
  '02646301594',
  'Técnica en Higiene y Seguridad Laboral',
  NULL,
  'Soy una persona comprometida con la prevención de riesgos laborales y la promoción de la salud ocupacional. Aportando experiencia y conocimientos para lograr nuevas mejoras continuas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_27_cv_68b9c1328eee77.03225994.pdf',
  'cv_68b9c1328eee77.03225994.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68b9c1328eee77.03225994.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T16:41:22+00:00'::timestamptz,
  '2025-09-04T16:41:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  28,
  'Morales Mirella',
  'mirellamorales22@gmail.com',
  '2645190177',
  'Administración general',
  NULL,
  'Profesional en Administración de Empresas, apasionada por la innovación y la mejora continua. Combino habilidades administrativas y técnicas con una actitud proactiva y orientada al crecimiento, siempre buscando optimizar procesos y generar experiencias positivas en clientes y equipos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_28_cv_68b9d91807ed92.04702608.docx',
  'cv_68b9d91807ed92.04702608.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9d91807ed92.04702608.docx","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T18:23:20+00:00'::timestamptz,
  '2025-09-04T18:23:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  29,
  'Leonel Sierra',
  'hleonel.sierra@gmail.com',
  '2645130343',
  'administrativo, venta',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_29_cv_68b9ec6cda19f5.59984373.pdf',
  'cv_68b9ec6cda19f5.59984373.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9ec6cda19f5.59984373.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T19:45:48+00:00'::timestamptz,
  '2025-09-04T19:45:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  30,
  'Facundo Carrizo',
  'facundoivan1996@gmail.com',
  '(11) 7226-9436',
  'Varios',
  NULL,
  'Técnico Electromecánico, me gustaría formar parte de la empresa',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_30_cv_68b9ef3823e939.11301272.pdf',
  'cv_68b9ef3823e939.11301272.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68b9ef3823e939.11301272.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T19:57:44+00:00'::timestamptz,
  '2025-09-04T19:57:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  31,
  'Jeremias Cabalin',
  'jeremiasfernandez07cc@gmail.com',
  '02645648600',
  'Cualquier vacante a la cual mi perfil se adapte',
  NULL,
  'Cuento con experiencia en manejo de personal, análisis de laboratorio, calidad alimentaria, normas ISO, Bpm, etc',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_31_cv_68ba067a9a4434.61634356.pdf',
  'cv_68ba067a9a4434.61634356.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba067a9a4434.61634356.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T21:36:58+00:00'::timestamptz,
  '2025-09-04T21:36:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  32,
  'Rosario Castañeda Donoso',
  'rosicas00@gmail.com',
  '2646728153',
  'Administrativo',
  NULL,
  'Me gustaría dejar mi CV en caso de que se abra alguna vacante administrativa, en este momento de la postulación tengo disponibilidad inmediata. 

Saludos y gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_32_cv_68ba0d315c44d5.63107876.pdf',
  'cv_68ba0d315c44d5.63107876.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba0d315c44d5.63107876.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T22:05:37+00:00'::timestamptz,
  '2025-09-04T22:05:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  33,
  'Ezequiel Eduardo Llanos',
  'llanosezequiel03@gmail.com',
  '02644621010',
  'ADMINISTRATIVO CONTABLE',
  NULL,
  'Hola, Soy Contador Publico con más de 9 años de experiencia en ambito privado.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_33_cv_68ba190c649bd5.46360521.pdf',
  'cv_68ba190c649bd5.46360521.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba190c649bd5.46360521.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-04T22:56:12+00:00'::timestamptz,
  '2025-09-04T22:56:12+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  34,
  'Verónica Noemi Grimal Terrera',
  'grimal_vero78@hotmail.com',
  '2645068574',
  'Administrariva',
  NULL,
  'Buenas noches mi nombre es Verónica, tengo  experiencia en Administración y Atención al cliente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_34_cv_68ba3e70ae5ac1.35130138.pdf',
  'cv_68ba3e70ae5ac1.35130138.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba3e70ae5ac1.35130138.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T01:35:44+00:00'::timestamptz,
  '2025-09-05T01:35:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  35,
  'Julián Celador',
  'juliancelador25@gmail.com',
  '02645137789',
  'Administrativo, Atención Al Cliente, Operario de Almacén',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_35_cv_68ba7c33c91eb1.36583213.pdf',
  'cv_68ba7c33c91eb1.36583213.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ba7c33c91eb1.36583213.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T05:59:15+00:00'::timestamptz,
  '2025-09-05T05:59:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  36,
  'Brisa Oriana Davila',
  'brichudavila29@gmail.com',
  '02645733992',
  'Vendedora',
  NULL,
  'Buenos dias mi nombre es Brisa Dávila me comunico con ustedes por este medio para enviarles mi currículum vitae, cabe mencionar que poseo las siguientes aptitudes: Responsable, Puntual, Proactivo , Trabajo en equipo, aprender rápido
Sin más que decir les saludo antentamente.
Pd:espero sea de su agrado.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_36_cv_68babbb1e3f6a6.39736665.pdf',
  'cv_68babbb1e3f6a6.39736665.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68babbb1e3f6a6.39736665.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T10:30:09+00:00'::timestamptz,
  '2025-09-05T10:30:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  37,
  'Elian Adolfo Baigorria',
  'baigorriaelian29@gmail.com',
  '02644470779',
  'Vendedor',
  NULL,
  'Buenos dias mi nombre es Elian Baigorria me comunico con ustedes con el objetivo de hacerle llegar mi currículum vitae, para asi formar parte de su equipo. 
A continuación adjunto mi curriculum y mi Certificado Asistencia Primeros Auxilios. Reanimación Cardiopulmonar (RCP), cabe mencionar que cuento con certificado de Manipulación de Alimentos vigente.
Sin más que decirles les saludo atentamente.
PD: espero su pronta respuesta.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_37_cv_68babbd777e323.06397473.pdf',
  'cv_68babbd777e323.06397473.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68babbd777e323.06397473.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T10:30:47+00:00'::timestamptz,
  '2025-09-05T10:30:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  38,
  'Edgardo olmos',
  'edgardoolmos09@gmail.com',
  '2646304282',
  'Administración',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_38_cv_68bad0449d5896.88471672.pdf',
  'cv_68bad0449d5896.88471672.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bad0449d5896.88471672.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T11:57:56+00:00'::timestamptz,
  '2025-09-05T11:57:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  39,
  'Juan Manuel Cataldo Tapia',
  'juanmacataldo1411@gmail.com',
  '02644805327',
  'Técnico en Higiene y Seguridad.',
  NULL,
  'Hola, Mi nombre es Juan Manuel, me interesa formar parte del equipo de PlotCenter. Soy Técnico en Higiene y Seguridad, con experiencia en prevención de riesgos y mejoras en ambientes de trabajo.
Me considero una persona responsable, proactiva y con muchas ganas de aprender y aportar.
Adjunto mi CV para su consideración y quedo a disposición para una entrevista.

Muchas gracias por su tiempo y atención.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_39_cv_68bae6c2b27d39.48847278.pdf',
  'cv_68bae6c2b27d39.48847278.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bae6c2b27d39.48847278.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T13:33:54+00:00'::timestamptz,
  '2025-09-05T13:33:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  40,
  'Betty Cecilia Ruiz Nehme',
  'bruiznehme31@gmail.com',
  '2645021068',
  'Administración',
  NULL,
  'Profesional con mas de 10 años de experiencia en el rubro administrativo, contable, rrhh, atención al cliente, proveedores, etc....y en búsqueda de jueves oportunidades laborales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_40_cv_68bb05c5333fe5.00154201.pdf',
  'cv_68bb05c5333fe5.00154201.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb05c5333fe5.00154201.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T15:46:13+00:00'::timestamptz,
  '2025-09-05T15:46:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  41,
  'Florencia Medina Quiñonero',
  'flormedinaq75@gmail.com',
  '2644123733',
  'Administrativo',
  NULL,
  'Tengo experiencia en gestión administrativa, contable y de recursos humanos, incluyendo manejo de Excel, Word, planillas de control y sistemas administrativos. Me considero organizada, proactiva y con capacidad para adaptarme a entornos dinámicos.
Me interesa sumarme a Plot Center porque valoro la posibilidad de aportar mis conocimientos a una empresa en crecimiento y seguir desarrollándome profesionalmente en el área administrativa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_41_cv_68bb0b43ad97a2.87559312.pdf',
  'cv_68bb0b43ad97a2.87559312.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb0b43ad97a2.87559312.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T16:09:39+00:00'::timestamptz,
  '2025-09-05T16:09:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  42,
  'Hector Ventrice',
  'hector_ventrice@yahoo.com.ar',
  '2645055821',
  'Administrativo, comprador',
  NULL,
  'Con más de 20 años de experiencia en la industria Minera e Industrial, he desarrollado una sólida trayectoria en diversas áreas, incluyendo administración generalista, control de calidad, logística y gestión de inventario. Mi expertise en sistemas como SAP, Tango, Tac Tica, SIS , AS400 y Normas ISO 9001/45001, sumado a mi capacidad para trabajar de manera eficiente en entornos dinámicos, me permiten aportar un valor significativo a su equipo.
 Durante mi tiempo en mi ultimado trabajo, implementé un sistema de control de calidad que redujo el porcentaje de devoluciones en un 15%, optimizando así los procesos y generando un ahorro de costos. Asimismo, lideré un equipo de 4 personas en la gestión del almacén central, logrando una mejora del 60% en la eficiencia de las operaciones.

 Estoy altamente motivado a aplicar mis conocimientos y habilidades en un nuevo desafío. Mi objetivo es contribuir al crecimiento y éxito de su empresa, aportando mi experiencia y capacidad de adaptación.

 Adjunto mi currículum vitae para su consideración, donde podrá encontrar una descripción más detallada de mis logros y competencias.

 Quedo a su disposición para coordinar una entrevista y ampliar cualquier información que considere relevante.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_42_cv_68bb0b86b60605.70594939.pdf',
  'cv_68bb0b86b60605.70594939.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb0b86b60605.70594939.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T16:10:46+00:00'::timestamptz,
  '2025-09-05T16:10:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  43,
  'Sofía Daniela Escudero Fernández',
  'sofidanielaescudero@gmail.com',
  '2646617320',
  'Sector de impresión o Diseñador Gráfico',
  NULL,
  'Hola Plotcenter
Mi nombre es Sofía Escudero, tengo 20 años y actualmente curso el tercer año de la carrera de Diseño Gráfico. Me entusiasma mucho la posibilidad de formar parte de un equipo como el de Plotcenter, ya que admiro el trabajo que realizan en el área de impresión y diseño, y me interesa aprender desde adentro cómo se desarrolla el proceso en una empresa de gran escala.
Me considero una persona creativa, responsable y con muchas ganas de seguir creciendo en el ámbito profesional. Además de mi formación académica, me motiva aplicar lo que voy aprendiendo en la práctica y aportar mi mirada fresca y comprometida en cada proyecto.
Me encantaría tener la oportunidad de conversar con ustedes, contarles un poco más sobre mi perfil y también conocer mejor sus necesidades. Quedo a disposición para entrevistas o charlas sobre el puesto.
Muchas gracias por su tiempo y consideración.
Saludos cordiales,
Sofía Escudero.
2646617320
sofidanielaescudero@gmail.com',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_43_cv_68bb183f406791.72968299.pdf',
  'cv_68bb183f406791.72968299.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bb183f406791.72968299.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-05T17:05:03+00:00'::timestamptz,
  '2025-09-05T17:05:03+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  44,
  'Gisela Diamantino',
  'sjdiamantinoarg@gmail.com',
  '02645420653',
  'Asistente Administrativa',
  NULL,
  'Me encanta la idea de sumarme como Asistente Administrativa en Plot Center porque me identifico con los espacios que combinan diseño, tecnología y atención al detalle. Me motiva aplicar herramientas digitales para hacer que el día a día sea más ágil, ordenado y eficiente. Además, soy fan de la mejora continua: siempre estoy buscando cómo optimizar procesos, facilitar tareas y aportar ideas que sumen al equipo. Tengo muchas ganas de aprender, compartir lo que sé y seguir creciendo en un entorno que valore la creatividad y el trabajo colaborativo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_44_cv_68bc5358ae0ac8.23923130.pdf',
  'cv_68bc5358ae0ac8.23923130.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bc5358ae0ac8.23923130.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-06T15:29:28+00:00'::timestamptz,
  '2025-09-06T15:29:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  45,
  'Emilce Yasmín Rodríguez Gordillo',
  'emilceyasmin01@gmail.com',
  '2644360227',
  'Recursos Humanos- Cajera- Atención',
  NULL,
  'Hola, buenos días. Me dirijo a usted con el objetivo de postularme para formar parte de su equipo de trabajo.
Soy Licenciada en Recursos Humanos, graduada en diciembre de 2024, y cuento con experiencia previa en caja, tareas administrativas y atención al cliente. 

Me considero una persona proactiva, responsable y con gran capacidad de adaptación a los cambios. Tengo facilidad para aprender rápidamente y aportar soluciones eficientes, buscando siempre cumplir con los objetivos propuestos y mantener un excelente trato interpersonal.

Estoy convencida de que mi formación académica, sumada a mi experiencia y habilidades, pueden contribuir positivamente al desarrollo de su organización.

Agradezco su tiempo y consideración, y quedo a disposición para ampliar cualquier información en una entrevista personal. Adjunto mi cv a continuación',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_45_cv_68bc568e6c58b4.15262136.pdf',
  'cv_68bc568e6c58b4.15262136.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bc568e6c58b4.15262136.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-06T15:43:10+00:00'::timestamptz,
  '2025-09-06T15:43:10+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  46,
  'Celeste Balaguer',
  'balaguercele@gmail.com',
  '2644765947',
  'Recursos Humanos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_46_cv_68bd8580aa3691.77807036.pdf',
  'cv_68bd8580aa3691.77807036.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bd8580aa3691.77807036.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-07T13:15:44+00:00'::timestamptz,
  '2025-09-07T13:15:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  47,
  'Nicolás Richarte',
  'nicolasricharte00@gmail.com',
  '264-4628748',
  'Editor de video fotografía, ventas corporativas B2B B2C',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_47_cv_68beaaee5313f2.32973327.pdf',
  'cv_68beaaee5313f2.32973327.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68beaaee5313f2.32973327.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-08T10:07:42+00:00'::timestamptz,
  '2025-09-08T10:07:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  48,
  'Ana Laura Páez',
  'analaurapaez89@gmail.com',
  '2644863447',
  'Administrativa, auxiliar',
  NULL,
  'Estimado/a:
Me presento como una profesional con una trayectoria sólida de más de una década en el ámbito administrativo, contable, logístico y de atención al cliente, desempeñando funciones clave que requieren precisión, organización y un compromiso constante con la excelencia. A lo largo de mi carrera, he demostrado una capacidad sostenida para adaptarme a diferentes entornos, comprender rápidamente las necesidades del negocio y proponer soluciones que mejoren la eficiencia operativa y la satisfacción del cliente. Mi enfoque combina el dominio de herramientas informáticas y sistemas de gestión con habilidades interpersonales desarrolladas, lo que me permite trabajar de manera efectiva tanto de forma independiente como en equipo.
Durante mi experiencia en empresas del sector comercial y de servicios, he gestionado operaciones de caja, créditos y planes de pago con rigurosidad, asegurando registros claros y procesos financieros transparentes. El manejo de sistemas como SIAF, CEGID, POSNET y LAPOS ha sido una constante en mi labor, permitiéndome llevar un control preciso de operaciones y mantener la información actualizada para la toma de decisiones. Mi rol también ha incluido la coordinación logística, supervisando el abastecimiento y reposición de stock, así como la recepción y despacho de mercadería, asegurando el cumplimiento de plazos y estándares de calidad. Uno de los aspectos que más valoro de mi experiencia es la oportunidad de capacitar a nuevos colaboradores, guiándolos en el uso de sistemas y procedimientos internos, y fomentando un ambiente de trabajo colaborativo y eficiente. Esta faceta de mi trayectoria me ha permitido no solo transferir conocimientos técnicos, sino también inspirar confianza y compromiso en los
equipos con los que trabajé.
En paralelo, mi emprendimiento propio me ha brindado la oportunidad de desarrollar competencias estratégicas, desde la selección y compra de productos hasta el trato
directo con clientes, aplicando técnicas de venta, marketing y gestión administrativa. Esta experiencia me ha enseñado a gestionar recursos de manera integral, optimizando procesos y adaptando estrategias según las necesidades del mercado.
Agradezco sinceramente la oportunidad de presentar mi perfil y quedo a disposición para ampliar cualquier tipo de información adicional.
Atentamente
Ana Laura Páez',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_48_cv_68bedbb73e8ea1.91980955.pdf',
  'cv_68bedbb73e8ea1.91980955.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bedbb73e8ea1.91980955.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-08T13:35:51+00:00'::timestamptz,
  '2025-09-08T13:35:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  49,
  'Montero Zoe',
  'zoejulimontero@gmail.com',
  '2645641771',
  'Administrativo',
  NULL,
  'Buenos días, me postulo para el área administrativa. Si bien aún no tengo experiencia laboral formal en el sector, cuento con gran disposición para aprender, capacidad organizativa y compromiso. Me interesa crecer profesionalmente en Plot Center',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_49_cv_68bf10af4bbd02.12223878.pdf',
  'cv_68bf10af4bbd02.12223878.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68bf10af4bbd02.12223878.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-08T17:21:51+00:00'::timestamptz,
  '2025-09-08T17:21:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  50,
  'Rodrigo farias barros',
  'fariasbarrosrodrigo12@gmail.com',
  '2644882023',
  'Instalador grafico',
  NULL,
  'Tengo las abilidades y los conocimientos necesarios para realizar este y otros tipos de trabajos comprometiendome en hacerlo en tiempo y forma para obtener un buen resultado del trabajo y me considero una persona muy responsable',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_50_cv_68bf2c5aa79fe3.90458192.pdf',
  'cv_68bf2c5aa79fe3.90458192.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68bf2c5aa79fe3.90458192.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-08T19:19:54+00:00'::timestamptz,
  '2025-09-08T19:19:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  51,
  'Jorge arabena',
  'jorgearabena22@gmail.com',
  '2644840043',
  'Instalador gráfico',
  NULL,
  'Hola soy recibido de técnico electromecánico y técnico en refrigeración matriculado.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_51_cv_68bf5d9f0e1303.25900789.pdf',
  'cv_68bf5d9f0e1303.25900789.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68bf5d9f0e1303.25900789.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-08T22:50:07+00:00'::timestamptz,
  '2025-09-08T22:50:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  54,
  'Ivan Manrique',
  'ivanpianaz23@gmail.com',
  '2644055670',
  'Instalador/a de Cartelería',
  NULL,
  'Tengo experiencia en colocación de vinilos ploteo vehícular polarizados en gral atención al público https://www.cvwizard.com/d/3b2WEjdVemzO6UL68XMMB3/view',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_54_cv_68c05bec628bc5.90023312.pdf',
  'cv_68c05bec628bc5.90023312.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68c05bec628bc5.90023312.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-09T16:55:08+00:00'::timestamptz,
  '2025-09-09T16:55:08+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  55,
  'Agustin Ameglio',
  'agusameglio18@gmail.com',
  '2644754328',
  'Técnico/a en Instalaciones',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_55_cv_68c07335e74ec7.62485071.pdf',
  'cv_68c07335e74ec7.62485071.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68c07335e74ec7.62485071.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-09T18:34:29+00:00'::timestamptz,
  '2025-09-09T18:34:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  59,
  'Carlos Morales',
  'charliimorales@gmail.com',
  '02645858208',
  'Analista de Marketing',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_59_cv_68c2baa8eefd62.57054049.pdf',
  'cv_68c2baa8eefd62.57054049.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68c2baa8eefd62.57054049.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-11T12:03:52+00:00'::timestamptz,
  '2025-09-11T12:03:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  60,
  'Valentina Estevez Podda',
  'valenes.mov@gmail.com',
  '2645612559',
  'Community Manager',
  NULL,
  'Soy graduada de la ENERC Sede Cuyo como Realizadora Cinematográfica Integral, una carrera que me permitió adquirir experiencia en todos los roles clave de la producción audiovisual, tanto en proyectos de mayor como de menor duración. Desde siempre, mi pasión ha sido contar historias visuales.

Llevo más de 5 años creando contenido para distintas plataformas y formatos, combinando mi experiencia en la creación de reels, videos promocionales y contenido dinámico en formatos 16:9 y vertical con habilidades en grabación y edición optimizadas para redes sociales.

Actualmente, busco colaborar con empresas o equipos de manera híbrida/remota, aportando creatividad, organización y un enfoque estratégico para hacer realidad sus ideas. Soy una profesional en constante aprendizaje y disfruto trabajar en equipo, sumando valor en cada proyecto que emprendo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_60_cv_68c4a96e0dceb2.46429651.pdf',
  'cv_68c4a96e0dceb2.46429651.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68c4a96e0dceb2.46429651.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-12T23:14:54+00:00'::timestamptz,
  '2025-09-12T23:14:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  61,
  'Maria Vanesa Vastante',
  'mavivastante@gmail.com',
  '2645132381',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_61_cv_68c75671a1f121.53352133.pdf',
  'cv_68c75671a1f121.53352133.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c75671a1f121.53352133.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-14T23:57:37+00:00'::timestamptz,
  '2025-09-14T23:57:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  62,
  'José andres Escudero',
  'andyescudero2002@gmail.com',
  '02645744350',
  'Cajero/a',
  NULL,
  'Hola, un placer poder comunicarme con ustedes, soy Andrés Escudero, tengo 22 años de edad, cuento con experiencia en cajero y también en atención al cliente, cuento con una disposición horaria full time, trabajé en Niko calzados como Cajero y como vendedor, como también en Directv. En el sector de ventas telefónicas y de terreno, en ambos lugares trabajé durante 1 año.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_62_cv_68c8110eec0b68.42854243.pdf',
  'cv_68c8110eec0b68.42854243.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8110eec0b68.42854243.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:13:50+00:00'::timestamptz,
  '2025-09-15T13:13:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  63,
  'Antonella Magali Ferreyra Martinez',
  'antoferreyra097@gmail.com',
  '264',
  'Técnico superior en higiene y seguridad laboral',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_63_cv_68c8112554d457.96505961.pdf',
  'cv_68c8112554d457.96505961.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8112554d457.96505961.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:14:13+00:00'::timestamptz,
  '2025-09-15T13:14:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  64,
  'Walter Melian',
  'waltermeliancarp@gmail.com',
  '02644146166',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_64_cv_68c812bad49b87.13111246.pdf',
  'cv_68c812bad49b87.13111246.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c812bad49b87.13111246.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:20:58+00:00'::timestamptz,
  '2025-09-15T13:20:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  65,
  'Maximiliano Cortinez',
  'mcortinez1km@gmail.com',
  '2645481148',
  'Vendedor/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_65_cv_68c813d4c99967.23175920.pdf',
  'cv_68c813d4c99967.23175920.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c813d4c99967.23175920.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:25:40+00:00'::timestamptz,
  '2025-09-15T13:25:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  66,
  'Lucas',
  'lucasmirando9@gmail.com',
  '2645293933',
  'Operador/a de Mostrador',
  NULL,
  'Hola me llamo Lucas romero tengo 22 años,me encantaría trabajar para ustedes tengo experiencia de operario de producción y atención al público,soy responsable,puntual y estoy dispuesto a aprender,capacitarme y absorber todo conocimiento que sea necesario',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_66_cv_68c815a4332396.51130948.pdf',
  'cv_68c815a4332396.51130948.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c815a4332396.51130948.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:33:24+00:00'::timestamptz,
  '2025-09-15T13:33:24+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  67,
  'Ludmila Castro',
  'ludmicastrozan@gmail.com',
  '2646116973',
  'Atención al Cliente',
  NULL,
  'Soy estudiante, con ganas de aprender',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_67_cv_68c81649db2534.13697769.docx',
  'cv_68c81649db2534.13697769.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c81649db2534.13697769.docx","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:36:09+00:00'::timestamptz,
  '2025-09-15T13:36:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  69,
  'Ludmila Castro',
  'lumi35153515@gmail.com',
  '2646116973',
  'Vendedor/a',
  NULL,
  'Soy modelo, tengo buena presencia y buena comunicacion',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_69_cv_68c816dcc7aea9.25030490.docx',
  'cv_68c816dcc7aea9.25030490.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c816dcc7aea9.25030490.docx","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:38:36+00:00'::timestamptz,
  '2025-09-15T13:38:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  70,
  'Brisa Analia Flores Aballay',
  'briisaafloress800@gmail.com',
  '2645685291',
  'Atención al Cliente',
  NULL,
  'Soy una persona responsable, puntual, dedica a buscar la satisfacción del cliente para que quede conforme con la atención y con el local, educada, amigable con el personal de trabajo y con los clientes 
Buena predisposición para hacer cualquier tarea',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_70_cv_68c816ee0aba99.12809392.pdf',
  'cv_68c816ee0aba99.12809392.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c816ee0aba99.12809392.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:38:54+00:00'::timestamptz,
  '2025-09-15T13:38:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  71,
  'Lucas Vila',
  'vilalucas237@gmail.com',
  '02645631167',
  'Atención al Cliente',
  NULL,
  'Hola,soy una persona responsable, comprometido, siempre dispuesto a aprender para crecer dentro de la empresa',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_71_cv_68c8171e746430.15692545.pdf',
  'cv_68c8171e746430.15692545.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8171e746430.15692545.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:39:42+00:00'::timestamptz,
  '2025-09-15T13:39:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  72,
  'Matias Nicolás Aguilar Gómez',
  'basketballislifematias@gmail.com',
  '02644835542',
  'Vendedor/a',
  NULL,
  'Estimado/a
Me pongo en contacto con usted para expresar mi interés en formar parte de su equipo de trabajo. Adjunto a este correo encontrará mi CV y mi carta de presentación, donde detallo mi experiencia en gestión de stock, control de inventario, organización de depósitos, ventas y atención al cliente.

Creo que mi perfil puede aportar valor a su empresa, especialmente en la optimización de procesos logísticos y comerciales. Quedo a disposición para coordinar una entrevista en el horario que consideren conveniente.

Muchas gracias por su tiempo y consideración.

Atentamente, Matías Aguilar.
Rivadavia, San Juan
264 483 5542',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_72_cv_68c8172dd72843.97474931.pdf',
  'cv_68c8172dd72843.97474931.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8172dd72843.97474931.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:39:57+00:00'::timestamptz,
  '2025-09-15T13:39:57+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  73,
  'Sofia Alesandra Cortes Sutherland',
  'sofiacortes156@gmail.com',
  '2644178724',
  'Atención al Cliente',
  NULL,
  'Estimados,

Me comunico con ustedes para hacerles llegar mi postulación laboral. Adjunto a este correo encontrarán mi Currículum Vitae y carta de presentación, donde detallo mi experiencia y habilidades.

Cuento con disponibilidad full time y muchas ganas de sumarme a su equipo de trabajo.

Quedo a su disposición para coordinar una entrevista.

Saludos cordiales, Sofía Alesandra Cortes Sutherland.

Celular:  2644178724
📧 Correo: sofiacortes156@gmail.com',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_73_cv_68c819f1e28430.44683252.pdf',
  'cv_68c819f1e28430.44683252.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c819f1e28430.44683252.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:51:45+00:00'::timestamptz,
  '2025-09-15T13:51:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  74,
  'Nicolas Chavez',
  'chaveznicolas071@gmail.com',
  '2644502808',
  'Instalador/a de Cartelería',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_74_cv_68c81bbbd717b9.07842205.pdf',
  'cv_68c81bbbd717b9.07842205.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c81bbbd717b9.07842205.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T13:59:23+00:00'::timestamptz,
  '2025-09-15T13:59:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  75,
  'Santiago Yael Salinas',
  'akeye5320@gmail.com',
  '2644112132',
  'Cajero/a',
  NULL,
  'Soy sociable, responsable, disciplinado, buena presencia, me gusta hacer deportes, y soy aplicado en los estudios, y me comprometo con mis responsabilidades. Tengo mis habitos de superación. Soy reflexivo. Soy una persona educada y fiel a mis valores.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_75_cv_68c81cc4a5b010.21019130.pdf',
  'cv_68c81cc4a5b010.21019130.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c81cc4a5b010.21019130.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:03:48+00:00'::timestamptz,
  '2025-09-15T14:03:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  76,
  'Paula Micaela Achem Sánchez',
  'paulamachems@gmail.com',
  '02644448172',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_76_cv_68c8208ed07d93.14375467.pdf',
  'cv_68c8208ed07d93.14375467.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8208ed07d93.14375467.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:19:58+00:00'::timestamptz,
  '2025-09-15T14:19:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  77,
  'Alejandro Jeremias Alba',
  'jerealba@hotmail.com',
  '2 644608099',
  'Instalador/a de Cartelería',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_77_cv_68c82174477631.64733273.pdf',
  'cv_68c82174477631.64733273.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c82174477631.64733273.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:23:48+00:00'::timestamptz,
  '2025-09-15T14:23:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  78,
  'Mariano Atencio',
  'nanoatencio7@gmail.com',
  '2644445027',
  'Atención al Cliente',
  NULL,
  'Me gustaría postularme para una oportunidad en su empresa. Estoy interesado en seguir creciendo profesionalmente y creo que podría aportar valor en su equipo. Quedo a disposición por cualquier consulta. Desde ya muchas gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_78_cv_68c821b2dc9933.23860877.pdf',
  'cv_68c821b2dc9933.23860877.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c821b2dc9933.23860877.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:24:50+00:00'::timestamptz,
  '2025-09-15T14:24:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  80,
  'Mariano Atencio',
  'nanoatencio7@icloud.com',
  '2644445027',
  'Cajero/a',
  NULL,
  'Me gustaría postularme para una oportunidad en su empresa. Estoy interesado en seguir creciendo profesionalmente y creo que podría aportar valor en su equipo. Quedo a disposición por cualquier consulta. Desde ya muchas gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_80_cv_68c82229c9e911.85256896.pdf',
  'cv_68c82229c9e911.85256896.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c82229c9e911.85256896.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:26:49+00:00'::timestamptz,
  '2025-09-15T14:26:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  83,
  'Roberto Carlos Duran',
  'roberto33525870@gmail.com',
  '2645147906',
  'Vendedor/a',
  NULL,
  'Hola soy Roberto soy una persona con experiencia en ventas en diferentes puestos de ventas como atención al cliente  a manejar equipos de ventas me gusta los desafíos y demostrar mis habilidades como vendedor',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_83_cv_68c8237bc66115.36241390.pdf',
  'cv_68c8237bc66115.36241390.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8237bc66115.36241390.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:32:27+00:00'::timestamptz,
  '2025-09-15T14:32:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  84,
  'Franco Andrés Castro',
  'francocastroguy@gmail.com',
  '2646285052',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Estoy en búsqueda de nuevas oportunidades en el rubro que me apasiona',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_84_cv_68c8241998b8b5.28550849.pdf',
  'cv_68c8241998b8b5.28550849.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8241998b8b5.28550849.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:35:05+00:00'::timestamptz,
  '2025-09-15T14:35:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  85,
  'Analia Vanesa Murciano',
  'amurciano75@gmail.com',
  '2644046299',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_85_cv_68c824e3c28ec2.89082800.pdf',
  'cv_68c824e3c28ec2.89082800.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c824e3c28ec2.89082800.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:38:27+00:00'::timestamptz,
  '2025-09-15T14:38:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  86,
  'Pablo Suarez',
  'pablo24w4@gmail.com',
  '2646270957',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_86_cv_68c828c9154d31.72644411.pdf',
  'cv_68c828c9154d31.72644411.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c828c9154d31.72644411.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T14:55:05+00:00'::timestamptz,
  '2025-09-15T14:55:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  87,
  'Martin Ozan',
  'manchitaika@gmail.com',
  '2644165017',
  '...',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_87_cv_68c830bb192898.76912124.pdf',
  'cv_68c830bb192898.76912124.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c830bb192898.76912124.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T15:28:59+00:00'::timestamptz,
  '2025-09-15T15:28:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  88,
  'Malena Salinas',
  'svicmalena@gmail.com',
  '2645293423',
  'Atención al Cliente',
  NULL,
  'Hola soy Malena Salinas, me gustaría ser parte de su equipo, quisiera una oportunidad para poder demostrar que soy una buena opción para el puesto, adjunto mi cv y aguardo una respuesta,gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_88_cv_68c83155dfe852.50190944.pdf',
  'cv_68c83155dfe852.50190944.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c83155dfe852.50190944.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T15:31:33+00:00'::timestamptz,
  '2025-09-15T15:31:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  90,
  'Malena Salinas',
  'futmalebol@gmail.com',
  '2645293423',
  'Asesor/a Comercial',
  NULL,
  'Hola soy Malena Salinas, me gustaría ser parte de su equipo y espero puedan darme una oportunidad para poder demostrar mi desempeño en el área. Adjunto mi cv y aguardo una respuesta.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_90_cv_68c831fc082b16.98464111.pdf',
  'cv_68c831fc082b16.98464111.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c831fc082b16.98464111.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T15:34:20+00:00'::timestamptz,
  '2025-09-15T15:34:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  91,
  'Lucas Maximiliano Scardino Avila',
  'lu.scardino2001@gmail.com',
  '264-5872057',
  'Cajero/a',
  NULL,
  'Hola, tengo experiencia en atención al cliente, me gustaría ser cajero también o ayudante administrativo; me interesa la propuesta laboral y ser parte de su empresa. Adjunto mi currículum vitae a continuación, gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_91_cv_68c835b6adcde0.46881128.pdf',
  'cv_68c835b6adcde0.46881128.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c835b6adcde0.46881128.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T15:50:14+00:00'::timestamptz,
  '2025-09-15T15:50:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  92,
  'Jonatan Osandon',
  'yoniosandon12@gmail.com',
  '2645479795',
  'Auxiliar B mantenimiento de ilusión',
  NULL,
  'Me gustaría formar parte de su equipo soy muy responsable y puntual',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_92_cv_68c839ca96db00.66494541.pdf',
  'cv_68c839ca96db00.66494541.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c839ca96db00.66494541.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T16:07:38+00:00'::timestamptz,
  '2025-09-15T16:07:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  95,
  'Marcos Facundo Vargas Fredes',
  'marcos15vargass@gmail.com',
  '2645765260',
  'Instalador/a de Cartelería',
  NULL,
  'Hola Buenos Días, soy Marcos Vargas tengo experiencia en 2 imprentas y graficas, contando con bastante experiencia en el rubro, soy muy bueno trabajando en equipo, e realizado trabajos de cartelería con vinilos, lonas, banners, letras corpóreas y también trabajos con ploteo vehicular y de vidriera.
Tengo conocimientos en corelDraw y Adobe Ilustrator.
Estoy estudiando la Licenciatura de Sistemas de Información, que se enfoca en programación e informática, a su vez estoy estudiando por mi cuenta programación y desarrollo web, me gusta bastante la programación.
Vi el Anuncio de Trabajo y me gustaría ser parte del equipo de Plot Center.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_95_cv_68c8460539cbc8.60848569.pdf',
  'cv_68c8460539cbc8.60848569.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68c8460539cbc8.60848569.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T16:59:49+00:00'::timestamptz,
  '2025-09-15T16:59:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  96,
  'Moreno Vera Francisco Nestor Rodrigo',
  'verarodrigo2118@gmail.com',
  '2645642366',
  'Atención al Cliente',
  NULL,
  'Hola buenas Mí Nombre es Rodrigo Soy una persona muy proactiva Y tengo experiencia en diferentes condiciones de trabajo Me adapto muy rápido Me encantaría sumar más experiencia y brindar mí servicio si así fuese  desde ya muchas Gracias !',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_96_cv_68c847bc0bd102.26305344.pdf',
  'cv_68c847bc0bd102.26305344.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c847bc0bd102.26305344.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T17:07:08+00:00'::timestamptz,
  '2025-09-15T17:07:08+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  97,
  'Matias yamil Rodriguez olmos',
  'matiasyamil1996@gmail.com',
  '02645699955',
  'Cajero/a',
  NULL,
  'Me apasiona la atención al cliente, y sector ventas, cuento con referencias comprobables, me destaco por mi compromiso, mi creatividad y mi actitud proactiva para aprender constantemente. Me gusta integrar en equipos y aprender de mis compañeros',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_97_cv_68c85e4d65f333.79789094.pdf',
  'cv_68c85e4d65f333.79789094.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c85e4d65f333.79789094.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T18:43:25+00:00'::timestamptz,
  '2025-09-15T18:43:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  99,
  'Vanesa itati quiroga deonato',
  'vquiroga232@gmail.com',
  '2645096851',
  'Atención al Cliente',
  NULL,
  'Estimados/as,

Me comunico con ustedes con el fin de postularme para futuras oportunidades laborales dentro de su empresa. Adjunto a este correo encontrarán mi Currículum Vitae y carta de presentación, donde podrán conocer en detalle mi formación, experiencia y habilidades.

Quedo a su disposición para una entrevista personal en la que pueda ampliar la información sobre mi perfil y trayectoria.

Muchas gracias por su tiempo y consideración.

Atentamente, Vanesa Quiroga.

*Medios de contacto*

📱 Teléfono / WhatsApp: 2645096851

📧 Correo electrónico: vquiroga232@gmail.com

Dirección: Lima 2298 (E), Santa Lucía',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_99_cv_68c85fde1be040.49880423.pdf',
  'cv_68c85fde1be040.49880423.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c85fde1be040.49880423.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T18:50:06+00:00'::timestamptz,
  '2025-09-15T18:50:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  100,
  'Franco Yacante',
  'francoyacante@gmail.com',
  '2645269900',
  'Electricista',
  NULL,
  'Buenas tardes
Poseo basta experiencia en electricidad, iluminación led y fibra óptica, etc
Atte
Franco Yacante 
2645269900',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_100_cv_68c86a47a00b74.35315119.pdf',
  'cv_68c86a47a00b74.35315119.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68c86a47a00b74.35315119.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T19:34:31+00:00'::timestamptz,
  '2025-09-15T19:34:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  101,
  'Carrizo gabriel',
  'gabrielcarrizoo8@gmail.com',
  '2645770332',
  'Operario en fabrica de polietileno,chofer de autoelevadoresy chofer guia',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_101_cv_68c86e381912a5.09617749.pdf',
  'cv_68c86e381912a5.09617749.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c86e381912a5.09617749.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T19:51:20+00:00'::timestamptz,
  '2025-09-15T19:51:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  102,
  'Melisa Agustina Flores',
  'melisaaflores13@gmail.com',
  '2645315967',
  'Atención al Cliente',
  NULL,
  'me interesaría trabajar con ustedes ,ayudando ,haciendo crecer la empresa',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_102_cv_68c8703b32ffb4.99648207.pdf',
  'cv_68c8703b32ffb4.99648207.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8703b32ffb4.99648207.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T19:59:55+00:00'::timestamptz,
  '2025-09-15T19:59:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  103,
  'Helena Martinez',
  'helenammartinezz@gmail.com',
  '02644162309',
  'Atención al Cliente',
  NULL,
  'Estimados:
Espero que se encuentren muy bien. Me complace expresar mi interés en unirme a Plotcenter y solicitar el puesto de atención al publico.
Considero que tengo las habilidades y los conocimientos necesarios para poder formar parte de su equipo de trabajo. 

Agradezco su tiempo y atención y estoy ansiosa por la posibilidad de ser considerada para este puesto. Por favor, no duden en ponerse en contacto conmigo para cualquier información o duda.

Atentamente, 

Helena.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_103_cv_68c871df64ae74.81975415.pdf',
  'cv_68c871df64ae74.81975415.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c871df64ae74.81975415.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T20:06:55+00:00'::timestamptz,
  '2025-09-15T20:06:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  104,
  'Nahuel Jesús Zepeda',
  'nahuelzepeda900@gmail.com',
  '2644478988',
  'Instalador/a de Cartelería',
  NULL,
  'Soy muy responsable, organizando, con capacidad de resolver problemas y aportar ideas. Me gusta colaborar y tengo buena predisposición para aprender siempre cosas nuevas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_104_cv_68c88dab84dc38.39897851.pdf',
  'cv_68c88dab84dc38.39897851.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68c88dab84dc38.39897851.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T22:05:31+00:00'::timestamptz,
  '2025-09-15T22:05:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  105,
  'Marcela Ivana Muñoz',
  'munozmarcela707@gmail.com',
  '2645445757',
  'Atención al Cliente',
  NULL,
  'Me considero una persona responsable, atenta y con muy buena predisposición para ayudar a los demás. Disfruto del trato con el público, soy paciente, organizada y me adapto con facilidad a diferentes situaciones para brindar siempre la mejor atención. Tengo experiencia en atención al cliente, tanto presencial como por medios digitales. Me destaco por mi trato cordial, la escucha y la capacidad de resolver consultas de manera eficiente. Mi objetivo es ofrecer un servicio de calidad y generar una experiencia positiva en cada cliente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_105_cv_68c88e80bcdaf3.69764806.pdf',
  'cv_68c88e80bcdaf3.69764806.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c88e80bcdaf3.69764806.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T22:09:04+00:00'::timestamptz,
  '2025-09-15T22:09:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  106,
  'Daniel Lopez',
  'lopezdanielartes@gmail.com',
  '+541158567332',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_106_cv_68c8a265ca4455.68161657.pdf',
  'cv_68c8a265ca4455.68161657.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8a265ca4455.68161657.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-15T23:33:57+00:00'::timestamptz,
  '2025-09-15T23:33:57+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  107,
  'sebastian domingo',
  'sebastiansj2017@gmail.com',
  '2646258893',
  'Coordinador/a de Proyectos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_107_cv_68c8cee30be468.04283662.pdf',
  'cv_68c8cee30be468.04283662.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8cee30be468.04283662.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T02:43:47+00:00'::timestamptz,
  '2025-09-16T02:43:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  108,
  'Mariano Daniel Neyem',
  'marianoneyem32@gmail.com',
  '2644360819',
  'Atención al Cliente',
  NULL,
  'Soy responsable y con muchas ganas de trabajar',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_108_cv_68c8d9705b3667.48672794.pdf',
  'cv_68c8d9705b3667.48672794.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8d9705b3667.48672794.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T03:28:48+00:00'::timestamptz,
  '2025-09-16T03:28:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  109,
  'Francisco Daniel Flores Pizarro',
  'floresfran146@gmail.com',
  '02644439847',
  'Atención al Cliente',
  NULL,
  'Soy un chico muy responsable y puntual con todas las tareas que se me sean asignadas y los hago en tiempo y forma designada , aprendí muy rápido y busco un trabajo para poder aprender cosas nuevas y poder sustentarme con los gastos de mis estudios, espero que me puedan brindar empleo, desde ya muchísimas gracias, un saludo!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_109_cv_68c8e2010515d8.67799742.pdf',
  'cv_68c8e2010515d8.67799742.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e2010515d8.67799742.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:05:21+00:00'::timestamptz,
  '2025-09-16T04:05:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  111,
  'Francisco Daniel Flores Pizarro',
  'floresfancisco7@gmail.com',
  '02644439847',
  'Cajero/a',
  NULL,
  'Soy una persona muy responsable y puntual, hago las tareas que se me son asignadas en tiempo y forma , me gusta aprender nuevas cosas , y necesito un trabajo para poder cubrir gastos de mis estudios, actualmente estudio ingeniería alimentaria. Desde ya muchísimas gracias, un saludo!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_111_cv_68c8e31f393832.81317786.pdf',
  'cv_68c8e31f393832.81317786.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e31f393832.81317786.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:10:07+00:00'::timestamptz,
  '2025-09-16T04:10:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  112,
  'David Emanuel Vera',
  'davemvera@gmail.com',
  '2644672346',
  'Project Manager',
  NULL,
  'Puedo especificarme en varios puestos por mi capacidad tanto de ventas al publico, como gestion de proyectos, entre otro.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_112_cv_68c8e6ea007d18.03408099.pdf',
  'cv_68c8e6ea007d18.03408099.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e6ea007d18.03408099.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:26:18+00:00'::timestamptz,
  '2025-09-16T04:26:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  113,
  'David Emanuel Vera',
  'davidvera.dev@gmail.com',
  '2644672346',
  'Vendedor/a',
  NULL,
  'Soy una persona muy proactiva, que puede manejarse en diferentes puestos por mi capacidades y experiencia en el ambito publico frente a personas, clientes, etc.
Cuento con conocimientos y estudios en marketing y la experienca laboral tanto en lo fisico como online.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_113_cv_68c8e756aa9f44.79018860.pdf',
  'cv_68c8e756aa9f44.79018860.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c8e756aa9f44.79018860.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T04:28:06+00:00'::timestamptz,
  '2025-09-16T04:28:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  114,
  'Agustín Fernandez',
  'navarroagustinn144@gmail.com',
  '3515057649',
  'Atención al Cliente',
  NULL,
  'Me llamo Agustín, quisiera poder trabajar con ustedes porque me gustaría poder ayudar a mi familia y a la vez poder estudiar en una facultad, me gusta mucho trabajar en equipo, tener buenas relaciones con compañeros, me gusta poder ayudar, poder atender a la gente y brindarles la solución a sus problemas, tengo 20 años, no tengo una experiencia laboral demasiado amplia, pero si muchas ganas de poder aprender y especializarme, espero que mi perfil les interese y pueda ser parte de su empresa, muchas gracias por su atención.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_114_cv_68c941e4db76b9.47112878.pdf',
  'cv_68c941e4db76b9.47112878.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c941e4db76b9.47112878.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T10:54:28+00:00'::timestamptz,
  '2025-09-16T10:54:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  115,
  'Elias Rojas',
  'eliirojas57@gmail.com',
  '02645185162',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_115_cv_68c96e00bf1ca0.06247634.pdf',
  'cv_68c96e00bf1ca0.06247634.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c96e00bf1ca0.06247634.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T14:02:40+00:00'::timestamptz,
  '2025-09-16T14:02:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  116,
  'Mayra Ailen Marcuzzi Garcia',
  'ailengarcia843@gmail.com',
  '02646629523',
  'Community Manager',
  NULL,
  'Soy técnica en Marketing, me recibí hace poco y estoy buscando mi primera experiencia laboral.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_116_cv_68c98e68652236.64689535.pdf',
  'cv_68c98e68652236.64689535.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c98e68652236.64689535.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T16:20:56+00:00'::timestamptz,
  '2025-09-16T16:20:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  118,
  'Mayra Ailen Marcuzzi Garcia',
  'mayramar2002@gmail.com',
  '02646629523',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_118_cv_68c98ebc6da519.90219258.pdf',
  'cv_68c98ebc6da519.90219258.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c98ebc6da519.90219258.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T16:22:20+00:00'::timestamptz,
  '2025-09-16T16:22:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  120,
  'Gonzalo Enrique Gárate Peralta',
  'garategonzalo298@gmail.com',
  '2644551603',
  'Cajero/a',
  NULL,
  'Tengo 27 años, soy estudiante de derecho, tengo conocimiento en diseño y experiencia en atención al público en el área comercio, como vendedor y facturador.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_120_cv_68c99fa8e19237.29129968.pdf',
  'cv_68c99fa8e19237.29129968.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c99fa8e19237.29129968.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T17:34:32+00:00'::timestamptz,
  '2025-09-16T17:34:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  121,
  'Carla Campillay',
  'carlacampillay77@gmail.com',
  '2645119173',
  'Cajero/a',
  NULL,
  'Buenas! Soy Carla Campillay y estoy dispuesta a formar parte de su equipo, tengo mucha experiencia en atención al publico, como vendedora y como cajera. 
Actualmente no estoy trabajando, espero poder quedar. 
Gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_121_cv_68c9a0f1470031.15004092.pdf',
  'cv_68c9a0f1470031.15004092.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c9a0f1470031.15004092.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T17:40:01+00:00'::timestamptz,
  '2025-09-16T17:40:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  122,
  'Mayra Fredes',
  'fredemayra@gmail.com',
  '2645057710',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_122_cv_68c9bee30b6ca5.25001489.pdf',
  'cv_68c9bee30b6ca5.25001489.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c9bee30b6ca5.25001489.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T19:47:47+00:00'::timestamptz,
  '2025-09-16T19:47:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  123,
  'Facundo Martin Miranda Troncoso',
  'mirandafacundo31@gmail.com',
  '2646310528',
  'Operario/a de Impresión',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_123_cv_68c9d3f5820da1.92350766.pdf',
  'cv_68c9d3f5820da1.92350766.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68c9d3f5820da1.92350766.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-16T21:17:41+00:00'::timestamptz,
  '2025-09-16T21:17:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  124,
  'Fernando Javier Atencia',
  'fernandoatenciamontero@gmail.com',
  '2646251127',
  'Administrativo/a de Personal',
  NULL,
  'Hola soy Fernando Atencia, tengo 45 años de la provincia de San Juan. Trabaje en negocios de repuestos, en ocasa San Juan como jefe de deposito y
me desempeñe durante muchos años en una empresa familiar, fabricabamos productos de copetin y Tostabamos Café, también tuve supermercado, hace algunos años atrás cerramos por problemas de la economía del País. 
Trabaje durante muchos años como Locutor de radio hasta ahora en la actualidad en Rock & Pop San Juan.
Desde el 2016 hasta enero del 2025 trabajé en la dirección de Publicidad de la Municipalidad de la ciudad de San Juan, a cargo de la parte de Antenas de Telecomunicaciones.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_124_cv_68ca081e4d2580.94415439.pdf',
  'cv_68ca081e4d2580.94415439.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ca081e4d2580.94415439.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-17T01:00:14+00:00'::timestamptz,
  '2025-09-17T01:00:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  125,
  'Facundo Nahuel Pizarro',
  'facundopizarro.drive@gmail.com',
  '2645194154',
  'Cualquier puesto acorde a mis experiencias, habilidades y demás. Tengo facilidad para adaptarme a las situaciones y aprender rápidamente en cada una de ellas.',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_125_cv_68ca0ed6bdb2c4.37763207.pdf',
  'cv_68ca0ed6bdb2c4.37763207.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ca0ed6bdb2c4.37763207.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-17T01:28:54+00:00'::timestamptz,
  '2025-09-17T01:28:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  126,
  'David Fernando Cruz Martinez',
  'davidfernandocruz2020@gmail.com',
  '2645161069',
  'Instalador/a de Cartelería',
  NULL,
  'Soy una persona muy trabajadora, me gustan los desafios. Puedo resolver problemas y tengo experiencia en trabajo en equipo y en multiples areas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_126_cv_68cac001f03191.16297011.docx',
  'cv_68cac001f03191.16297011.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cac001f03191.16297011.docx","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-17T14:04:50+00:00'::timestamptz,
  '2025-09-17T14:04:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  127,
  'Garcia Micaela Agostina',
  'gmicaela207@gmail.com',
  '02644041946',
  'Asistente Administrativo/a',
  NULL,
  'Soy estudiante de desarrollo web, me encuentro haciendo cursos constantemente para nutrir mis habilidades informáticas. Tengo disponibilidad horaria y que me encuentro cursando la etapa final de la carrera con 4 materias para finalizar, y es todo virtual.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_127_cv_68cac7245b2a23.67735919.pdf',
  'cv_68cac7245b2a23.67735919.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cac7245b2a23.67735919.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-17T14:35:16+00:00'::timestamptz,
  '2025-09-17T14:35:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  128,
  'Fabio Gonzalez',
  'ab.fabiogonzalez@gmail.com',
  '2645198717',
  'Generalista de RRHH',
  NULL,
  'Soy abogado independiente. En la especialidad Laboral - Civilista. Profesor de Derecho Laboral en Instituto Superior Cervantes. Tengo capacidad de liderazgo y soy un apasionado de mi profesión.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_128_cv_68cb1259240340.96811629.pdf',
  'cv_68cb1259240340.96811629.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cb1259240340.96811629.pdf","migrated_at":"2026-06-09T11:23:49.252Z"}'::jsonb,
  '2025-09-17T19:56:09+00:00'::timestamptz,
  '2025-09-17T19:56:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  129,
  'Tomás Hernán López Márquez',
  'tomi.lopez.1097@gmail.com',
  '2645313228',
  'Asistente Administrativo/a',
  NULL,
  'Soy estudiante avanzado de la licenciatura en Comunicación Social en etapa de elaboración de tesis. Quisiera sumarme al equipo de trabajo con el fin de poner a prueba mis conocimientos y capacidades.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_129_cv_68cb20c3ecee82.12832791.pdf',
  'cv_68cb20c3ecee82.12832791.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cb20c3ecee82.12832791.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-17T20:57:39+00:00'::timestamptz,
  '2025-09-17T20:57:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  130,
  'Morena Salinas',
  'moreesalinas22@gmail.com',
  '2645639037',
  'Atención al Cliente',
  NULL,
  'Hola! Soy Morena, estudiante de Publicidad. Busco desarrollarme en atención al cliente y poder aportar mis conocimientos. Me encanta la idea de seguir aprendiendo y creciendo con ustedes.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_130_cv_68cb2689b95c71.13212148.pdf',
  'cv_68cb2689b95c71.13212148.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cb2689b95c71.13212148.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-17T21:22:17+00:00'::timestamptz,
  '2025-09-17T21:22:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  131,
  'Eliana Peralta',
  'peraltaeliana213@gmail.com',
  '2645769381',
  'Atención al Cliente',
  NULL,
  'Me llamo Eliana me gusta trabajar aprendo rápido me adapto a los cambios trabajar en equipo y resolver problemas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_131_cv_68cb613253fd56.75478615.pdf',
  'cv_68cb613253fd56.75478615.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cb613253fd56.75478615.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-18T01:32:34+00:00'::timestamptz,
  '2025-09-18T01:32:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  132,
  'Norberto Emanuel Jaled Capdevila',
  'emanueljaled73@gmail.com',
  '2645221222',
  'Cualquier puesto vacante.',
  NULL,
  'Buen día estimada/o, le comunico que no seleccioné una opción puntual de puesto en su empresa por que eran varias las de mi interés, también con el motivo de estar disponible a capacitarme ante cualquier propuesta laboral posible, saludos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_132_cv_68cc0e0c7f8306.88593926.pdf',
  'cv_68cc0e0c7f8306.88593926.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cc0e0c7f8306.88593926.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-18T13:50:04+00:00'::timestamptz,
  '2025-09-18T13:50:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  133,
  'Claudio Leandro Gamboa',
  'claudioyayogambo@gmail.com',
  '2645760509',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_133_cv_68cc3f596e7444.48118063.pdf',
  'cv_68cc3f596e7444.48118063.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cc3f596e7444.48118063.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-18T17:20:25+00:00'::timestamptz,
  '2025-09-18T17:20:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  135,
  'Alexis Herrera',
  'alexisherrerank57@gmail.com',
  '2646621720',
  'Atención al cliente, Diseñador Gráfico Junior, Operario de Impresión, Operador de mostrador , Asistente Administrativo, Cajero',
  NULL,
  'Que tal buenas tardes, adjunto mi cv por interés a trabajar en su empresa. Mi postulación a los puestos mencionados antes es porque, tengo una rapida adaptación y actualmente tengo experiencia en los puestos mencionados. Quedo a disposición. (Full Time) Gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_135_cv_68cddf3ed5f713.74586511.pdf',
  'cv_68cddf3ed5f713.74586511.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68cddf3ed5f713.74586511.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-19T22:54:54+00:00'::timestamptz,
  '2025-09-19T22:54:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  136,
  'Delfina Estrada Catania',
  'cataniadelfina0710@gmail.com',
  '2644881664',
  '.',
  NULL,
  'Estoy interesada en cualquier puesto que este disponible y me permita trabajar y desarrollar mis habilidades mientras voy aprendiendo a la vez.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_136_cv_68ced52e556922.15367723.pdf',
  'cv_68ced52e556922.15367723.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ced52e556922.15367723.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-20T16:24:14+00:00'::timestamptz,
  '2025-09-20T16:24:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  137,
  'Matias Damian Pasten Vedia',
  'matipasten1234@gmail.com',
  '2644103853',
  'Atención al Cliente',
  NULL,
  'Me gusta mucho capacitarme constante en lo que sea, actualmente estoy haciendo un curso de Community Manager. Soy de interactuar mucho con las personas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_137_cv_68d005e369c1f6.29990912.pdf',
  'cv_68d005e369c1f6.29990912.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d005e369c1f6.29990912.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-21T14:04:19+00:00'::timestamptz,
  '2025-09-21T14:04:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  138,
  'Natalia Avila',
  'avilanatalia.sj@gmail.com',
  '264 468 4666',
  'Asistente Administrativo/a',
  NULL,
  'Me caracterizo por mi compromiso, capacidad de adaptación y ganas constantes de aprender. Busco seguir desarrollándome en entornos dinámicos dónde pueda aportar valor y seguir creciendo profesionalmente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_138_cv_68d00785951d75.91811563.pdf',
  'cv_68d00785951d75.91811563.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d00785951d75.91811563.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-21T14:11:17+00:00'::timestamptz,
  '2025-09-21T14:11:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  141,
  'Agustin Ameglio',
  'agusameglio17@gmail.com',
  '2644754328',
  'Técnico/a en Instalaciones',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_141_cv_68d024a1718b55.88282729.pdf',
  'cv_68d024a1718b55.88282729.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68d024a1718b55.88282729.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-21T16:15:29+00:00'::timestamptz,
  '2025-09-21T16:15:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  142,
  'Micaela Giménez',
  'gimenezmicaela199@gmail.com',
  '2645544679',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_142_cv_68d34d3b801577.93396957.pdf',
  'cv_68d34d3b801577.93396957.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d34d3b801577.93396957.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-24T01:45:31+00:00'::timestamptz,
  '2025-09-24T01:45:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  143,
  'Jesuana Falcón',
  'jesuanafalcon10@gmail.com',
  '2645053719',
  'Asistente Administrativo/a',
  NULL,
  'Me considero una persona dinámica, me adapto rápido al cambioy tengo aspiraciones de crecer personal y profesionalmente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_143_cv_68d3e1fe582b68.39551670.pdf',
  'cv_68d3e1fe582b68.39551670.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d3e1fe582b68.39551670.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-24T12:20:14+00:00'::timestamptz,
  '2025-09-24T12:20:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  144,
  'Carlos Gabriel Peralta Decimo',
  'carlosperalta.1920@gmail.com',
  '2645544441',
  'Atención al Cliente',
  NULL,
  'Buenas, mi nombre es Carlos, me gusta la idea de poder asumir nuevos desafíos en otros rubros, soy proactivo y atento, espero poder quedar, desde ya muchas gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_144_cv_68d42f70ec5751.68140980.pdf',
  'cv_68d42f70ec5751.68140980.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d42f70ec5751.68140980.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-24T17:50:40+00:00'::timestamptz,
  '2025-09-24T17:50:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  145,
  'Paula Estefania Badillo Robledo',
  'paulabadillo28@gmail.com',
  '2644543807',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_145_cv_68d58017687d80.04498751.pdf',
  'cv_68d58017687d80.04498751.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68d58017687d80.04498751.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-25T17:47:03+00:00'::timestamptz,
  '2025-09-25T17:47:03+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  146,
  'Norberto osvaldo Benitez',
  'norber.benitez@gmail.com',
  '2645190404',
  'Asistente Administrativo/a',
  NULL,
  'Adjunto cv para ser evaluado segun mi perfil
 Saludos atte  Norberto',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_146_cv_68d6982c586e09.89008083.pdf',
  'cv_68d6982c586e09.89008083.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d6982c586e09.89008083.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-26T13:42:04+00:00'::timestamptz,
  '2025-09-26T13:42:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  147,
  'Sergio Daniel',
  'danielcarp900@gmail.com',
  '2645484396',
  'Electricista',
  NULL,
  'Soy electricista con más de 13 años de experiencia tanto industrial de línea como monofásica',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_147_cv_68d855a03623e5.16417514.pdf',
  'cv_68d855a03623e5.16417514.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d855a03623e5.16417514.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-27T21:22:40+00:00'::timestamptz,
  '2025-09-27T21:22:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  148,
  'Ana Beatriz Grasset',
  'beatrizgrasset@gmail.com',
  '2644623855',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_148_cv_68d8b5ca6ed7c3.87698748.pdf',
  'cv_68d8b5ca6ed7c3.87698748.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d8b5ca6ed7c3.87698748.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-28T04:12:58+00:00'::timestamptz,
  '2025-09-28T04:12:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  149,
  'Ruben Dario Valero Blanco',
  'ruben_valero12@hotmail.com',
  '1171106835',
  'Ingeniero/a Industrial',
  NULL,
  'Soy Ingeniero Industrial Especialista en Ingeniería de Mantenimiento con amplia Experiencia Planificando, Dirigiendo y
Controlando procesos productivos en la Industria Automotriz, Petróleo, Minería, Manufactura y Servicios. Excelentes
habilidades de Liderazgo, Organización y Comunicación, Sólidos Conocimientos Técnicos en Equipos Móviles de Minería
(CAT, Komatsu, Hitachi, Liebherr), Profundo conocimiento de Normas de Seguridad y Cumplimiento Minero, Experiencia
demostrable en Plataformas ERP como SAP, JD Edwards. Solidos Conocimientos en Practicas de Monitoreo de Condiciones
y Mantenimiento Centrado en Confiabilidad (RCM)

Actualmente resido en Salta con total disposición a realizar cambio de residencia 

Mi WhatsApp. :  +54 1171106835

Saludos

Ruben Valero',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_149_cv_68d9ad23dbc038.53889178.pdf',
  'cv_68d9ad23dbc038.53889178.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68d9ad23dbc038.53889178.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-28T21:48:19+00:00'::timestamptz,
  '2025-09-28T21:48:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  150,
  'Micaela González',
  'cg0202784@gmail.com',
  '02644991390',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_150_cv_68daceafb558d9.84755816.pdf',
  'cv_68daceafb558d9.84755816.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68daceafb558d9.84755816.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-29T18:23:43+00:00'::timestamptz,
  '2025-09-29T18:23:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  151,
  'Cristian Cortez',
  'cortescristian494@gmail.com',
  '2645526019',
  'Electricista',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_151_cv_68dc381e36cda1.17385078.pdf',
  'cv_68dc381e36cda1.17385078.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68dc381e36cda1.17385078.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-09-30T20:05:50+00:00'::timestamptz,
  '2025-09-30T20:05:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  154,
  'Alexis Herrera',
  'alexisherrerank75@gmail.com',
  '2646621720',
  'Atención al Cliente',
  NULL,
  'Que tal buen día, adjunto mi cv',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_154_cv_68e3d995c863c7.07666889.pdf',
  'cv_68e3d995c863c7.07666889.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e3d995c863c7.07666889.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-06T15:00:37+00:00'::timestamptz,
  '2025-10-06T15:00:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  155,
  'Juan Jesus Emanuel Garro',
  'emmanuelgarro221@gmail.com',
  '2644471267',
  'Asesor/a Comercial',
  NULL,
  'Hola soy Emanuel GARRO, Técnico Químico, tengo 19 años, Me encantaría trabajar con ustedes, y aprender en el proceso, Estoy dispuesto a los periodos de prueba y en disposición de ustedes; desde ya Muchas Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_155_cv_68e5a5051aba41.46733681.pdf',
  'cv_68e5a5051aba41.46733681.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e5a5051aba41.46733681.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-07T23:40:53+00:00'::timestamptz,
  '2025-10-07T23:40:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  157,
  'Juan Jesus Emanuel Garro',
  'garroemmanuel76@gmail.com',
  NULL,
  'Vendedor/a',
  NULL,
  'Hola soy Emanuel GARRO, Técnico Químico, tengo 19 años, Me encantaría trabajar con ustedes, y aprender en el proceso, Estoy dispuesto a los periodos de prueba y en disposición de ustedes; desde ya Muchas Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_157_cv_68e5a543071290.90176563.pdf',
  'cv_68e5a543071290.90176563.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e5a543071290.90176563.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-07T23:41:55+00:00'::timestamptz,
  '2025-10-07T23:41:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  158,
  'Rugani Luciano',
  'ruganiluciano@gmail.com',
  '2645808955',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_158_cv_68e6e3b0c21cd4.49437350.pdf',
  'cv_68e6e3b0c21cd4.49437350.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e6e3b0c21cd4.49437350.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-08T22:20:32+00:00'::timestamptz,
  '2025-10-08T22:20:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  159,
  'Ludmila Yanet Zubiete Coll',
  'ludmilazubiete0804@gmail.com',
  '2644463691',
  'Atención al Cliente',
  NULL,
  'A lo largo de los últimos años he adquirido experiencia en distintas áreas, tanto en entornos administrativos como en atención al cliente, cocina y espacios públicos. Me considero una persona trabajadora, creativa y comprometida, con muchas ganas de aprender y crecer en el ámbito laboral.
Desde ya muchas gracias por la oportunidad y su tiempo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_159_cv_68e7bb8d139692.75165078.pdf',
  'cv_68e7bb8d139692.75165078.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e7bb8d139692.75165078.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-09T13:41:33+00:00'::timestamptz,
  '2025-10-09T13:41:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  160,
  'Cristian Adrian Fonzalida',
  'cristian.adrianfonza@gmail.com',
  '02645644441',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Buenas tardes! Me dirijo a ustedes en solicitud de presentarme para ser parte de su equipo. Sería un placer formar parte de una empresa con crecimiento y trayectoria el cual me daría la posibilidad de exponer mi potencial. Saludos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_160_cv_68e7f9e7a66b84.59602116.pdf',
  'cv_68e7f9e7a66b84.59602116.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68e7f9e7a66b84.59602116.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-09T18:07:35+00:00'::timestamptz,
  '2025-10-09T18:07:35+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  161,
  'Ayelén Manrique',
  'ayelendiciembre15@gmail.com',
  '2644507090',
  'Atención al Cliente',
  NULL,
  '¡Hola! Mi nombre es Ayelén Manrique, soy estudiante de arquitectura y tengo conocimientos de programas de diseño, además también he trabajado en atención al cliente y me considero proactiva y responsable.

Espero que puedan considerar mi perfil para trabajar con ustedes! Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_161_cv_68e800e1d18d15.90095235.pdf',
  'cv_68e800e1d18d15.90095235.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e800e1d18d15.90095235.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-09T18:37:21+00:00'::timestamptz,
  '2025-10-09T18:37:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  162,
  'Fabricio Tejada',
  'workozsj@gmail.com',
  '+542644182680',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Soy excelente en la atención al público, me encanta tomar nota y trabajar cada proyecto bajo el método lógico ( fin, objetivos, componentes y actividades) conozco la empresa y tengo una gran cantidad de pedidos para stickers, folletos, vinilos y carteleras. (Al final de mi curriculum verán un qr, que tiene mi portfolio con mis maneras de trabajar y proyectar ideas)',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_162_cv_68e8088df39766.99137633.pdf',
  'cv_68e8088df39766.99137633.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68e8088df39766.99137633.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-09T19:10:06+00:00'::timestamptz,
  '2025-10-09T19:10:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  163,
  'Carla Noriega',
  'noriegacarla201@gmail.com',
  '+54 9 264 627-5518',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Hola, mi nombre es Carla, soy recibida de Diseñadora de la Unsj, con experiencia en diseño para redes y diseño para impresión, adjunto mi cv con link a mi portafolio
Desde ya, muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_163_cv_68e81fd50ab033.26024212.pdf',
  'cv_68e81fd50ab033.26024212.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68e81fd50ab033.26024212.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-09T20:49:25+00:00'::timestamptz,
  '2025-10-09T20:49:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  164,
  'Agustín Federico Cueto González',
  'agustincueto007@gmail.com',
  '02645487051',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Hola Buenas, ya tuve una entrevista con ustedes hace unos meses, y sigo estando a disposición para sumarme al equipo.
Tengo un Portfolio con trabajos realizados que puedo enviarles si lo necesitan.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_164_cv_68e843609f37e2.53107154.pdf',
  'cv_68e843609f37e2.53107154.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Contratado","legacy_cv_ruta":"uploads/cv/cv_68e843609f37e2.53107154.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-09T23:21:04+00:00'::timestamptz,
  '2025-10-09T23:21:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  165,
  'Sergio Blanco',
  'sergio11.smb@gmail.com',
  '2645055125',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Buenas! Mi nombre es Sergio soy diseñador gráfico con experiencia en redes, branding y actualmente incursionando en diseño UI. 
https://www.behance.net/sergiomblanco',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_165_cv_68e844d15f0346.85376580.pdf',
  'cv_68e844d15f0346.85376580.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e844d15f0346.85376580.pdf","migrated_at":"2026-06-09T11:23:49.254Z"}'::jsonb,
  '2025-10-09T23:27:13+00:00'::timestamptz,
  '2025-10-09T23:27:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  167,
  'Daniel Lopez',
  'daniellopz719@gmail.com',
  '1158567332',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Soy diseñador gráfico con varios años de experiencia en branding, ilustración digital, diseño y manejo de redes sociales. Me apasiona crear piezas visuales que comuniquen con claridad y estilo. He trabajado tanto de forma independiente como en empresas, desarrollando proyectos que combinan estrategia y creatividad. Busco seguir creciendo profesionalmente y aportar valor con mi conocimiento en diseño y marketing visual.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_167_cv_68e8f847ce98f4.07982467.pdf',
  'cv_68e8f847ce98f4.07982467.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e8f847ce98f4.07982467.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-10T12:12:55+00:00'::timestamptz,
  '2025-10-10T12:12:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  168,
  'Cesar Gonzalez',
  'cesar.dago97@gmail.com',
  '2644052118',
  'Técnico/a en Diseño',
  NULL,
  'Puedo ejecutar el diseño, proyección y realización de piezas gráficas en cualquier formato. Me encuentro en la última instancia de la lic en Artes Visuales',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_168_cv_68e930e4e55c52.50772267.pdf',
  'cv_68e930e4e55c52.50772267.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e930e4e55c52.50772267.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-10T16:14:28+00:00'::timestamptz,
  '2025-10-10T16:14:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  171,
  'Cesar Gonzalez',
  'chulengos1312@gmail.com',
  '02644052118',
  'Instalador/a de Cartelería',
  NULL,
  'Tengo las capacidades para poder proyectar, diseñar y ejecutar todo tipo de pieza grafica. Habilidades en el area de taller. Estoy en la última instancia de la Lic en Artes Visuales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_171_cv_68e93254971a29.64214581.pdf',
  'cv_68e93254971a29.64214581.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e93254971a29.64214581.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-10T16:20:36+00:00'::timestamptz,
  '2025-10-10T16:20:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  172,
  'María Natacha Fernandez',
  'fernandeznatacha86@gmail.com',
  '2645656374',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Me dedico al diseño grafico desde los 25 años. Especialmente trabajos para imprenta y editorial. Diagramación de libros de autores sanjuaninos y manuales de estudio para la UNSJ Ciencias Sociales',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_172_cv_68e9b24aa0f375.27221708.pdf',
  'cv_68e9b24aa0f375.27221708.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68e9b24aa0f375.27221708.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-11T01:26:34+00:00'::timestamptz,
  '2025-10-11T01:26:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  173,
  'Ivana Vega',
  'ivanavega1977@gmail.com',
  '02644154396',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Soy Diseñadora Gráfica recibida, con más de diez años de experiencia en identidad visual, diseño corporativo y producción gráfica.
A lo largo de mi trayectoria desarrollé proyectos para vía pública, packaging e indumentaria, siempre uniendo creatividad, estrategia y conocimiento técnico.
Desde 2014 dirijo Alvanaguardia Producciones, mi emprendimiento independiente, donde acompaño a marcas y emprendedores en el desarrollo de su imagen visual.
He dictado capacitaciones sobre diseño de packaging avaladas por la Unión Industrial de San Juan y el Ministerio de Economía y Familia, y complementé mi formación con una Diplomatura en Innovación Abierta (UTN) y un curso sobre Nuevas Tecnologías aplicadas al Diseño (Virtuality Argentina). Cuento con dominio de herramientas vectoriales y una sólida formación en preprensa y adaptación de archivos para producción e impresión.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_173_cv_68eae53903dc65.80499790.pdf',
  'cv_68eae53903dc65.80499790.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68eae53903dc65.80499790.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-11T23:16:09+00:00'::timestamptz,
  '2025-10-11T23:16:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  176,
  'Diego Molas',
  'poligondesign@protonmail.com',
  '2645745885',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_176_cv_68ed14aa567d95.84440557.pdf',
  'cv_68ed14aa567d95.84440557.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68ed14aa567d95.84440557.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-13T15:03:06+00:00'::timestamptz,
  '2025-10-13T15:03:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  177,
  'Tamara Avalos Barraza',
  'tamara.avalos.92@gmail.com',
  '+5492646123500',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  '¡Hola! Adjunto mi CV para su base de datos. Soy diseñadora gráfica con experiencia en identidad visual, diseño editorial y redes sociales. Me encantaría formar parte de futuros proyectos y aportar mi creatividad al equipo. Quedo a disposición ante cualquier oportunidad acorde a mi perfil.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_177_cv_68ed343edd6912.16581591.pdf',
  'cv_68ed343edd6912.16581591.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68ed343edd6912.16581591.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-13T17:17:50+00:00'::timestamptz,
  '2025-10-13T17:17:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  178,
  'Francisco Benito',
  'franben147@gmail.com',
  '02644654666',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Soy técnico en diseño gráfico, me recibo en el Instituto Superior Fundación Universitas. 
Tengo manejo en el paquete de Adobe, especialmente en Photoshop e Illustrator.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_178_cv_68ed61b04ea191.03910342.pdf',
  'cv_68ed61b04ea191.03910342.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68ed61b04ea191.03910342.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-13T20:31:44+00:00'::timestamptz,
  '2025-10-13T20:31:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  179,
  'Mariana giselle',
  'marianagiselle6405@gmail.com',
  '2645044497',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Hola! Buenas tardes, recien veo la publicación de ustedes por instagram.
Les adjunto mi Cv, desde ya muchas gracias por su tiempo!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_179_cv_68ed65bd10e671.93719238.pdf',
  'cv_68ed65bd10e671.93719238.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68ed65bd10e671.93719238.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-13T20:49:01+00:00'::timestamptz,
  '2025-10-13T20:49:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  180,
  'Agostina Manrique',
  'agostinamanrique.16@gmail.com',
  '2645053961',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Adjunto enlace de behance con mis trabajos. Gracias 

https://www.behance.net/lagosm',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_180_cv_68ed9cbf61bfc8.59187735.pdf',
  'cv_68ed9cbf61bfc8.59187735.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68ed9cbf61bfc8.59187735.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-14T00:43:43+00:00'::timestamptz,
  '2025-10-14T00:43:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  181,
  'Octavio Francisco Carrizo Dávila',
  'oc92carrizodavila@gmail.com',
  '2645107952',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_181_cv_68edbd8c222606.88375207.pdf',
  'cv_68edbd8c222606.88375207.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68edbd8c222606.88375207.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-14T03:03:40+00:00'::timestamptz,
  '2025-10-14T03:03:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  182,
  'Gonzalo Silveyra',
  'gonzasilveyra23@gmail.com',
  '2644575574',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_182_cv_68edc6b609d0f6.96958307.pdf',
  'cv_68edc6b609d0f6.96958307.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_68edc6b609d0f6.96958307.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-14T03:42:46+00:00'::timestamptz,
  '2025-10-14T03:42:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  184,
  'Antonieta Quevedo',
  'antonietaquevedo@gmail.com',
  '2664854197',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Diseño gráfico o cajera',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_184_cv_68ee2c9560db05.64262708.pdf',
  'cv_68ee2c9560db05.64262708.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ee2c9560db05.64262708.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-14T10:57:25+00:00'::timestamptz,
  '2025-10-14T10:57:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  186,
  'Yamila Heredia',
  'estudiocreativoyh@gmail.com',
  '2646269628',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_186_cv_68ee512774fd09.47460140.pdf',
  'cv_68ee512774fd09.47460140.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68ee512774fd09.47460140.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-14T13:33:27+00:00'::timestamptz,
  '2025-10-14T13:33:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  187,
  'Sebastián Torres',
  'torresjsebastian10@gmail.com',
  '2644041911',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_187_cv_68ef12fa25bca4.04780270.pdf',
  'cv_68ef12fa25bca4.04780270.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68ef12fa25bca4.04780270.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-15T03:20:27+00:00'::timestamptz,
  '2025-10-15T03:20:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  188,
  'Emiliano Correa',
  'emilianocorrea.mkt@gmail.com',
  '264 418 7788',
  'Diseñador Gráfico',
  NULL,
  'Mi nombre es Emiliano Correa, Técnico en Diseño y Animación Digital.
Estoy en busca de trabajo y teniendo en cuenta los requisitos que solicitan, considero que
tengo el perfil adecuado para ocupar la vacante.
Uno de mis principales objetivos es seguir desarrollando mis habilidades en el área de Diseño y MKT, ya que considera que es fundamental para el éxito en el campo actual. Además, me gustaría trabajar en proyectos que me permitan aplicar estrategias innovadoras y creativas para alcanzar y superar los objetivos de la empresa. También busco crecer profesionalmente dentro de la compañía, asumiendo mayores responsabilidades a medida que contribuyo al éxito del equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_188_cv_68efb5d99f0565.34382265.pdf',
  'cv_68efb5d99f0565.34382265.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68efb5d99f0565.34382265.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-15T14:55:21+00:00'::timestamptz,
  '2025-10-15T14:55:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  189,
  'Melisa Belén Romero',
  'meli.belenr@gmail.com',
  '2644639571',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Hola, soy Melisa, diseñadora gráfica con experiencia en identidades visuales para diferentes rubros. Trabajé de forma freelance y como colaboradora en Freepik. Me gustaría sumarme a Plot Center para seguir creciendo y aportando al equipo.
Acá pueden ver mis trabajos https://melibelen.myportfolio.com',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_189_cv_68efea321985a7.03666697.pdf',
  'cv_68efea321985a7.03666697.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68efea321985a7.03666697.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-15T18:38:42+00:00'::timestamptz,
  '2025-10-15T18:38:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  190,
  'Jose Agustin Bigliani Guzman',
  'agubigliani@gmail.com',
  '2647433945',
  'Cualquiera',
  NULL,
  'Buenas tardes, mi nombre es Agustin Bigliani y estoy interesado en trabajar con ustedes en cualquier puesto disponible.
Cuento con experiencia como diseñador gráfico y community manager en RRSS para mi anterior compañía y un portfolio con algunos diseños.
Soy un traductor de inglés con especialización en localización con ganas de adentrarme en un sueño creativo y aprender nuevas habilidades.
Quedo a su disposición.

Saludos cordiales,
Agustín Bigliani.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_190_cv_68effdcde948e9.16427935.pdf',
  'cv_68effdcde948e9.16427935.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68effdcde948e9.16427935.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-15T20:02:21+00:00'::timestamptz,
  '2025-10-15T20:02:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  192,
  'Francisco Navarro',
  'francisconavarro.94@hotmail.com',
  '2644179935',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Hola, buenas tardes.
Mi nombre es Francisco, soy diseñador gráfico y me interesa postularme al puesto publicado.
Cuento con experiencia en identidad visual, diseño de packaging, promoción y difusión.
Me gusta trabajar en equipo, compartir ideas y aprender de cada experiencia. En cada proyecto busco aportar creatividad, compromiso y seguir creciendo como diseñador, porque creo que donde hay una necesidad, siempre hay una oportunidad para lograr resultados de calidad que transmitan identidad y coherencia visual.

Pueden ver algunos de mis trabajos en mi Instagram: @fran_navaok

¡Muchas gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_192_cv_68f2d48c4c29f5.99284523.pdf',
  'cv_68f2d48c4c29f5.99284523.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Contratado","legacy_cv_ruta":"uploads/cv/cv_68f2d48c4c29f5.99284523.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-17T23:43:08+00:00'::timestamptz,
  '2025-10-17T23:43:08+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  193,
  'Agustin Cueto',
  'cueto277@gmail.com',
  '2645487051',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_193_cv_68f64d7bcf0563.55200838.pdf',
  'cv_68f64d7bcf0563.55200838.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68f64d7bcf0563.55200838.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-20T14:55:55+00:00'::timestamptz,
  '2025-10-20T14:55:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  194,
  'Fernando Ariel Guevara',
  'fernandoarielguevara@gmail.com',
  '264 584-4564',
  'Asesor/a Comercial',
  NULL,
  'Amplía experiencia en el rubro gráfico.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_194_cv_68f8e13e864f99.70071042.pdf',
  'cv_68f8e13e864f99.70071042.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68f8e13e864f99.70071042.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-22T13:50:54+00:00'::timestamptz,
  '2025-10-22T13:50:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  195,
  'Mara Anahi Leiva',
  'maraleiva15@gmail.com',
  '2644368798',
  'Vendedor/a',
  NULL,
  'estoy interesada en el puesto espero poder demostrar mi capacidad y mi buena onda adjunto mi currículum desde ya muchas gracias por su atención',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_195_cv_68f8f71880e546.15599076.pdf',
  'cv_68f8f71880e546.15599076.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68f8f71880e546.15599076.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-22T15:24:08+00:00'::timestamptz,
  '2025-10-22T15:24:08+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  197,
  'Mara Anahi Leiva',
  'impresionesarii12@gmail.com',
  '2644368798',
  'Atención al Cliente',
  NULL,
  'estoy interesada en el puesto espero poder demostrar mi capacidad y mi buena onda adjunto mi currículum desde ya muchas gracias por su atención',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_197_cv_68f8f74f69ac11.55084704.pdf',
  'cv_68f8f74f69ac11.55084704.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68f8f74f69ac11.55084704.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-22T15:25:03+00:00'::timestamptz,
  '2025-10-22T15:25:03+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  198,
  'Carlos Emmanuel Vera',
  'emmanuelleprins@gmail.com',
  '02644630674',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Estimado/a,

Le hago llegar mi CV para su consideración, con el interés de formar parte de su equipo como Diseñador Gráfico.
Quedo a disposición para ampliar información o coordinar una entrevista.

Muchas gracias por su tiempo y atención.
Saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_198_cv_68f9168cac6948.89846384.pdf',
  'cv_68f9168cac6948.89846384.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_68f9168cac6948.89846384.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-22T17:38:20+00:00'::timestamptz,
  '2025-10-22T17:38:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  199,
  'Agustin Adrian Sánchez Navarro',
  'agustinljd9898@gmail.com',
  '2645571086',
  'Instalador/a de Cartelería',
  NULL,
  'Tengo experiencia en colocación de vinilos impreso , de corte , tensado de lona , colocación de letras corpóreos , colocación de polarizados,espejados!!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_199_cv_68f9468de05341.29538316.pdf',
  'cv_68f9468de05341.29538316.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68f9468de05341.29538316.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-22T21:03:09+00:00'::timestamptz,
  '2025-10-22T21:03:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  202,
  'Ayelén Manrique',
  'sa.manrique15@gmail.com',
  '02644507090',
  'Cajero/a',
  NULL,
  'ME CONSIDERO RESPONSABLE, TENGO EXPERIENCIA EN MANEJO DE CAJA Y HACE DOS MIL AÑOS QUE PLOTEO EN PLOTCENTER ASI QUE CONFIO EN LA CALIDAD DE EMPRESA QUE SON Y ME GUSTARIA FORMAR PARTE DEL EQUIPO',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_202_cv_68f948b803e0a3.76850813.pdf',
  'cv_68f948b803e0a3.76850813.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68f948b803e0a3.76850813.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-22T21:12:24+00:00'::timestamptz,
  '2025-10-22T21:12:24+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  203,
  'Glenda Daniela Ortega Olarte',
  'danielaortegaolarte18@gmail.com',
  '2644419960',
  'Administrativo/a de Personal',
  NULL,
  'Mi nombre es Daniela Ortega, termine de cursar la carrera Licenciatura de Administración de Empresas, me gustan los desafíos y los entornos dinámicos que me permitan desarrollar y aprender nuevas habilidades. Tengo 27 años.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_203_cv_68fa27b62f9bc5.51219506.pdf',
  'cv_68fa27b62f9bc5.51219506.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68fa27b62f9bc5.51219506.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-23T13:03:50+00:00'::timestamptz,
  '2025-10-23T13:03:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  204,
  'Gastón Gomez Vargas',
  'gastycf@gmail.com',
  '264 610-2010',
  'Vendedor/a',
  NULL,
  'Experiencia en ventas, atención al cliente y cajero
Dispuesto a aprender nuevas técnicas y sistemas para progresar',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_204_cv_68fb95df4b7341.52669538.pdf',
  'cv_68fb95df4b7341.52669538.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_68fb95df4b7341.52669538.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-24T15:06:07+00:00'::timestamptz,
  '2025-10-24T15:06:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  205,
  'Jorge Mauricio Robles Rubio',
  'mauricioroblesr98@gmail.com',
  '2645558154',
  'Atención al Cliente',
  NULL,
  'Full time con disponibilidad de horarios de rotación. Resido en Capital, muy cerca del Plot Center (a 2 cuadras). Experiencia en Atención al Cliente, Cotizaciones y Ventas tanto presencial como online.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_205_cv_6900e2c609fcc4.40918298.pdf',
  'cv_6900e2c609fcc4.40918298.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6900e2c609fcc4.40918298.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-28T15:35:34+00:00'::timestamptz,
  '2025-10-28T15:35:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  207,
  'Alejandro Balmaceda',
  'alebalmaceda24@gmail.com',
  '2646193182',
  'Técnico/a en Instalaciones',
  NULL,
  'Trabajo hace 7 años asiendo gráfica experto en ploteo,tensado de lona, se soldar ,instalar Carteles y demás trabajo particular pero me aria falta algo más fijo...',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_207_cv_69010952251397.30919178.pdf',
  'cv_69010952251397.30919178.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69010952251397.30919178.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-28T18:20:02+00:00'::timestamptz,
  '2025-10-28T18:20:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  208,
  'Enzo Fernández',
  'enzofer3805@gmail.com',
  '2644839120',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_208_cv_6902283e2ea056.99206459.pdf',
  'cv_6902283e2ea056.99206459.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6902283e2ea056.99206459.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T14:44:14+00:00'::timestamptz,
  '2025-10-29T14:44:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  210,
  'Eugenia Tejada',
  'eugenia.tejada.09@gmail.com',
  '02644644605',
  'Analista de Marketing',
  NULL,
  'Me gustaría postularme tanto para el puesto de analista de marketing como para Community Manager. Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_210_cv_69023699d82e73.57878270.pdf',
  'cv_69023699d82e73.57878270.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69023699d82e73.57878270.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T15:45:29+00:00'::timestamptz,
  '2025-10-29T15:45:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  211,
  'Matias Edgar Herrera Calderón',
  'mherrera.171045@gmail.com',
  '02646625571',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_211_cv_690236d8e2d025.73256266.docx',
  'cv_690236d8e2d025.73256266.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690236d8e2d025.73256266.docx","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T15:46:32+00:00'::timestamptz,
  '2025-10-29T15:46:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  212,
  'Cinthia Otiñano',
  'cinthiaoti04@gmail.com',
  '2645152767',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_212_cv_69027b186becb7.82079919.pdf',
  'cv_69027b186becb7.82079919.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69027b186becb7.82079919.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T20:37:44+00:00'::timestamptz,
  '2025-10-29T20:37:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  213,
  'Jimena Agustina Olivera',
  'jimenaolivera862@gmail.com',
  '02644505109',
  'Atención al Cliente',
  NULL,
  'Me postulo a este ojesto de trabajo ya que tengo mucha experiencia en ventas, tanto de productos tangibles como de productos o servicios intangibles. Tengo conocimientos con respecto a esta área. Estoy dispuesta a a seguir aprendido y adquiriendo herramientas en otras áreas también. Me considero una persona muy empatada y comprometida con el trabajo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_213_cv_69027bb4c7b260.00495423.pdf',
  'cv_69027bb4c7b260.00495423.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69027bb4c7b260.00495423.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T20:40:20+00:00'::timestamptz,
  '2025-10-29T20:40:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  214,
  'Lucas Videla',
  'lucasvidela167@gmail.com',
  '02646136709',
  'Soldador/a',
  NULL,
  'Buenas tardes me dedico a la soldadora montaje y trabajos en taller metalúrgico a . Tanto liviano como pesado .  Procesos swaw . Mig mag semiautomática fcaw.  Y herramientas de taller  enviar mensaje de WhatsApp o llamadas al celular 2646136709',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_214_cv_6902908d2a2093.84156415.pdf',
  'cv_6902908d2a2093.84156415.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6902908d2a2093.84156415.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T22:09:17+00:00'::timestamptz,
  '2025-10-29T22:09:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  215,
  'Martin Calixto Milla Watrin',
  'martinmilla489@gmail.com',
  '2645272979',
  'Vendedor/a',
  NULL,
  'Me gustaría ingresar a esta comunidad, demostrar mis conocimientos y aprender sobre todo. Soy un trabajador que se desenvuelve en escenarios difíciles y adversos y como saber cómo solucionar el problema. Poder emplear mis capacidades como la disciplina, compriso y compañerismo que aplico a la hora de trabajar. Atentamente Martin!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_215_cv_690295b4992ab9.78528033.pdf',
  'cv_690295b4992ab9.78528033.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690295b4992ab9.78528033.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T22:31:16+00:00'::timestamptz,
  '2025-10-29T22:31:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  216,
  'Micaela Soledad',
  'solee.guinazu0907@icloud.com',
  '2645886783',
  'Asistente Administrativo/a',
  NULL,
  'Me adapto rápido.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_216_cv_6902aa5b4fe352.32463436.pdf',
  'cv_6902aa5b4fe352.32463436.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6902aa5b4fe352.32463436.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-29T23:59:23+00:00'::timestamptz,
  '2025-10-29T23:59:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  217,
  'Maria del Valle Garcia',
  'vallegarcia40@hotmail.com',
  '2644628380',
  'Administrativo/a Contable',
  NULL,
  'Me considero una persona responsable, ordenada con pasion en tareas administrativas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_217_cv_6902b1d61c1ea3.76575692.pdf',
  'cv_6902b1d61c1ea3.76575692.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6902b1d61c1ea3.76575692.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T00:31:18+00:00'::timestamptz,
  '2025-10-30T00:31:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  219,
  'Nahuel Jesús Zepeda',
  'pierantonellifederico2@gmail.com',
  '2644478988',
  'Operador/a de Mostrador',
  NULL,
  'Hola, soy Nahuel, me considero una persona proactiva, con ganas de crecer, me interesa mucho aprender cosas nuevas y demostrar mis conocimientos, soy detallista y me gusta realizar mis tareas lo mejor posible. Tengo habilidad para realizar labores a mano y resolver problemas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_219_cv_6902bf31a1b0f5.21612783.pdf',
  'cv_6902bf31a1b0f5.21612783.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6902bf31a1b0f5.21612783.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T01:28:17+00:00'::timestamptz,
  '2025-10-30T01:28:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  220,
  'Agostina Elizondo',
  'agoselizondo142002@gmail.com',
  '2644677306',
  'Community Manager',
  NULL,
  'Hola ! Soy Agostina Elizondo, Técnica en Marketing Digital , me considero proactiva, organizada y orientada a resultados, siempre buscando generar valor en cada espacio que ocupo. A lo largo de mi carrera, he liderado equipos, gestionado operaciones comerciales y desarrollado estrategias digitales que mejoraron el posicionamiento de marcas. Creo que el compromiso, la iniciativa y la capacidad de adaptación son esenciales para crecer dentro de una organización, y esas son mis principales cualidades. Mi objetivo es unirme a una empresa o institución donde pueda seguir aprendiendo, enfrentar nuevos desafíos y contribuir al logro de los objetivos, ya que creo que el trabajo bien hecho transforma realidades y me apasiona ser parte de esos procesos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_220_cv_6903697683ea46.08374381.pdf',
  'cv_6903697683ea46.08374381.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6903697683ea46.08374381.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T13:34:46+00:00'::timestamptz,
  '2025-10-30T13:34:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  221,
  'Melani Natalia Guzmán Polisotto',
  'melaniguzman.07@gmail.com',
  '2645071534',
  'Community Manager',
  NULL,
  'Hola Buenas tardes, les dejo mi currículum por el anuncio del puesto laboral. Me manejo mucho con las redes sociales, me gusta mucho la fotografías, el editar videos y armarlos. Estoy a disposición. Muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_221_cv_69036adb524e47.97858694.pdf',
  'cv_69036adb524e47.97858694.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69036adb524e47.97858694.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T13:40:43+00:00'::timestamptz,
  '2025-10-30T13:40:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  222,
  'Zahira Araceli Muñoz Poblete',
  'zahira43423203@gmail.com',
  '2644701068',
  'Community Manager',
  NULL,
  'Me recibí de community manager y también tengo conocimientos de trafficker digital (anuncios en meta ads), sé llevar anuncios en google ads, creación de branding y  contenido autentico y llamativo. 
Tengo 24 años y muchas ganas de crecer tanto profesional como personalmente. Si hay posibilidad de aplicar para otro puesto tengo capacidad de aprendizaje rápido. 
Quedo atenta a su respuesta.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_222_cv_690374004d6b98.20803294.pdf',
  'cv_690374004d6b98.20803294.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690374004d6b98.20803294.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T14:19:44+00:00'::timestamptz,
  '2025-10-30T14:19:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  223,
  'Santiago Leonel Rodriguez',
  'samtycarp@gmail.com',
  '264 441-3103',
  'Cajero/a',
  NULL,
  'Tengo 7 años de experiencia en atención al público, caja, trámites bancarios y trato con proveedores. Estaba a cargo de ventas y reposición.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_223_cv_690374e054fe47.58882272.pdf',
  'cv_690374e054fe47.58882272.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690374e054fe47.58882272.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T14:23:28+00:00'::timestamptz,
  '2025-10-30T14:23:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  225,
  'Juan Jesus Emanuel Garro',
  'familiagarrooficial@gmail.com',
  '02644471267',
  'Community Manager',
  NULL,
  'Hola, soy Emanuel Garro, me encantaría trabajar con ustedes, mi disponibilidad es full time; y aprendo muy rápido',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_225_cv_69038fa2489983.84507211.pdf',
  'cv_69038fa2489983.84507211.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69038fa2489983.84507211.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T16:17:38+00:00'::timestamptz,
  '2025-10-30T16:17:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  226,
  'Thiago Benjamin Cepeda',
  'cepedathiago390@gmail.com',
  '02646304145',
  'Community Manager',
  NULL,
  'Hola! Soy Thiago, actualmente estudiando Comunnity Manager y Marketing Digital, estoy en busca de empleo y nuevas experiencias, tal vez no sepa alguna que otra cosa, pero puedo esforzarme para aprender todo lo que sea necesario.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_226_cv_69039923083751.25127057.pdf',
  'cv_69039923083751.25127057.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69039923083751.25127057.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T16:58:11+00:00'::timestamptz,
  '2025-10-30T16:58:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  228,
  'Lisandro Suarez',
  'lisandro458845@gmail.com',
  '2645508843',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_228_cv_6903a54c67c6f8.62976584.pdf',
  'cv_6903a54c67c6f8.62976584.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6903a54c67c6f8.62976584.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T17:50:04+00:00'::timestamptz,
  '2025-10-30T17:50:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  229,
  'Eduardo Rosales',
  'eduroscar96@gmail.com',
  '2645262182',
  'Desarrollador/a Frontend',
  NULL,
  'Buenas tardes mi nombre es Eduardo Rosales, Técnico en Informática con experiencia en Desarrollo Web y conocimientos en Marketing Digital. Me enfoco en crear soluciones web innovadoras y efectivas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_229_cv_6903b82a2b52a7.30992139.pdf',
  'cv_6903b82a2b52a7.30992139.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6903b82a2b52a7.30992139.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-30T19:10:34+00:00'::timestamptz,
  '2025-10-30T19:10:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  230,
  'Montero Florencia',
  'florenciamontero2001@gmail.com',
  '2644048492',
  'Community Manager',
  NULL,
  'Hola! soy Flor Montero, community manager, muy proactiva y muy decidida a seguir aprendiendo, estoy dispuesta a realizar todas las tareas que sean necesarias! Me sigo formando todos los meses porque creo que en este rubro uno nunca termina de aprender.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_230_cv_69040d9a7fc841.94536443.pdf',
  'cv_69040d9a7fc841.94536443.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69040d9a7fc841.94536443.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T01:15:06+00:00'::timestamptz,
  '2025-10-31T01:15:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  231,
  'Ana González',
  'anagon161228@gmail.com',
  '+5492644440050',
  'Community Manager',
  NULL,
  'Soy Ana González, Social Media Manager y Community Manager con experiencia en la gestión estratégica de redes sociales, creación de contenido, planificación mensual y campañas publicitarias en Meta, Google y TikTok. Me especializo en desarrollar estrategias digitales orientadas a resultados, fortaleciendo la identidad de marca y mejorando la conexión con el público. Me encantaría formar parte del equipo de Plot Center para aportar mi experiencia y potenciar su presencia online.
https://a-ámba.my.canva.site/ana-gonzalez',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_231_cv_69041be76b7fa1.09732311.pdf',
  'cv_69041be76b7fa1.09732311.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69041be76b7fa1.09732311.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T02:16:07+00:00'::timestamptz,
  '2025-10-31T02:16:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  232,
  'Sofía Gimena Rojas Pereyra',
  'sofiagimenarojas@gmail.com',
  '2645685679',
  'Community Manager',
  NULL,
  'Mi perfil se alinea con la producción de contenido visual atractivo y estratégico . Cuento con habilidades en la toma y edición de fotografía y video, dominio de herramientas de diseño. Soy capaz de generar contenido que no solo se ve bien, sino que está respaldado por nociones de marketing digital.

Agradezco su tiempo y consideración.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_232_cv_69043176483a29.14777716.pdf',
  'cv_69043176483a29.14777716.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69043176483a29.14777716.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T03:48:06+00:00'::timestamptz,
  '2025-10-31T03:48:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  233,
  'Matias López',
  'matiaslopez4305@gmail.com',
  '2644654751',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_233_cv_690488ea1e7ab2.51770265.pdf',
  'cv_690488ea1e7ab2.51770265.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690488ea1e7ab2.51770265.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T10:01:14+00:00'::timestamptz,
  '2025-10-31T10:01:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  234,
  'Jazmin Bergara',
  'ariloujabergara@gmail.com',
  '02644897660',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_234_cv_6904acb4610fb3.95660837.pdf',
  'cv_6904acb4610fb3.95660837.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904acb4610fb3.95660837.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T12:33:56+00:00'::timestamptz,
  '2025-10-31T12:33:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  235,
  'Tomas Jesús Deusedas',
  'deusedastomas@gmail.com',
  '2645259325',
  'Community Manager',
  NULL,
  'Buenos días, me presento soy Tomás Deusedas tengo amplio conocimiento en varios puestos la mayoría en marketing y ventas además de tareas administrativas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_235_cv_6904ba282ca0b1.79605866.pdf',
  'cv_6904ba282ca0b1.79605866.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904ba282ca0b1.79605866.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T13:31:20+00:00'::timestamptz,
  '2025-10-31T13:31:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  236,
  'Tania Macarena Lambarri Páez',
  'tanialambarri@gmail.com',
  '2644843730',
  'Community Manager',
  NULL,
  'Mucho gusto. Además del seleccionado, también aplico a puestos como: Atención al cliente/ Operador de mostrador/ Analista de Marketing/ Vendedor y Asesor comercial. Tengo predisposición, enfoque y ganas de crecer, en lo personal y profesional, adaptando el marketing a cada área posible para potenciarla y expandirla. Desde ya, gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_236_cv_6904ec05d55da3.76146372.pdf',
  'cv_6904ec05d55da3.76146372.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904ec05d55da3.76146372.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T17:04:05+00:00'::timestamptz,
  '2025-10-31T17:04:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  237,
  'Tania Figueroa',
  'taniafigmoncunill@gmail.com',
  '2645754322',
  'Community Manager',
  NULL,
  'Buenas! Poseo conocimientos y experiencia como cm, y nociones básicas de diseño gráfico como también en administración y atención. 
Actualmente tengo disponibilidad full time. 
Aclaro que el cv está desactualizado, ya no trabajo en Dione debido a su cierre.
Gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_237_cv_6904f2abf361b9.02824931.pdf',
  'cv_6904f2abf361b9.02824931.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6904f2abf361b9.02824931.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-10-31T17:32:27+00:00'::timestamptz,
  '2025-10-31T17:32:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  238,
  'Aixa Yazmin Zabala Avila',
  'aixazabalayazmin@gmail.com',
  '2644517700',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_238_cv_69064a81370955.85089175.pdf',
  'cv_69064a81370955.85089175.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69064a81370955.85089175.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-01T17:59:29+00:00'::timestamptz,
  '2025-11-01T17:59:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  239,
  'Brian Vladimir Cortes Cortes Aguirre',
  'briacortes2@gmail.com',
  '02644881322',
  'Gerente General',
  NULL,
  'Buen día, estimado, espero que se encuentre bien.

Soy Brian Vladimir, Administrador Financiero Gerencial, con amplia trayectoria liderando la gestión financiera de tres empresas en los sectores minero, petrolero, industrial y comercial, tanto para el ámbito público como privado, a nivel nacional e internacional. Mi enfoque combina un análisis financiero riguroso con el desarrollo de estrategias de crecimiento y eficiencia, respaldado por un equipo de profesionales especializados.

Le adjunto mi currículum, donde detallo mi experiencia internacional en Dubai, ASIA y la coordinación con proveedores en China, Brasil y Chile.

Actualmente me encuentro trabajando en FULLBACK en el área de Producción y estoy buscando nuevas oportunidades.

¿Podríamos coordinar una reunión para conversar sobre cómo aportar valor a su organización?

Quedo a la espera de su respuesta.

Saludos cordiales,
Brian Vladimir Cortes Aguirre
M A16969',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_239_cv_69075369542ba1.74672721.pdf',
  'cv_69075369542ba1.74672721.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69075369542ba1.74672721.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-02T12:49:45+00:00'::timestamptz,
  '2025-11-02T12:49:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  240,
  'Emilio Rodriguez',
  'rodriguezemilio95@gmail.com',
  '+5492645467808',
  'Gerente de Marketing',
  NULL,
  'Soy Licenciado en Marketing con sólida experiencia liderando estrategias omnicanal, campañas de performance y posicionamiento de marca en sectores como consumo masivo, retail, tecnología y servicios. Me especializo en generar crecimiento medible, liderar equipos multidisciplinarios y optimizar inversiones publicitarias a través de un enfoque analítico, creativo y orientado a resultados.
Actualmente dirijo Rowth, mi consultora de marketing 360, desde donde acompaño a empresas y equipos en procesos de transformación digital, branding y expansión comercial.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_240_cv_69081983830778.99587055.pdf',
  'cv_69081983830778.99587055.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69081983830778.99587055.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-03T02:54:59+00:00'::timestamptz,
  '2025-11-03T02:54:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  241,
  'Angel Molina',
  'angelformal09@gmail.com',
  '2644436695',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_241_cv_6909434096d255.14346209.pdf',
  'cv_6909434096d255.14346209.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6909434096d255.14346209.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T00:05:20+00:00'::timestamptz,
  '2025-11-04T00:05:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  242,
  'Larisa Sanchez',
  'larisanchez96@gmail.com',
  '2645324129',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_242_cv_69097539726c41.90245558.docx',
  'cv_69097539726c41.90245558.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69097539726c41.90245558.docx","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T03:38:33+00:00'::timestamptz,
  '2025-11-04T03:38:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  244,
  'Rocio celeste lampasona',
  'celestelampasona@gmail.com',
  '2644826895',
  'Vendedor/a',
  NULL,
  'Soy Técnica en educación profesional, esta carrera tiene salida laboral en administración, también estudio abogacía, tengo diplomado en marketing digital, higiene y seguridad. Tengo experiencia en ventas, soy responsable, me adapto rápido al entorno laboral y me capacitó por mejorar mis habilidades 
Muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_244_cv_690a31b9a5beb6.43994703.pdf',
  'cv_690a31b9a5beb6.43994703.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_690a31b9a5beb6.43994703.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T17:02:49+00:00'::timestamptz,
  '2025-11-04T17:02:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  245,
  'Carolina Pereyra',
  'carop2005@gmail.com',
  '2920 607463',
  'Generalista de RRHH',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_245_cv_690a49050f40b8.94547681.pdf',
  'cv_690a49050f40b8.94547681.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690a49050f40b8.94547681.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T18:42:13+00:00'::timestamptz,
  '2025-11-04T18:42:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  246,
  'Lourdes Gaya',
  'zattalourdes921@gmail.com',
  '2645608504',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Hola soy Lourdes, estudiante avanzada de diseño gráfico.Me interesa encontrar un puesto donde pueda cumplir mis horas de pasantías en la FAUD, pero también busco ganar experiencia profesional.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_246_cv_690a67ce471c63.17103869.pdf',
  'cv_690a67ce471c63.17103869.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_690a67ce471c63.17103869.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T20:53:34+00:00'::timestamptz,
  '2025-11-04T20:53:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  248,
  'Lourdes Gaya',
  'lourdeszatttta@gmail.com',
  '2645608504',
  'Community Manager',
  NULL,
  'Hola soy Lourdes, estudiante avanzada de diseño gráfico. Actualmente trabajo generando contenido para ProLab marketing digital, me gustaría encontrar un puesto en el que pueda cumplir mis horas de pasantías para la FAUD pero tambien expandir mis conocimientos y ganar experiencia laboral.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_248_cv_690a686030d372.26405940.pdf',
  'cv_690a686030d372.26405940.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690a686030d372.26405940.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-04T20:56:00+00:00'::timestamptz,
  '2025-11-04T20:56:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  249,
  'ludmila Martínez',
  'luluu301605@gmail.com',
  '2645651685',
  'Atención al Cliente',
  NULL,
  'Mi nombre es Ludmila Martinez tengo 20 años, soy de Rawson pero cuento con movilidad para trasladarme, mi experiencia laboral se basa en más de 4 años de atención al cliente, en mi último trabajo más en tareas administrativas y manejo de redes sociales y publicidad (Meta) 
Este año tuve una pausa por motivos académicos, pero nunca dejé de trabajar ya que tenemos un pequeño negocio familiar y en eso me mantuve este año, actualmente mi cursado en la facultad termino, por lo que tengo disponibilidad full time',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_249_cv_690aed96621bd5.39786556.pdf',
  'cv_690aed96621bd5.39786556.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690aed96621bd5.39786556.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-05T06:24:22+00:00'::timestamptz,
  '2025-11-05T06:24:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  250,
  'Julieta Reynoso',
  'julietaludmila20@icloud.com',
  '2644044140',
  'Community Manager',
  NULL,
  'me manejo muy bien con todo lo que sea marketing es algo q me gusta y me llama la atención aprender cada dia mas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_250_cv_690b9aab1bef83.20127651.pdf',
  'cv_690b9aab1bef83.20127651.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_690b9aab1bef83.20127651.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-05T18:42:51+00:00'::timestamptz,
  '2025-11-05T18:42:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  251,
  'Ismael garay',
  'yuthielgaray02@gmail.com',
  '2645014039',
  'Atención al Cliente',
  NULL,
  'Hola mi nombre es ismael garay busco trabajo urgente me gustaria pertenecer a su equipo de trabajo para tener una mejor vida para mi y para mi hijo estoy dispuesto a aprender para sumar mas conocimiento a mi vida laboral espero respuestas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_251_cv_690ba01dbbcdf1.86946570.pdf',
  'cv_690ba01dbbcdf1.86946570.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_690ba01dbbcdf1.86946570.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-05T19:06:05+00:00'::timestamptz,
  '2025-11-05T19:06:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  252,
  'Vega Barraza Celina Milagros',
  'milagrosvega0204@icloud.com',
  '2645556728',
  'Community Manager',
  NULL,
  'Hola, buenas tardes.
Adjunto mi CV para postularme al puesto de Community Manager.
Quedo a disposición para una entrevista.
Muchas gracias.
Saludos cordiales,
Milagros Vega.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_252_cv_690ba253b17421.33586625.pdf',
  'cv_690ba253b17421.33586625.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690ba253b17421.33586625.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-05T19:15:31+00:00'::timestamptz,
  '2025-11-05T19:15:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  253,
  'Selena Martínez',
  'selenart74@gmail.com',
  '2645818169',
  'Cajero/a',
  NULL,
  'Buenas tardes, me encuentro en búsqueda laboral, con incorporación inmediata, quedo a su disposición, muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_253_cv_690ba35a94c9a7.25701103.pdf',
  'cv_690ba35a94c9a7.25701103.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690ba35a94c9a7.25701103.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-05T19:19:54+00:00'::timestamptz,
  '2025-11-05T19:19:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  254,
  'Luis Rolando García',
  'garcia.l.r@hotmail.com',
  '02644143618',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_254_cv_690be17d94d5a3.43795542.pdf',
  'cv_690be17d94d5a3.43795542.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_690be17d94d5a3.43795542.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-05T23:45:01+00:00'::timestamptz,
  '2025-11-05T23:45:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  255,
  'Alesis Jonatan Rivas D''Angelo',
  'alesisrivasdangelo@gmail.com',
  '2646300464',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_255_cv_690cab86c604a5.75985545.pdf',
  'cv_690cab86c604a5.75985545.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_690cab86c604a5.75985545.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-06T14:07:02+00:00'::timestamptz,
  '2025-11-06T14:07:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  257,
  'Alesis Jonatan Rivas D''Angelo',
  'alesiscastrojonatan@gmail.com',
  '2646300464',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_257_cv_690caba58a4784.24292629.pdf',
  'cv_690caba58a4784.24292629.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_690caba58a4784.24292629.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-06T14:07:33+00:00'::timestamptz,
  '2025-11-06T14:07:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  258,
  'Angel Torres',
  'isgoog7@gmail.com',
  '2644626008',
  'Community Manager',
  NULL,
  'Hola, ¿cómo están?
No cuento con un CV formal, pero actualmente administro más de 10 cuentas de Instagram como Community Manager y Ads Manager. Puedo mostrar mi trabajo y mis conocimientos en persona.

Me dedico a la creación de contenido y a la gestión integral de redes sociales para empresas. Además, soy desarrollador web con más de 7 años de experiencia y más de 30 sitios desarrollados por mi cuenta.

Algunas de las marcas con las que trabajo aquí en San Juan son:

El Rey del Copetín
El Palacio de la Milanesa
Matería Premium
Coquitos, entre otras más.

Me encantaría formar parte de su equipo. Trabajo de manera independiente, ofreciendo mis servicios de forma personalizada.
Lamento no poder mostrar todo mi potencial por este medio, pero sería un placer presentarme en persona y demostrarlo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_258_cv_690e0658a27b65.49110520.pdf',
  'cv_690e0658a27b65.49110520.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_690e0658a27b65.49110520.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-07T14:46:48+00:00'::timestamptz,
  '2025-11-07T14:46:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  259,
  'Maria Victoria Pantano Diaz',
  'mvpdiaz48@gmail.com',
  '2646626677',
  'Asistente Administrativo/a',
  NULL,
  'Técnica en Biología, fotógrafa y artista en tiempos libres. Me interesa trabajar en el ambiente para poder aprender y entender más sobre el ambiente gráfico. Proactividad y predisposición para mejorar día a día.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_259_cv_691347a40f1432.04291674.pdf',
  'cv_691347a40f1432.04291674.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_691347a40f1432.04291674.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-11T14:26:44+00:00'::timestamptz,
  '2025-11-11T14:26:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  260,
  'Daniela reta',
  'danisole82@gmail.com',
  '2645042782',
  'Desarrollador/a Frontend',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_260_cv_691642b53429e7.71344428.pdf',
  'cv_691642b53429e7.71344428.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_691642b53429e7.71344428.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-13T20:42:29+00:00'::timestamptz,
  '2025-11-13T20:42:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  261,
  'Nicolas J Diaz',
  'nicodiazjg@gmail.com',
  '2644810103',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_261_cv_691731b7e90680.89785781.pdf',
  'cv_691731b7e90680.89785781.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_691731b7e90680.89785781.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-14T13:42:15+00:00'::timestamptz,
  '2025-11-14T13:42:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  262,
  'Montanaro, Costanza Carla Michela',
  'cotymontanaro@gmail.com',
  '2644043827',
  'Community Manager',
  NULL,
  'Hola, soy Costanza Montanaro, tengo 22 años y soy estudiante avanzada de la Lic. en Comunicación Social. Cuento con algunas pequeñas experiencias de trabajo detalladas en mi currículum, también estos últimos años de la carrera aprendí a usar cámaras, luces y programas de diseño. Tengo conocimientos básicos en herramientas digitales como: Premier, Indesign, Photoshop, Canva, CapCut, Excel, Word, Y Power Point.
Actualmente estoy buscando un trabajo de medio tiempo que me permita expandir mi creatividad y estoy entusiasmada por vivir nuevos aprendizajes.
Gracias por su atención, saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_262_cv_6917a020dc4b18.51863594.pdf',
  'cv_6917a020dc4b18.51863594.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6917a020dc4b18.51863594.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-14T21:33:20+00:00'::timestamptz,
  '2025-11-14T21:33:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  263,
  'Esteband Diaz',
  'cesteband@gmail.com',
  '02645690163',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_263_cv_691b321b5570f5.14819292.pdf',
  'cv_691b321b5570f5.14819292.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_691b321b5570f5.14819292.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-17T14:32:59+00:00'::timestamptz,
  '2025-11-17T14:32:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  264,
  'Elías Jofré',
  'eliasivanjofretorres@gmail.com',
  '2646261180',
  'Administrativo/a Contable',
  NULL,
  'Hola! Soy una persona proactiva, me gustan los nuevos desafíos y formar parte de un equipo para aportar al logro de resultados colectivos e individuales, me considero una persona con habilidades de liderazgo, responsabilidad, apuesto mucho al trabajo en equipo y tengo experiencia en puestos que me han permitido adquirir logros y habilidades importantes para sumar herramientas para el logro eficiente de objetivos. En mi Cv podrán observar a detalle mi experiencia y formación universitaria, como así también mis conocimientos en sistemas de gestión.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_264_cv_691b3db2074586.12472634.pdf',
  'cv_691b3db2074586.12472634.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_691b3db2074586.12472634.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-17T15:22:26+00:00'::timestamptz,
  '2025-11-17T15:22:26+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  265,
  'Ignacio fuentes',
  'ignafuentes723@gmail.com',
  '2645314996',
  'Cajero/a',
  NULL,
  'Poseo experiencia en el sector de caja y ventas. También tengo conocimiento en informática y algo de diseño.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_265_cv_691b94dcbad995.37262170.pdf',
  'cv_691b94dcbad995.37262170.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_691b94dcbad995.37262170.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-17T21:34:20+00:00'::timestamptz,
  '2025-11-17T21:34:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  268,
  'Valentina Victoria Correa Caro',
  'valencorrea429@gmail.com',
  '2645247220',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Estoy en el último año de la carrera de Diseño Gráfico, por ende tengo gran disponibilidad y bastante conocimiento gracias a ello, sobre los requisitos que piden y me encantaría trabajar con ustedes!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_268_cv_691cb5f24a7100.18563357.pdf',
  'cv_691cb5f24a7100.18563357.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_691cb5f24a7100.18563357.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-18T18:07:46+00:00'::timestamptz,
  '2025-11-18T18:07:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  269,
  'Vera Evelin Sabrina',
  'evylauty25@gmail.com',
  '2644449116',
  'Cajero/a',
  NULL,
  'Profesional comprometido y orientado a resultados, con capacidad para adaptarse rápidamente a nuevos entornos y aportar soluciones eficientes. Destaco por mi responsabilidad, organización y disposición para el aprendizaje continuo. Busco oportunidades para contribuir con mis habilidades y seguir creciendo profesionalmente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_269_cv_691dda6ee60f94.17833045.docx',
  'cv_691dda6ee60f94.17833045.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_691dda6ee60f94.17833045.docx","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-19T14:55:42+00:00'::timestamptz,
  '2025-11-19T14:55:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  270,
  'Samira Hadad',
  'hadadsamira94@gmail.com',
  '02644126682',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_270_cv_691e4285692f78.23725142.pdf',
  'cv_691e4285692f78.23725142.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_691e4285692f78.23725142.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-19T22:19:49+00:00'::timestamptz,
  '2025-11-19T22:19:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  275,
  'Guzmán Cuevas Gabriel Agustín',
  'ag208000@gmail.com',
  '2646706440',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_275_cv_6924c38c3ed621.19920534.pdf',
  'cv_6924c38c3ed621.19920534.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6924c38c3ed621.19920534.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-24T20:43:56+00:00'::timestamptz,
  '2025-11-24T20:43:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  276,
  'Cynthia Ibazeta',
  'cintiagalaz192@gmail.com',
  '264-4172582',
  'Atención al Cliente',
  NULL,
  'Me llamo Cynthia Ibazeta, tengo 22 años y tengo bachiller en Ciencias Sociales y Humanidades cuento con analítico en mano , actualmente cursando la Tecnicatura en Higiene y Seguridad Laboral. He trabajado en atención al público, gestión de almacén, limpieza y como niñera, siempre destacándome por mi puntualidad, responsabilidad y buena relación con los clientes.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_276_cv_6926fad067ff68.89062905.pdf',
  'cv_6926fad067ff68.89062905.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6926fad067ff68.89062905.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T13:04:16+00:00'::timestamptz,
  '2025-11-26T13:04:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  277,
  'Gonzalo Gimenez',
  'gonzagimenez.gg19@gmail.com',
  '2645699628',
  'Administrativo/a de Personal',
  NULL,
  'Hola, soy una persona organizada, responsable y con muchas ganas de seguir creciendo. Tengo experiencia en tareas administrativas y manejo avanzado de Excel, Word y otras herramientas del paquete Office. También cuento con conocimientos en AutoCAD. Me adapto rápido, me gusta trabajar en equipo y siempre trato de aportar buenas ideas y buena onda en el lugar de trabajo. Busco una oportunidad donde pueda seguir aprendiendo y sumar valor desde mi experiencia.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_277_cv_6926fd429cfd73.42937182.pdf',
  'cv_6926fd429cfd73.42937182.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6926fd429cfd73.42937182.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T13:14:42+00:00'::timestamptz,
  '2025-11-26T13:14:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  279,
  'Julian camargo',
  'juliancamargo910@gmail.com',
  '2645402848',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_279_cv_6927022b01c741.70368046.pdf',
  'cv_6927022b01c741.70368046.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927022b01c741.70368046.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T13:35:39+00:00'::timestamptz,
  '2025-11-26T13:35:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  282,
  'Roberto Ajala',
  'ajalaroberto@gmail.com',
  '2644994290',
  'Proyectista',
  NULL,
  'Soy una persona, responsable, muy buen compañero, respetuoso y me adapto fácilmente al ambiente laboral',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_282_cv_692723b3a07ab6.94882330.pdf',
  'cv_692723b3a07ab6.94882330.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692723b3a07ab6.94882330.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T15:58:43+00:00'::timestamptz,
  '2025-11-26T15:58:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  283,
  'Jeremias Palacio',
  'jeremiaspalacio1932@gmail.com',
  '2645070204',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_283_cv_692729790db3d2.25178683.pdf',
  'cv_692729790db3d2.25178683.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692729790db3d2.25178683.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T16:23:21+00:00'::timestamptz,
  '2025-11-26T16:23:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  284,
  'Cristian Alejandro ai',
  'acostacrstian@gmail.com',
  '3492622383',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_284_cv_69272a26941bd4.81987645.pdf',
  'cv_69272a26941bd4.81987645.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69272a26941bd4.81987645.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T16:26:14+00:00'::timestamptz,
  '2025-11-26T16:26:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  286,
  'Cristian Alejandro Acosta',
  'cristianacosta22@hotmail.com',
  '3492622383',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_286_cv_69272aface2841.20847808.pdf',
  'cv_69272aface2841.20847808.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69272aface2841.20847808.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T16:29:46+00:00'::timestamptz,
  '2025-11-26T16:29:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  289,
  'Mara Anahi Leiva',
  'puscamamarta@gmail.com',
  '2644368798',
  'Analista de Presupuestos',
  NULL,
  'Soy una persona responsable. Me gusta estar aprendiendo y tener compromiso en lo que realizo,',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_289_cv_692732919964a9.89914059.pdf',
  'cv_692732919964a9.89914059.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692732919964a9.89914059.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T17:02:09+00:00'::timestamptz,
  '2025-11-26T17:02:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  290,
  'Micaela Manrique',
  'micamanrique15@gmail.com',
  '02644124247',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_290_cv_69273412936049.51426562.pdf',
  'cv_69273412936049.51426562.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69273412936049.51426562.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T17:08:34+00:00'::timestamptz,
  '2025-11-26T17:08:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  291,
  'Tomas Moreno',
  'lictomasmoreno.tm@gmail.com',
  '2645840885',
  'Generalista de RRHH',
  NULL,
  'Licenciado en Gestión de RRHH con 4 años de experiencia integral. Mi perfil Generalista abarca la gestión completa de Selección (Talent Acquisition) y Administración de Personal (Legajos, Novedades). Destaco por mi visión emprendedora (Consultoría), mis habilidades comerciales y el dominio de herramientas digitales (Canva, Trello, CM). Busco un rol desafiante para aplicar mi proactividad y aportar valor estratégico y operativo inmediato al equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_291_cv_69273678dd7270.32656872.pdf',
  'cv_69273678dd7270.32656872.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69273678dd7270.32656872.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T17:18:48+00:00'::timestamptz,
  '2025-11-26T17:18:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  293,
  'Nicolás Rivas',
  'nicolasrivas92@gmail.com',
  '2645066879',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_293_cv_6927382b6039a5.53380220.pdf',
  'cv_6927382b6039a5.53380220.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927382b6039a5.53380220.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T17:26:03+00:00'::timestamptz,
  '2025-11-26T17:26:03+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  294,
  'María Constanza Quintero Rodríguez',
  'cotiquinterodg@gmail.com',
  '2646726955',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_294_cv_69274018a0a3c6.50712997.pdf',
  'cv_69274018a0a3c6.50712997.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69274018a0a3c6.50712997.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T17:59:52+00:00'::timestamptz,
  '2025-11-26T17:59:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  296,
  'Esteban Vallejos',
  'estualexx06@gmail.com',
  '2644423703',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_296_cv_69274630c4b400.11884447.pdf',
  'cv_69274630c4b400.11884447.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69274630c4b400.11884447.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T18:25:52+00:00'::timestamptz,
  '2025-11-26T18:25:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  297,
  'Verni Ana Paula',
  'ana.orion94@gmail.com',
  '2645459312',
  'Sé desde mecánica hasta diseño gráfico y administración. Estoy dispuesta a ocupar el puesto que soliciten conveniente',
  NULL,
  'Soy una persona súper proactiva, me encanta estar todo el tiempo realizando múltiples tareas. Me gusta mucho aportar en todo lo que pueda. Soy súper enérgica y resuelvo lo que sea :)',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_297_cv_6927468504f607.44247658.pdf',
  'cv_6927468504f607.44247658.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927468504f607.44247658.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T18:27:17+00:00'::timestamptz,
  '2025-11-26T18:27:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  298,
  'Micaela Monteleone',
  'yazzitt7@gmail.com',
  '2644390683',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_298_cv_69274d6ab337e9.81685667.pdf',
  'cv_69274d6ab337e9.81685667.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69274d6ab337e9.81685667.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T18:56:42+00:00'::timestamptz,
  '2025-11-26T18:56:42+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  299,
  'Jorge Eduardo Ariza Dominguez',
  'eduardoariza6@gmail.com',
  '02645715356',
  'Analista de Presupuestos',
  NULL,
  'Mi nombre es Eduardo. Soy una persona proactiva, organizada y siempre tengo la mejordisposición para la realización de mis labores. Me considero un buen compañero concapacidad para trabajar de forma independiente y conjunta. Tengo gran rendimientobajo presión, y facilidad para seguir instrucciones y generar excelentes resultados.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_299_cv_69274ecc810532.58168159.pdf',
  'cv_69274ecc810532.58168159.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69274ecc810532.58168159.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T19:02:36+00:00'::timestamptz,
  '2025-11-26T19:02:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  301,
  'Micaela Paez',
  'micaela.paez6036@gmail.com',
  '2645667459',
  'Analista de Presupuestos',
  NULL,
  'Soy una persona organizada, responsable y con buena predisposición para el trabajo en equipo.
Me encuentro muy predispuesta a nuevos desafíos y experiencias. 
Muchas Gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_301_cv_69275934bd6ca7.59100122.pdf',
  'cv_69275934bd6ca7.59100122.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69275934bd6ca7.59100122.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T19:47:00+00:00'::timestamptz,
  '2025-11-26T19:47:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  302,
  'Carlos Emanuel Salinas',
  'carlosemanuelsalinas33@gmail.com',
  '2645287092',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_302_cv_69275aeab618d5.92168826.pdf',
  'cv_69275aeab618d5.92168826.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_69275aeab618d5.92168826.pdf","migrated_at":"2026-06-09T11:23:49.255Z"}'::jsonb,
  '2025-11-26T19:54:18+00:00'::timestamptz,
  '2025-11-26T19:54:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  304,
  'Fabio Herrera',
  'estrelladelrosario6@gmail.com',
  '+543513631094',
  'Administrativo/a de Personal',
  NULL,
  'Buenas tardes, espero que se encuentre bien adjunto mi cv ya que me encuentro buscando empleo, espero que mi perfil se adapte a futuras vacantes activas.
Me encuentro disponible para que puedan conocer más sobre mi experiencia y mi persona.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_304_cv_69275b56a3dce8.13116569.pdf',
  'cv_69275b56a3dce8.13116569.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69275b56a3dce8.13116569.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T19:56:06+00:00'::timestamptz,
  '2025-11-26T19:56:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  305,
  'Yanina Flores Yanzón',
  'yaflor.yf@gmail.com',
  '2646490091',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_305_cv_69275e228ff4b1.16243633.pdf',
  'cv_69275e228ff4b1.16243633.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69275e228ff4b1.16243633.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T20:08:02+00:00'::timestamptz,
  '2025-11-26T20:08:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  307,
  'Carlos Emanuel Salinas',
  'emaa.salinass@gmail.com',
  '2645287092',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_307_cv_6927621cbf9133.21698661.pdf',
  'cv_6927621cbf9133.21698661.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927621cbf9133.21698661.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T20:25:00+00:00'::timestamptz,
  '2025-11-26T20:25:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  308,
  'Guillermo Rodrigo Martín Yornet',
  'informestrabajo2214@gmail.com',
  '2644181960',
  'Analista de Presupuestos',
  NULL,
  'Hola! Soy Guillermo Martín un joven con mucha experiencia en el área de ventas, soy muy emprendedor me desarrollo en diversas áreas, me caracterizo por siempre estar queriendo aprender de diversas actividades y estar en formación permanente. Tengo muchos contactos y conocidos y estaría dispuesto a usarlos para hacer crecer aún más la empresa, admiro el crecimiento y la historia de la empresa y me identifica mucho, por eso me encantaría poder trabajar con ustedes y aprender de ustedes! Gracias….',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_308_cv_6927628aef8e38.40322640.doc',
  'cv_6927628aef8e38.40322640.doc',
  'application/msword',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927628aef8e38.40322640.doc","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T20:26:50+00:00'::timestamptz,
  '2025-11-26T20:26:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  309,
  'Emiliano Vargas',
  'emilianovargas64@gmail.com',
  '2646277951',
  'Analista de Presupuestos',
  NULL,
  'Soy Emiliano Vargas, tengo 24 años y actualmente estoy estudiando Lic. en Finanzas en UES21. Siento que puedo aportar compromiso, orden, capacidad para trabajar con números y una actitud proactiva para aprender y mejorar continuamente. Me considero alguien confiable, con buena comunicación y acostumbrado a trabajar bajo responsabilidad y objetivos. Tengo muchas ganas de sumar mi esfuerzo y crecer dentro de un equipo técnico-administrativo como el de Plot Center.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_309_cv_69277115086d64.21113195.pdf',
  'cv_69277115086d64.21113195.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69277115086d64.21113195.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T21:28:53+00:00'::timestamptz,
  '2025-11-26T21:28:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  310,
  'Facundo Humberto Fernández Agüero',
  'facufernandez4589@gmail.com',
  '2645307532',
  'Analista de Presupuestos',
  NULL,
  'Soy estudiante de la carrera Contador Público. con conocimientos técnicos a partir de mi formación en el secundario, además de mi experiencia trabajando en el Area de cotizaciones de una empresa Metalúrgica. También me puedo desarrollar en cotizaciones para los clientes. Quedo atento a cualquier comentario. Saludos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_310_cv_6927752cede4f9.77451747.pdf',
  'cv_6927752cede4f9.77451747.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927752cede4f9.77451747.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T21:46:20+00:00'::timestamptz,
  '2025-11-26T21:46:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  313,
  'Fernando Ariel Guevara',
  'graficosdigital5@gmail.com',
  '264 584-4564',
  'Encargo de Presupuestos',
  NULL,
  'Amplía experiencia en el rubro, Imprenta, Gráfica y Digital',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_313_cv_69277a064b2543.38558832.pdf',
  'cv_69277a064b2543.38558832.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69277a064b2543.38558832.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T22:07:02+00:00'::timestamptz,
  '2025-11-26T22:07:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  314,
  'Leandro Caro Vera',
  'leandrocarovera138@gmail.com',
  '2646271014',
  'Analista de Presupuestos',
  NULL,
  'Amplia trayectoria comercial y administrativa, en entornos variados y dinámicos. Proactivo, con orientación a la resolución de problemas y con amor por los desafíos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_314_cv_69277de4adc729.16378792.pdf',
  'cv_69277de4adc729.16378792.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69277de4adc729.16378792.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-26T22:23:32+00:00'::timestamptz,
  '2025-11-26T22:23:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  315,
  'Gisel Esquivel',
  'giselesquivel2018@gmail.com',
  '2645657113',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_315_cv_6927a08441ffa2.41355800.pdf',
  'cv_6927a08441ffa2.41355800.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927a08441ffa2.41355800.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T00:51:16+00:00'::timestamptz,
  '2025-11-27T00:51:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  316,
  'Ramiro Guzman',
  'ramiroguzmanrg21@gmail.com',
  '2645446991',
  'Analista de Presupuestos',
  NULL,
  'Persona en busqueda laboral, responsable y con muchas ganas de tener experiencia laboral nueva.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_316_cv_6927ae7f4e2198.22465977.pdf',
  'cv_6927ae7f4e2198.22465977.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927ae7f4e2198.22465977.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T01:50:55+00:00'::timestamptz,
  '2025-11-27T01:50:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  317,
  'Leonel Campillay',
  'leocampillay39@gmail.com',
  '2645717166',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_317_cv_6927b962ad7e22.23268294.pdf',
  'cv_6927b962ad7e22.23268294.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6927b962ad7e22.23268294.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T02:37:22+00:00'::timestamptz,
  '2025-11-27T02:37:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  319,
  'Maria Fernanda Tello',
  'mfernandatello1@hotmail.com',
  '2644523659',
  'Analista de Presupuestos',
  NULL,
  'Buenos dejo mis datos cuento con 5 años de experiencia en puesto similares a armado de presupuestos, atencion al cliente, cajera y administrativo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_319_cv_69282b62b30a38.92176962.pdf',
  'cv_69282b62b30a38.92176962.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69282b62b30a38.92176962.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T10:43:46+00:00'::timestamptz,
  '2025-11-27T10:43:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  320,
  'Ariel Funes',
  'sergioariel1977@gmail.com',
  '2644522166',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_320_cv_69282c19c81b86.87372095.docx',
  'cv_69282c19c81b86.87372095.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69282c19c81b86.87372095.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T10:46:49+00:00'::timestamptz,
  '2025-11-27T10:46:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  321,
  'Lucas Tello',
  'lucastello77@gmail.com',
  '264 4823637',
  'Analista de Presupuestos',
  NULL,
  'Profesional del área administrativa con más de siete años
de experiencia, colaborando con diversas empresas en la
optimización de procesos, la organización eficiente de
datos y documentación.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_321_cv_69284b81c9fd18.17880653.pdf',
  'cv_69284b81c9fd18.17880653.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69284b81c9fd18.17880653.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T13:00:49+00:00'::timestamptz,
  '2025-11-27T13:00:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  323,
  'Matías Uriel Quiroga Cabrera',
  'urielquiroga17@gmail.com',
  '2644860517',
  'Atención al Cliente',
  NULL,
  'Buenas!
Me gustaría postularme para trabajar en Plot Center.
Cuento con sólidos conocimientos en el área del diseño y experiencia en la creación y preparación de piezas para impresión, lo que me permite comprender muy bien los procesos y las necesidades del cliente. Soy responsable, detallista y tengo buena comunicación, por lo que puedo adaptarme rápido al ritmo de trabajo y colaborar tanto en la atención como en la producción.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_323_cv_69285ac79e5949.97839672.pdf',
  'cv_69285ac79e5949.97839672.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69285ac79e5949.97839672.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T14:05:59+00:00'::timestamptz,
  '2025-11-27T14:05:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  325,
  'Gonzalo Martin Zavala Lopez',
  'gonzalomartinzavalalopez@gmail.com',
  '02646300097',
  'Analista de Presupuestos',
  NULL,
  'Actualmente trabajando en carteleria elebe producciones',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_325_cv_69286fb8210182.41366969.pdf',
  'cv_69286fb8210182.41366969.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69286fb8210182.41366969.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T15:35:20+00:00'::timestamptz,
  '2025-11-27T15:35:20+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  326,
  'Yanella Aylen Alameda',
  'yane.alameda06@gmail.com',
  '2645855638',
  'Asistente Administrativo/a',
  NULL,
  'Hola, buen día. Mi nombre es Yanella Alameda. Si bien me postulé para el puesto de Asistente Administrativo, deseo expresar que también estoy disponible y con interés en otros roles dentro de la empresa, tales como cajera, sector administrativo, atención al cliente, analista de presupuesto, vendedora o asesora comercial.
Una vez dicho eso, les contaré un poco de mi cuento con experiencia en atención al público, recepción, ventas y tareas administrativas. Actualmente estudio el Profesorado de Matemática. Me caracterizo por la responsabilidad, el compromiso y la buena disposición para aprender y asumir nuevos desafíos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_326_cv_6928787ce67375.45772758.pdf',
  'cv_6928787ce67375.45772758.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928787ce67375.45772758.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T16:12:44+00:00'::timestamptz,
  '2025-11-27T16:12:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  327,
  'Agustín Pereyra',
  'agusabel555@gmail.com',
  '2645255797',
  'Analista de Presupuestos',
  NULL,
  'Hola buenos días, como dice mi CV trabajé de secretario atendiendo, vendiendo, generando y mandando presupuestos, como también haciendo los contratos. Espero su respuesta. Muchas Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_327_cv_692878951bcc02.90435056.pdf',
  'cv_692878951bcc02.90435056.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692878951bcc02.90435056.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T16:13:09+00:00'::timestamptz,
  '2025-11-27T16:13:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  329,
  'Tomas Jesús Deusedas',
  'tomyjes25@gmail.com',
  '2645259325',
  'ENCARGADO DE PRESUPUESTO',
  NULL,
  'Buenas tardes adjunto mí CV para el puesto o cualquiera afín a mis habilidades.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_329_cv_69288ca37bd823.32685869.pdf',
  'cv_69288ca37bd823.32685869.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69288ca37bd823.32685869.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T17:38:43+00:00'::timestamptz,
  '2025-11-27T17:38:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  330,
  'Luis Cesar Maza',
  'luis.c.maza@gmail.com',
  '2646209064',
  'Gerente de Marketing',
  NULL,
  'Consultor en estrategias de comunicación y posicionamiento digital. Combino creatividad con enfoque analítico para resolver problemas reales y potenciar marcas. Me apasiona transformar ideas en proyectos concretos y sumar valor en equipos que buscan crecer con visión y criterio.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_330_cv_6928988a211343.80006123.pdf',
  'cv_6928988a211343.80006123.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928988a211343.80006123.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T18:29:30+00:00'::timestamptz,
  '2025-11-27T18:29:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  332,
  'Agustin Sánchez Graffigna',
  'asanchezgraff@gmail.com',
  '02645079376',
  'Analista de Presupuestos',
  NULL,
  'Buenas tardes, como estás? Mi nombre es Agustín, tengo 37 años, soy licenciado en administración y tengo experiencia en administración general de negocios, armado de presupuesto, analisis de costos, también en l rama industrial más abogado a compras y co trol de gestión. Fuera de lo laboral, tengo a mi pareja y un hijo de 10 meses, me gusta la actividad al aire libre y disfruto de los buenos momentos con amigos y familia.

Si bien no poseo experiencia en el rubro de imprentas y cartelerías, me resulta un muy lindo desafío poder sumarme a una empresa líder en el sector. Quedo atento al llamado o mensaje, que tengas un excelente día!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_332_cv_69289fa72a48c9.85794548.pdf',
  'cv_69289fa72a48c9.85794548.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69289fa72a48c9.85794548.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T18:59:51+00:00'::timestamptz,
  '2025-11-27T18:59:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  333,
  'Maria Agostina López Pizarro',
  'agosty85@gmail.com',
  '2645813434',
  'Analista de Presupuestos',
  NULL,
  'Cuento con una sólida trayectoria administrativa dentro de entornos industriales, con experiencia en seguimiento y control de presupuestos, gestión de órdenes de compra, coordinación de gastos, manejo de documentación técnica y administrativa, y apoyo directo a equipos gerenciales.

He trabajado de manera permanente con procesos que requieren precisión, trazabilidad y control de costos, incluyendo el monitoreo de planes de presupuesto, gestión de proveedores, análisis de necesidades y seguimiento de indicadores.

Soy una persona organizada, proactiva y orientada al detalle, con capacidad para trabajar de forma autónoma y en equipo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_333_cv_6928a28be41484.41972653.pdf',
  'cv_6928a28be41484.41972653.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928a28be41484.41972653.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T19:12:11+00:00'::timestamptz,
  '2025-11-27T19:12:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  335,
  'Agustin Ruartes',
  'agu.ruartes@gmail.com',
  '2644547524',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_335_cv_6928b1805e3ae8.58026606.pdf',
  'cv_6928b1805e3ae8.58026606.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928b1805e3ae8.58026606.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T20:16:00+00:00'::timestamptz,
  '2025-11-27T20:16:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  337,
  'Agustin Ruartes',
  'agu_781@hotmail.com',
  '2644547524',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_337_cv_6928b1ac4f9220.65824629.pdf',
  'cv_6928b1ac4f9220.65824629.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928b1ac4f9220.65824629.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T20:16:44+00:00'::timestamptz,
  '2025-11-27T20:16:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  338,
  'Agustin Ruartes',
  'ruartes.anapaula@gmail.com',
  '2644547524',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_338_cv_6928b200db2ba6.73028739.pdf',
  'cv_6928b200db2ba6.73028739.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928b200db2ba6.73028739.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T20:18:08+00:00'::timestamptz,
  '2025-11-27T20:18:08+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  339,
  'Agustin Ruartes',
  'exe_5x5@hotmail.com',
  '2644547524',
  'Vendedor/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_339_cv_6928b224ae2036.45480012.pdf',
  'cv_6928b224ae2036.45480012.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928b224ae2036.45480012.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T20:18:44+00:00'::timestamptz,
  '2025-11-27T20:18:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  340,
  'Oscar eduardo martin garcia moreno',
  'magarcia.mmo@gmail.com',
  '2645638609',
  'Instalador/a de Cartelería',
  NULL,
  'Experiencia en manejo de ploter y maquina de corte, instalacion de carteleria y ploteo ,diseño de planos de arquitectura',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_340_cv_6928b2a624c2e5.00541959.pdf',
  'cv_6928b2a624c2e5.00541959.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928b2a624c2e5.00541959.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T20:20:54+00:00'::timestamptz,
  '2025-11-27T20:20:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  341,
  'Elluz Castellar',
  'elluzcastellar@gmail.com',
  '2645272559',
  'Encargado de Presupuestos',
  NULL,
  'Hola, buenas tardes! 
Adjunto mi Cv para su evaluación y consideración.

Agradezco de antemano la receptividad que bien puedan tener y quedo a disposición para una entrevista.

Saludos cordiales,

Elluz C.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_341_cv_6928b38fd49d02.14629330.pdf',
  'cv_6928b38fd49d02.14629330.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928b38fd49d02.14629330.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T20:24:47+00:00'::timestamptz,
  '2025-11-27T20:24:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  342,
  'emiliano sancho',
  'sanchoemiliano874@gmail.com',
  '02645278676',
  'Asistente Administrativo/a',
  NULL,
  'Buen dia soy emiliano sancho cuento con experiencia en sistemas de gestion de la calidad e implementacion iso 9001',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_342_cv_6928bc77233d29.84164693.pdf',
  'cv_6928bc77233d29.84164693.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928bc77233d29.84164693.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T21:02:47+00:00'::timestamptz,
  '2025-11-27T21:02:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  343,
  'Maria Belen Tello',
  'tello.mariabelen@yahoo.com.ar',
  '02644800576',
  'Analista de Presupuestos',
  NULL,
  'Buenas tardes,adjunto mi CV para el puesto solicitado de encargado de presupuesto.Cuento con amplia experiencia en administración contable y presupuestaria.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_343_cv_6928d2ceb6c7d4.71520729.pdf',
  'cv_6928d2ceb6c7d4.71520729.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928d2ceb6c7d4.71520729.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-27T22:38:06+00:00'::timestamptz,
  '2025-11-27T22:38:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  344,
  'Josefina juarez',
  'mjjjosej@gmail.com',
  '2645732028',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_344_cv_6928ec13b77b35.64183178.pdf',
  'cv_6928ec13b77b35.64183178.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928ec13b77b35.64183178.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T00:25:55+00:00'::timestamptz,
  '2025-11-28T00:25:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  346,
  'Josefina Juárez',
  'mjosefinajuarezg@gmail.com',
  '2645732028',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_346_cv_6928ec401b2b83.85890791.pdf',
  'cv_6928ec401b2b83.85890791.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6928ec401b2b83.85890791.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T00:26:40+00:00'::timestamptz,
  '2025-11-28T00:26:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  347,
  'Guillermo Castro Romero',
  'guillecastro96@gmail.com',
  '2644531891',
  'Operador/a de Mostrador',
  NULL,
  'Me presento soy Nicolás ..me gustaría una oportunidad para conocer la empresa y aplicar mis conocimientos así llegar a los objetivos juntos .. trabajador y con ganas de superarse',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_347_cv_69291ee3ba1174.90959838.pdf',
  'cv_69291ee3ba1174.90959838.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69291ee3ba1174.90959838.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T04:02:43+00:00'::timestamptz,
  '2025-11-28T04:02:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  348,
  'Leandro David Escobar',
  'leopumba123@gmail.com',
  '02646777400',
  'Analista de Presupuestos',
  NULL,
  'Tengo experiencia en tecnología, mecánica, soldadura, atención. Al público, y ventas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_348_cv_69292061879934.11431643.pdf',
  'cv_69292061879934.11431643.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69292061879934.11431643.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T04:09:05+00:00'::timestamptz,
  '2025-11-28T04:09:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  349,
  'Yoselie del Milagro',
  'yoseliedelmilagro@gmail.com',
  '2645827375',
  'Asistente Administrativo/a',
  NULL,
  'Estimados, 

Adjunto mi cv para futuros puestos que puedan surgir en su compañía.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_349_cv_6929a1dff27439.65786170.pdf',
  'cv_6929a1dff27439.65786170.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6929a1dff27439.65786170.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T13:21:35+00:00'::timestamptz,
  '2025-11-28T13:21:35+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  351,
  'Martin Lautaro Miranda castro',
  'martinmiranda9999@gmail.com',
  '2646038195',
  'Asistente Administrativo/a',
  NULL,
  'Soy una persona responsable, capaz de realizar cualquier tarea que se me otorgue y realizarla de la mejor manera, estoy dispuesto a aprender y trabajar de la mejor manera posible, quiero aprender y adquirir experiencia en este rubro, tengo disponibilidad inmediata para trabajar, y soy puntual a la hora de realizar mi trabajo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_351_cv_6929b1cbdcb751.05937072.pdf',
  'cv_6929b1cbdcb751.05937072.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6929b1cbdcb751.05937072.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T14:29:31+00:00'::timestamptz,
  '2025-11-28T14:29:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  352,
  'Quiroga Carlos Angel',
  'quirogacarlosangel@gmail.com',
  '2646305287',
  'Analista de Presupuestos',
  NULL,
  'Buen dia estimados

Adjunto CV para que puedan tenerle en cuenta para cualquier vacante disponible. Tengo sólida experiencia en logística, gestión de compras, administración, gestión de depósito y stock, uso de sistemas informáticos y manejo de personal.

Quedo a su disposición

Saludos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_352_cv_6929d447d23f72.79675323.pdf',
  'cv_6929d447d23f72.79675323.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6929d447d23f72.79675323.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T16:56:39+00:00'::timestamptz,
  '2025-11-28T16:56:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  353,
  'Sergio Valinotti',
  'valinottisergio@gmail.com',
  '2644857059',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_353_cv_692a17fc5e0e39.47894906.pdf',
  'cv_692a17fc5e0e39.47894906.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692a17fc5e0e39.47894906.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-28T21:45:32+00:00'::timestamptz,
  '2025-11-28T21:45:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  356,
  'Santiago Robledo',
  'djsantirobledo@gmail.com',
  '2645765705',
  'Analista de Presupuestos',
  NULL,
  'Hola, cuento con experiencia en armado de presupuesto, teniendo en cuenta materiales, empleados, viaticos , asistencia, armados , merchandising , generando Órdenes de Compras, emisión, validacion y carga de facturas, generando y actualizando datos de RUPE y necesarios .',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_356_cv_692a5398eaf9b5.22356093.pdf',
  'cv_692a5398eaf9b5.22356093.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692a5398eaf9b5.22356093.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-29T01:59:52+00:00'::timestamptz,
  '2025-11-29T01:59:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  357,
  'Marcelo Morilla',
  'marcelomorillanale@hotmail.com',
  '02644519360',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_357_cv_692c7edac6a772.04967690.pdf',
  'cv_692c7edac6a772.04967690.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692c7edac6a772.04967690.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-11-30T17:28:58+00:00'::timestamptz,
  '2025-11-30T17:28:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  358,
  'Ruth Contrera',
  'ruth_martina@outlook.com',
  '2645254136',
  'Asistente de Atención al Cliente / Recepción',
  NULL,
  'Hola, mi nombre es Ruth. Estoy interesada en incorporarme al equipo en el área donde pueda ser más útil. Tengo experiencia en atención al cliente, manejo de redes sociales y conocimientos básicos de impresión 3D. Estoy buscando un trabajo de medio tiempo porque comenzaré la carrera de Marketing, y me gustaría aprender y crecer dentro de un entorno relacionado con el diseño y la producción. Estoy disponible para capacitación y para adaptarme a las necesidades del puesto.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_358_cv_692d8be853a790.58014784.pdf',
  'cv_692d8be853a790.58014784.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692d8be853a790.58014784.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-01T12:36:56+00:00'::timestamptz,
  '2025-12-01T12:36:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  359,
  'Celina Rodriguez',
  'celinarodriguez255@gmail.com',
  '2644139670',
  'Analista de Presupuestos',
  NULL,
  'Estimados/as, me presento como candidata para el puesto de Encargado de presupuestos publicado recientemente. Adjunto mi Currículum Vitae para su consideración.
Quedo a disposición para una entrevista y para ampliar cualquier información que necesiten.
Saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_359_cv_692d9facf384f7.63494081.pdf',
  'cv_692d9facf384f7.63494081.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692d9facf384f7.63494081.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-01T14:01:16+00:00'::timestamptz,
  '2025-12-01T14:01:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  360,
  'Nadia Estebes',
  'nadiaestebes@gmail.com',
  '2645127704',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_360_cv_692dbc67a4c6c4.98111205.pdf',
  'cv_692dbc67a4c6c4.98111205.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692dbc67a4c6c4.98111205.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-01T16:03:51+00:00'::timestamptz,
  '2025-12-01T16:03:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  362,
  'Matias Ibazeta',
  'matias.ibazeta@gmail.com',
  '02645865855',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'https://www.facebook.com/profile.php?id=100081271467239',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_362_cv_692de4d6850e28.76139322.pdf',
  'cv_692de4d6850e28.76139322.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692de4d6850e28.76139322.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-01T18:56:22+00:00'::timestamptz,
  '2025-12-01T18:56:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  363,
  'Luz carrizo',
  'luzcarrizo93@gmail.com',
  '2645589444',
  'Analista de Presupuestos',
  NULL,
  'Hola! 
Me encantaría poder trabajar con uds, tengo experiencia en atención al cliente, soy muy respetuosa, empática, organizada, meticulosa, ordenada, detallista, me gusta planificar las tareas y cumplir objetivos, soy eficiente, eficaz, trabajo en equipo, adaptabilidad y aprendizaje rápido. Estoy lista para aportar valor en cualquier área donde mis habilidades encajaran con las necesidades de la empresa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_363_cv_692ef56e6c8299.89829906.pdf',
  'cv_692ef56e6c8299.89829906.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692ef56e6c8299.89829906.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-02T14:19:26+00:00'::timestamptz,
  '2025-12-02T14:19:26+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  364,
  'Franco Albareti',
  'francosanjuanino@gmail.com',
  '2646313575',
  'Atención al Cliente',
  NULL,
  'Hola buenas dejo mi postulación espero su respuesta atentamente',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_364_cv_692f1913de4a24.44081072.docx',
  'cv_692f1913de4a24.44081072.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692f1913de4a24.44081072.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-02T16:51:31+00:00'::timestamptz,
  '2025-12-02T16:51:31+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  365,
  'Jerónimo Flores',
  'jeritoflores26@gmail.com',
  '2645262794',
  'Community Manager',
  NULL,
  'Hola, mi nombre es Jerónimo Flores. Soy Técnico en Marketing y Publicidad Digital. Si bien elegí la opción de Community Manager, estoy dispuesto a aprender para poder aportar desde cualquier lugar que la empresa necesite.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_365_cv_692f3aa3249315.63631105.pdf',
  'cv_692f3aa3249315.63631105.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692f3aa3249315.63631105.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-02T19:14:43+00:00'::timestamptz,
  '2025-12-02T19:14:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  366,
  'Celina González',
  'anitacelina3.g@gmail.com',
  '2645473895',
  'Analista de Presupuestos',
  NULL,
  'Cree mi propio negocio basado en productos gráficos y conozco sobre la industria y creación de presupuestos, soy partidaria de que el trabajo se hace mucho mejor cuando se realiza con pasión y este rol es ideal. Será un placer conocerlos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_366_cv_692f4d68917965.09509828.pdf',
  'cv_692f4d68917965.09509828.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_692f4d68917965.09509828.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-02T20:34:48+00:00'::timestamptz,
  '2025-12-02T20:34:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  367,
  'Sofía Magdalena Reyes Gatica',
  'sofiar.gatica@gmail.com',
  '2664216508',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_367_cv_6930f00596f020.60086917.pdf',
  'cv_6930f00596f020.60086917.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6930f00596f020.60086917.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-04T02:20:53+00:00'::timestamptz,
  '2025-12-04T02:20:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  368,
  'Gustavo Giménez',
  'subcitycomics@yahoo.com.ar',
  '2644981098',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Buenas noches!
Mi nombre es Gustavo, tengo mucha experiencia en el sector gráfico , ya que hace más de 25 años que trabajo en el área de diseño de Diario de Cuyo. Comencé en la sección Infografía, luego pasé al área de diseño, retoque fotográfico, maquetación y  armado de páginas del diario y de los distintos poductos que se han publicado a lo largo de estos años: Revista OH!, Cuyo Minero, Suplemento Verde, suplementos para eventos especiales, como Mundiales de fútbol, TC2000, Vuelta a San Juan, etc.
De manera freelance, he realizado traducciones del inglés al español para agencias de localización chinas.
También vengo realizando colores planos para Marvel comics, entre otras editoriales del exterior.
Recientemente estuve a cargo de la elaboración del libro del Plan Estratégico de la Municipalidad de Pocito, donde me encargué de la totalidad de las tareas de diseño y armado. 
Estoy dispuesto a aprender lo que sea necesario para poder formar parte de su equipo.
Quedo a la espera de su respuesta
Muchas gracias
Gustavo Giménez',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_368_cv_69312e0a3efce1.77467729.pdf',
  'cv_69312e0a3efce1.77467729.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69312e0a3efce1.77467729.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-04T06:45:30+00:00'::timestamptz,
  '2025-12-04T06:45:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  369,
  'Denise Tamara Argüello Martinez',
  'darguellomartinez@gmail.com',
  '2645589233',
  'Analista de Presupuestos',
  NULL,
  'Buenas tardes!

Mi nombre es Tamara Argüello, estoy al tanto de la solicitud de trabajo. Por este motivo, me encuentro interesada en formar parte de su equipo.

Adjunto mi currículum vitae para su consideración y quedo a disposición para ampliar cualquier información o coordinar una entrevista.

Desde ya, muchas gracias por su tiempo y atención.

Saludos.

Arq. Tamara Argüello',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_369_cv_693190aedf6b74.39488064.pdf',
  'cv_693190aedf6b74.39488064.pdf',
  'application/pdf',
  'entrevista',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Entrevista","legacy_cv_ruta":"uploads/cv/cv_693190aedf6b74.39488064.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-04T13:46:22+00:00'::timestamptz,
  '2025-12-04T13:46:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  371,
  'María Emilia Elizondo Kopp',
  'emiliaelizondok27@gmail.com',
  '2645763989',
  'Analista de Presupuestos',
  NULL,
  'Soy estudiante avanzada de Diseño Industrial, actualmente en instancia de tesis. Tengo experiencia en tareas administrativas como atención y seguimiento al cliente y también según organización de trabajo, gracias a esto tengo conocimientos en gestión de calidad. Me considero responsable, ordenada y con buena comunicación. Me adapto rápido y aprendo fácil.
Creo que el puesto de presupuestos encaja bien conmigo porque soy idónea en la parte técnica, el diseño tanto gráfico como industrial que es mi fuerte, y soy una persona paciente en cuanto al trato con la gente y la gestión de información.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_371_cv_6931f329915b64.35378260.pdf',
  'cv_6931f329915b64.35378260.pdf',
  'application/pdf',
  'entrevista',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Entrevista","legacy_cv_ruta":"uploads/cv/cv_6931f329915b64.35378260.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-04T20:46:33+00:00'::timestamptz,
  '2025-12-04T20:46:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  373,
  'Enzo Fernandez',
  'quielmass3805@gmail.com',
  '2644839120',
  'Cajero/a',
  NULL,
  'Me dirijo a usted con el objetivo de postularme para una posición dentro de su empresa. Cuento con experiencia en atención al cliente, ventas, reposición, administración y creación de contenido digital. Además, me encuentro en constante formación en áreas de tecnología, con diplomaturas en QA Testing, Programación Web Full Stack y Diseño UX, y actualmente curso Ingeniería Electrónica.

Soy una persona proactiva, con habilidades comunicativas, buen manejo de herramientas informáticas, y me adapto fácilmente a nuevos entornos laborales. Tengo disponibilidad para trabajar full time y/o de forma remota, y poseo un nivel de inglés intermedio que me permite comprender y comunicarme en entornos técnicos o comerciales.

Me encantaría tener la oportunidad de formar parte de su equipo y aportar con mi energía, conocimientos y compromiso. Adjunto mi CV para su evaluación. Quedo a su disposición para una entrevista o para brindar más información.

Desde ya, muchas gracias por su tiempo y consideración.

Atentamente,

Enzo Fernandez',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_373_cv_6933b16f494ee1.31211329.pdf',
  'cv_6933b16f494ee1.31211329.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6933b16f494ee1.31211329.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-06T04:30:39+00:00'::timestamptz,
  '2025-12-06T04:30:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  375,
  'Nicolás Rivas',
  'nicolasrivas@outlook.com.ar',
  '2645066879',
  'Administrativo/a Contable',
  NULL,
  'Soy Nicolás Rivas, contador publico pero estoy interesado en el puesto de encargado de presupuestos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_375_cv_69381c722c2bd4.23096635.pdf',
  'cv_69381c722c2bd4.23096635.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69381c722c2bd4.23096635.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-09T12:56:18+00:00'::timestamptz,
  '2025-12-09T12:56:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  376,
  'Nahuel Blanco',
  'kalilbla@live.com.ar',
  '2645858714',
  'Me adapto a cualquier tipo de puesto',
  NULL,
  'Tengo mucha voluntad para aprender, velocidad y efectividad',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_376_cv_69388f912cfe73.05467418.pdf',
  'cv_69388f912cfe73.05467418.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69388f912cfe73.05467418.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-09T21:07:29+00:00'::timestamptz,
  '2025-12-09T21:07:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  377,
  'Maria Jose Ramos',
  'entidadsj@gmail.com',
  '3854400881',
  'Analista de RRHH',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_377_cv_693980eec800e6.95569444.pdf',
  'cv_693980eec800e6.95569444.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_693980eec800e6.95569444.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-10T14:17:18+00:00'::timestamptz,
  '2025-12-10T14:17:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  380,
  'Guillermo Marcos Noguera',
  'noguera_m@hotmail.com',
  '2645692267',
  'Administrativo/a Contable',
  NULL,
  'Buen día,
Les envío mi CV para la vacante de Encargado de Presupuestos.
Estoy disponible para coordinar una entrevista y así puedan conocer mejor mi perfil.
Desde ya muchas gracias.
Saludos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_380_cv_693c1d08593e64.03802180.pdf',
  'cv_693c1d08593e64.03802180.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_693c1d08593e64.03802180.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-12T13:47:52+00:00'::timestamptz,
  '2025-12-12T13:47:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  381,
  'Camila Peroni Pickenhayn',
  'camilapickenhayn@gmail.com',
  '2647433919',
  'Administrativo/a Contable',
  NULL,
  'Estudiante avanzada de Contador Público y Lic. en Administración de Empresas con experiencia práctica en estudios contables y gestión administrativa. Tengo dominio de herramientas de gestión como Tango y ARCA, así como Excel Avanzado y Power BI para el análisis de datos. He gestionado conciliaciones bancarias y administración de tesorería. Me destaco por mi capacidad de organización y proactividad desarrollada en roles de coordinación. Busco un desafío profesional donde pueda aplicar mis conocimientos técnicos, aportar a la eficiencia de procesos y continuar mi desarrollo en un entorno dinámico',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_381_cv_693e094f816042.53538276.pdf',
  'cv_693e094f816042.53538276.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_693e094f816042.53538276.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-14T00:48:15+00:00'::timestamptz,
  '2025-12-14T00:48:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  382,
  'Miguel Ruiz',
  'miguelloruiztaxi@gmail.com',
  '2644593228',
  'Instalador/a de Cartelería',
  NULL,
  'Hola.
Tengo manejo de distintas herramientas eléctricas. Electricidad domiciliaria.
Dispuesto a aprender y ayudar a la empresa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_382_cv_693f5bd8b98507.14135733.pdf',
  'cv_693f5bd8b98507.14135733.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_693f5bd8b98507.14135733.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-15T00:52:40+00:00'::timestamptz,
  '2025-12-15T00:52:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  383,
  'Lourdes Belén Grillo Delgado',
  'lourdesbelen.grillo@gmail.com',
  '2646218922',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Tengo una gran experiencia en el arte tradicional y llevo 4 años en la carrera de Diseño Gráfico, me interesa ampliar mi experiencia prefesional trabajando con ustedes, mi objetivo es llegar a lo más alto en proyectos inovadores, estoy segura que uno de mis primeros pasos es estar en su grupo, estré atenta a cualquier llamado, gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_383_cv_694192b76957e4.31439291.pdf',
  'cv_694192b76957e4.31439291.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_694192b76957e4.31439291.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-16T17:11:19+00:00'::timestamptz,
  '2025-12-16T17:11:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  384,
  'Carolina Florencia Herrera Rojas',
  'caroherrerarojaas@gmail.com',
  '2645170652',
  'Administrativo/a de Personal',
  NULL,
  'Buenas tardes! Seleccione un puesto para postular pero me adapto a lo que estén requiriendo actualmente. Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_384_cv_6942d480851087.41031096.pdf',
  'cv_6942d480851087.41031096.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6942d480851087.41031096.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-17T16:04:16+00:00'::timestamptz,
  '2025-12-17T16:04:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  385,
  'Porcel Paez Celeste Valentina',
  'celevpp@gmail.com',
  '2644111183',
  'Asistente Administrativo/a',
  NULL,
  'Estudiante avanzada en la Licenciatura en Administración de Empresas (87,18%) en Ciencias Económicas con perfil orientado a resultados. Durante mi formación, no solo lideré equipos de voluntariado gestionando alianzas estratégicas, sino que también implementé soluciones financieras prácticas (Cashflow) en pymes. Me destaco por mi capacidad de aprendizaje rápido y mi enfoque en la optimización de procesos. Busco una oportunidad para ganar experiencia y continuar formándome profesionalmente, aportando a la par mi capacidad de análisis y proactividad.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_385_cv_6944630d69ac46.27743380.pdf',
  'cv_6944630d69ac46.27743380.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6944630d69ac46.27743380.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2025-12-18T20:24:45+00:00'::timestamptz,
  '2025-12-18T20:24:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  387,
  'Nahuel Blanco',
  'blanconahuel7705@gmail.com',
  '2645858714',
  'puedo adaptarme fácilmente a cualquier rol o puesto',
  NULL,
  'Tengo buena predisposición, soy flexible y con buena capacidad de adaptación',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_387_cv_69583c45197ed8.57303146.pdf',
  'cv_69583c45197ed8.57303146.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69583c45197ed8.57303146.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-02T21:44:37+00:00'::timestamptz,
  '2026-01-02T21:44:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  389,
  'Martín Lautaro miranda castro',
  'martinmiranda1716@gmail.com',
  '2646038195',
  'Atención al Cliente',
  NULL,
  '*Presentación Profesional*

Me llamo Martín Miranda, soy una persona activa, responsable y comprometido con el trabajo. Busco un nuevo desafío donde pueda aplicar mis habilidades y mi compromiso para poder crecer profesionalmente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_389_cv_695850c60ced99.93639395.pdf',
  'cv_695850c60ced99.93639395.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_695850c60ced99.93639395.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-02T23:12:06+00:00'::timestamptz,
  '2026-01-02T23:12:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  390,
  'Melisa Olguín',
  'meli.tuhys2@gmail.com',
  '2645856643',
  'Vendedor/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_390_cv_695c1786aed187.85810987.pdf',
  'cv_695c1786aed187.85810987.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_695c1786aed187.85810987.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-05T19:56:54+00:00'::timestamptz,
  '2026-01-05T19:56:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  391,
  'Facundo Carreño',
  'facundoretamalcarre15@gmail.com',
  '2646105324',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Estoy muy dispuesto aprender y ayudar en todos lo que se necesite.
Soy estudiante de Diseño multimedia en la Da Vinci. 
Se barios oficio pero no tengo certificado.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_391_cv_695d17e94ac2e1.76635836.pdf',
  'cv_695d17e94ac2e1.76635836.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_695d17e94ac2e1.76635836.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-06T14:10:49+00:00'::timestamptz,
  '2026-01-06T14:10:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  392,
  'Isaac Badías',
  'isaacbadias@gmail.com',
  '2644045353',
  'Desarrollador/a Backend',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_392_cv_695d8fa05158b5.14954528.docx',
  'cv_695d8fa05158b5.14954528.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_695d8fa05158b5.14954528.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-06T22:41:36+00:00'::timestamptz,
  '2026-01-06T22:41:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  393,
  'Yuliana Gonzalez',
  'yulianagonzalezb32@gmail.com',
  '2645824433',
  'Atención al Cliente',
  NULL,
  'Buen día, Mi nombre es Yuliana Gonzalez y me postulo para el puesto de atención al cliente. Cuento con experiencia en atención al público, manejo de caja y cobros con tarjetas. 
Adjunto mi currículum y quedo a disposición para una entrevista.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_393_cv_69626dc3a59104.24525784.pdf',
  'cv_69626dc3a59104.24525784.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69626dc3a59104.24525784.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-10T15:18:27+00:00'::timestamptz,
  '2026-01-10T15:18:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  395,
  'Yuliana Gonzalez',
  'oroyoli867@gmail.com',
  '02645824433',
  'Cajero/a',
  NULL,
  'Mi nombre es Yuliana Gonzalez y me postulo para el puesto de cajero. Cuento con experiencia en atención al público, manejo de caja y cobros con tarjeta
Adjunto mi currículum y quedo a disposición para una entrevista.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_395_cv_696297b6196ba6.80964643.pdf',
  'cv_696297b6196ba6.80964643.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696297b6196ba6.80964643.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-10T18:17:26+00:00'::timestamptz,
  '2026-01-10T18:17:26+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  396,
  'Andrea Pérez',
  'thiagojonas62@gmail.com',
  '+5492646237205',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Disponibilidad horaria: medio día de mañana (estudio/ curso de tarde)',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_396_cv_6967ec95b3e2f4.21411761.pdf',
  'cv_6967ec95b3e2f4.21411761.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6967ec95b3e2f4.21411761.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T19:20:53+00:00'::timestamptz,
  '2026-01-14T19:20:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  397,
  'Celia Castro',
  'celitta_25_4@hotmail.com',
  '2645768075',
  'Atención al Cliente',
  NULL,
  'Me pongo a disposición para cubrir cualquier puesto vacante. Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_397_cv_6967fc0a7e5f40.51139463.pdf',
  'cv_6967fc0a7e5f40.51139463.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6967fc0a7e5f40.51139463.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T20:26:50+00:00'::timestamptz,
  '2026-01-14T20:26:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  402,
  'Marcos David Molina',
  'markuzibanez@gmail.com',
  '+542645858826',
  'Electricista',
  NULL,
  'Soy una persona responsable, comprometida y con fuerte vocación por el trabajo técnico. Cuento con experiencia en tareas de mantenimiento eléctrico y electromecánico, resolución de fallas, instalación y reparación de equipos, trabajando siempre con criterio técnico, prolijidad y respeto por las normas de seguridad.

Me caracterizo por ser confiable, ordenado y práctico, con buena predisposición para el trabajo en equipo y también para desempeñarme de manera autónoma. Tengo facilidad para aprender, adaptarme a distintos entornos laborales y brindar soluciones eficientes.

Busco un puesto donde pueda aportar mi experiencia, seguir capacitándome y crecer profesionalmente, priorizando siempre la calidad del trabajo y la responsabilidad.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_402_cv_69680409a0d260.52104203.pdf',
  'cv_69680409a0d260.52104203.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69680409a0d260.52104203.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T21:00:57+00:00'::timestamptz,
  '2026-01-14T21:00:57+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  403,
  'Yanina Bragagnolo',
  'urbanartsanjuan@gmail.com',
  '2646300656',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_403_cv_696806e20ea5e4.49992369.pdf',
  'cv_696806e20ea5e4.49992369.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696806e20ea5e4.49992369.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T21:13:06+00:00'::timestamptz,
  '2026-01-14T21:13:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  404,
  'Yanina Bragagnolo',
  'yalospears25@gmail.com',
  '2647401026',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_404_cv_696807169b5ba5.22918002.pdf',
  'cv_696807169b5ba5.22918002.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696807169b5ba5.22918002.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T21:13:58+00:00'::timestamptz,
  '2026-01-14T21:13:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  406,
  'Mercedes Maria eva asaro',
  'asaromercedes@gmail.com',
  '2646215666',
  'Cajero/a',
  NULL,
  'Hola, ¿cómo están?

Les envío mi CV para formar parte de Plot Center. Como estudiante de Diseño Gráfico, me entusiasma mucho su trabajo y me gustaría aportar mi energía a su equipo.

Soy una persona proactiva, con excelente escucha y experiencia en atención al público. Estoy segura de que mi perfil se adapta muy bien a la dinámica del local.

Quedo atenta a cualquier consulta para una entrevista.
Muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_406_cv_69680bf4d287c2.58620937.pdf',
  'cv_69680bf4d287c2.58620937.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69680bf4d287c2.58620937.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T21:34:44+00:00'::timestamptz,
  '2026-01-14T21:34:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  407,
  'Victoria Gahona',
  'mgahonagodoy@gmail.com',
  '2645487588',
  'Administrativo/a de Personal',
  NULL,
  'Estudio la Lic en Artes visuales . Tengo 32 años, vivo muy cerca de la empresa, me encantaría trabajar ahí. Soy muy responsable, me adapto muy bien y me gusta dar lo mejor de mi',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_407_cv_69680eebcf91c7.71257015.pdf',
  'cv_69680eebcf91c7.71257015.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69680eebcf91c7.71257015.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T21:47:23+00:00'::timestamptz,
  '2026-01-14T21:47:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  408,
  'Jimena Costa',
  'costajimena810@gmail.com',
  '2644859191',
  'Técnico/a en Diseño',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_408_cv_69680ff8cb4505.89460920.pdf',
  'cv_69680ff8cb4505.89460920.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69680ff8cb4505.89460920.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T21:51:52+00:00'::timestamptz,
  '2026-01-14T21:51:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  409,
  'Nehemias Guerra',
  'nemiguerra1@gmail.com',
  '2644451058',
  'Cajero/a',
  NULL,
  'Actualmente tengo 19 años recien egresado de la escuela EPET N°5,  soy Técnico Electromecanico y tengo experiencia en mc donalds, me encantaria formar parte del equipo plot center, puedo contribuir en distintas areas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_409_cv_6968131fd27776.61643048.pdf',
  'cv_6968131fd27776.61643048.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968131fd27776.61643048.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T22:05:19+00:00'::timestamptz,
  '2026-01-14T22:05:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  410,
  'Luciana Elizabeth Ramirez',
  'luchiramirez000@gmail.com',
  '2644607776',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_410_cv_696820f9c12d74.31166704.pdf',
  'cv_696820f9c12d74.31166704.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696820f9c12d74.31166704.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-14T23:04:25+00:00'::timestamptz,
  '2026-01-14T23:04:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  411,
  'Virginia Molina',
  'virginiamolina157@gmail.com',
  '2646292282',
  'Administrativo/a de Personal',
  NULL,
  'Buenas noches. 
Tengo 23 años. Soy estudiante universitaria.
Actualmente me encuentro trabajando como administradora de un local gastronómico.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_411_cv_69683376bda118.94195080.pdf',
  'cv_69683376bda118.94195080.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69683376bda118.94195080.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T00:23:18+00:00'::timestamptz,
  '2026-01-15T00:23:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  412,
  'Elina Castro Lucero',
  'eli.c157@gmail.com',
  '2644658616',
  'Atención al Cliente',
  NULL,
  'Hola, me encantaría formar parte de la empresa.
Me adapto a nuevas experiencias y abierta a nuevas oportunidades y conocimientos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_412_cv_696844a4a5b108.85763941.pdf',
  'cv_696844a4a5b108.85763941.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696844a4a5b108.85763941.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T01:36:36+00:00'::timestamptz,
  '2026-01-15T01:36:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  413,
  'Melisa Guzmán',
  'meli.1998.mario@gmail.com',
  '2645595236',
  'Vendedor/a',
  NULL,
  'Me postulo al puesto de vendedor o de administrativo, o de atención al público',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_413_cv_696859a569ca75.03021549.docx',
  'cv_696859a569ca75.03021549.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696859a569ca75.03021549.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T03:06:13+00:00'::timestamptz,
  '2026-01-15T03:06:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  414,
  'Lucas Pelayes',
  'pelayes223@gmail.com',
  '2644570322',
  'Proyectista',
  NULL,
  'Soy técnico y arquitecto recién recibido!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_414_cv_69685d65d220d8.71417153.pdf',
  'cv_69685d65d220d8.71417153.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69685d65d220d8.71417153.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T03:22:13+00:00'::timestamptz,
  '2026-01-15T03:22:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  416,
  'Martín Mila',
  'martinmilla999@gmail.com',
  '2645272979',
  'Atención al Cliente',
  NULL,
  'Hola, soy Martin! Me gustaría trabajar en su comunidad de trabajo, para aplicar mis conocimientos y así poder seguir aprendiendo y mejorando en mis debilidades. Tengo una muy buena disciplina, compañerismo, predisposición para el cumplimiento de tareas y respeto hacia todos mis compañeros y superiores.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_416_cv_696870166f81f3.48069905.pdf',
  'cv_696870166f81f3.48069905.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696870166f81f3.48069905.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T04:41:58+00:00'::timestamptz,
  '2026-01-15T04:41:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  417,
  'Oriana Soledad Muñoz',
  'munozoriana5@gmail.com',
  '2645613874',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_417_cv_69687952f33b56.64059773.pdf',
  'cv_69687952f33b56.64059773.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69687952f33b56.64059773.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T05:21:22+00:00'::timestamptz,
  '2026-01-15T05:21:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  418,
  'Laureana belén lima ontiveros',
  'limalunly@gmail.com',
  '264460698',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_418_cv_6968ca80bfd043.64740386.pdf',
  'cv_6968ca80bfd043.64740386.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6968ca80bfd043.64740386.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T11:07:44+00:00'::timestamptz,
  '2026-01-15T11:07:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  420,
  'Alejandro Nicolas Olmedo',
  'alenolmedo92@gmail.com',
  '2645236102',
  'Desarrollador/a Backend',
  NULL,
  'Buenos días, soy Alejandro actualmente estudio la Licenciatura en Ciencias de la Computación y cuento con una base sólida en programación, adquirida tanto en la universidad como en proyectos freelance, trabajando con lenguajes como C/C++, Java y Python, desarrollando lógica, manejo de memoria y resolución de problemas.
También poseo experiencia en otras áreas como capacitación y manejo de personal, atención al cliente, administración, etc. que estaría encantado de dárselas a conocer a través de una entrevista. 
Desde ya muchas gracias y quedo a su disposición.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_420_cv_6968e11f3a13c0.21668641.pdf',
  'cv_6968e11f3a13c0.21668641.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968e11f3a13c0.21668641.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T12:44:15+00:00'::timestamptz,
  '2026-01-15T12:44:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  421,
  'Paula Espejo',
  'erpaula96@gmail.com',
  '2646286313',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_421_cv_6968eeace92373.41540377.pdf',
  'cv_6968eeace92373.41540377.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968eeace92373.41540377.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T13:42:04+00:00'::timestamptz,
  '2026-01-15T13:42:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  423,
  'Ysamar YNOJOZA',
  'ysamar_wyya512_4@hotmail.com',
  '2645778353',
  'Administrativo/a de Personal',
  NULL,
  '.Venezolana en Argentina en búsqueda de nuevos desafíos. Adaptable a todo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_423_cv_6968f8a7d06bd0.29673066.pdf',
  'cv_6968f8a7d06bd0.29673066.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968f8a7d06bd0.29673066.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T14:24:39+00:00'::timestamptz,
  '2026-01-15T14:24:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  424,
  'Daniela abril diaz',
  'danieladiaz217@gmail.com',
  '2345564442',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_424_cv_6968fa829f95f7.91837207.pdf',
  'cv_6968fa829f95f7.91837207.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6968fa829f95f7.91837207.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T14:32:34+00:00'::timestamptz,
  '2026-01-15T14:32:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  425,
  'Lourdes Guevara',
  'luliguevara08@gmail.com',
  '2646224289',
  'Asesor/a Comercial',
  NULL,
  'Buenas soy Lourdes y tengo actualmente 29 años. Soltera sin hija , dispuesta aprender y adaptarme a lo que el equipo necesite . Me considero buena compañera y responsable sobre todo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_425_cv_6968fd3e321e25.20442474.pdf',
  'cv_6968fd3e321e25.20442474.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6968fd3e321e25.20442474.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T14:44:14+00:00'::timestamptz,
  '2026-01-15T14:44:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  426,
  'Milena Gomez',
  'lic.criminalistica2025@gmail.com',
  '2645626013',
  'Atención al Cliente',
  NULL,
  'Hola cuento con experiencia en atención al cliente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_426_cv_69690206467498.84472911.pdf',
  'cv_69690206467498.84472911.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69690206467498.84472911.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T15:04:38+00:00'::timestamptz,
  '2026-01-15T15:04:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  427,
  'Maria Jose Perez',
  'mjperez759@gmail.com',
  '2645185942',
  'Asistente Administrativo/a',
  NULL,
  'Persona proactiva, organizada y con actitud positiva frente a nuevos desafíos. Cuento con buenas habilidades de comunicación, responsabilidad y predisposición para el trabajo en equipo. Actualmente me encuentro en formación continua, con interés en desarrollarme y crecer dentro de una organización.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_427_cv_696909c82d4b60.46715031.pdf',
  'cv_696909c82d4b60.46715031.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696909c82d4b60.46715031.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T15:37:44+00:00'::timestamptz,
  '2026-01-15T15:37:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  428,
  'Ornella Trapaglia',
  'ornella.ta0377@gmail.com',
  '2645619891',
  'Community Manager',
  NULL,
  'Estudio comunicación en la UNSJ, soy alumna avanzada y estoy buscando experiencias laborales para poder explotar mis conocimientos, así como también ampliarlos dentro del mercado laboral',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_428_cv_69690e59c7ed47.08309184.pdf',
  'cv_69690e59c7ed47.08309184.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69690e59c7ed47.08309184.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T15:57:13+00:00'::timestamptz,
  '2026-01-15T15:57:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  430,
  'Paula Agustina Cortez',
  'cortezagustina807@gmail.com',
  '2645823788',
  'Administrativo/a de Personal',
  NULL,
  'Soy profesional en Recursos Humanos, con experiencia en administración de personal, reclutamiento y selección, capacitación y acompañamiento a los equipos de trabajo. He trabajado tanto en PYMES como en contextos operativos, desarrollando una mirada ordenada, responsable y orientada a procesos.
Me interesa especialmente el puesto de Administrativo/a de Personal porque disfruto del trabajo administrativo del área, la organización, el seguimiento y el cumplimiento de procedimientos, aportando compromiso, prolijidad y buena comunicación interna. Me caracterizo por la responsabilidad, la adaptabilidad y el buen manejo de las relaciones interpersonales.
Me motiva incorporarme a Plotcenter para crecer profesionalmente y aportar valor desde la gestión diaria del área de Recursos Humanos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_430_cv_696918fa45b3b8.18743239.pdf',
  'cv_696918fa45b3b8.18743239.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696918fa45b3b8.18743239.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T16:42:34+00:00'::timestamptz,
  '2026-01-15T16:42:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  431,
  'Ramiro figueroa',
  'figramirofig@gmail.com',
  '2646281552',
  'Atención al Cliente',
  NULL,
  'Cajero.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_431_cv_6969208c6dbf13.08250402.pdf',
  'cv_6969208c6dbf13.08250402.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6969208c6dbf13.08250402.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T17:14:52+00:00'::timestamptz,
  '2026-01-15T17:14:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  432,
  'Enzo Javier Dominguez',
  'enzod4776@gmail.com',
  '2644472842',
  'Atención al Cliente',
  NULL,
  'Soy una persona responsable, proactiva y orientada al trato con el público. Cuento con experiencia en atención al cliente, manejo de caja y tareas operativas, destacándome por mi buena comunicación, predisposición para aprender y capacidad para trabajar en equipo. Tengo facilidad para adaptarme a distintos entornos laborales, mantener el orden, cumplir procedimientos y brindar una atención cordial y eficiente. Me caracterizo por su compromiso, puntualidad y buena actitud frente a las tareas asignadas.
También tengo experiencia en otras áreas además de atención al cliente. Cómo podrá ver en mi Currículum Viate, también tengo experiencia en:
Ventas: vendedor/a o asesor/a comercial, persuasión y manejo de consultas.
Caja: cajero/a, por experiencia con cobros, responsabilidad y manejo de dinero.
Administración básica: asistente administrativo/a, administrativo/a de personal junior, carga de datos, control de documentación.
Mostrador: operador/a de mostrador en comercios y locales gastronómicos.
Logística y depósito: control de mercadería, preparación de pedidos y atención interna.
Coordinación operativa junior: apoyo a encargados o jefes de área en tareas diarias.
Espero poder formar parte de su empresa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_432_cv_69692db2a046c9.07961349.pdf',
  'cv_69692db2a046c9.07961349.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69692db2a046c9.07961349.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T18:10:58+00:00'::timestamptz,
  '2026-01-15T18:10:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  433,
  'Rocio salvado',
  'rociosalvado00@gmail.com',
  '2644656275',
  'Cajero/a',
  NULL,
  'Hola buenas tardes, cualquier área de trabajo me gustaría. Estoy en busca de trabajo urgente. Me adapto y aprendo rápido',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_433_cv_696959bfe2e4f7.70598308.docx',
  'cv_696959bfe2e4f7.70598308.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696959bfe2e4f7.70598308.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-15T21:18:55+00:00'::timestamptz,
  '2026-01-15T21:18:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  434,
  'Alaniz Agüero Leticia Guadalupe',
  'letiaguero1@gmail.com',
  '2645091905',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_434_cv_696987b054fdf6.51939842.pdf',
  'cv_696987b054fdf6.51939842.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696987b054fdf6.51939842.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T00:34:56+00:00'::timestamptz,
  '2026-01-16T00:34:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  435,
  'Juan José Castro Poblete',
  'juancastro9@hotmail.com',
  '2645851559',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_435_cv_69698b9f1d0cf7.65940593.pdf',
  'cv_69698b9f1d0cf7.65940593.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69698b9f1d0cf7.65940593.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T00:51:43+00:00'::timestamptz,
  '2026-01-16T00:51:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  440,
  'Martina Pilar Gonzalez',
  'martygonza38@gmail.com',
  '+5495789518',
  'Atención al Cliente',
  NULL,
  'Mi nombre es Martina Gonzalez y me comunico con ustedes para postularme al puesto de Atención al Cliente.

Cuento con experiencia en atención al público, manejo de caja y ventas, destacándome por mi buena comunicación, responsabilidad y orientación al cliente. Además, poseo conocimientos en ofimática avanzada, lo que me permite desenvolverme con facilidad en tareas administrativas y sistemas de gestión.

Me interesa formar parte de PlotCenter por su trayectoria y compromiso con la calidad de atención. Adjunto mi currículum para su consideración y quedo a disposición para ampliar esta información en una entrevista.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_440_cv_696a59ffd4a836.22426392.pdf',
  'cv_696a59ffd4a836.22426392.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696a59ffd4a836.22426392.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T15:32:15+00:00'::timestamptz,
  '2026-01-16T15:32:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  442,
  'Lucianac28 Correa Correa Quiroga',
  'lncq28@gmail.com',
  '2646612706',
  'Asistente Administrativo/a',
  NULL,
  'Buenas tardes estimados. Aplico a puestos administrativos o afines.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_442_cv_696a6cf51074e6.47117929.pdf',
  'cv_696a6cf51074e6.47117929.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696a6cf51074e6.47117929.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T16:53:09+00:00'::timestamptz,
  '2026-01-16T16:53:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  444,
  'Bruno Rodríguez',
  'dosbruno166@gmail.com',
  '2644035264',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Hola, soy Bruno Rodríguez. Tengo 5 años de experiencia profesional en diseño, habiendo trabajado en sectores que van desde la indumentaria hasta la publicidad y logística en marcas como Patagonia y Mountain. Soy un perfil proactivo y con gran capacidad de oratoria gracias a mi experiencia en ventas y charlas informativas. Además, cuento con movilidad propia, lo que me da flexibilidad horaria y de traslado para cubrir cualquier requerimiento del puesto.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_444_cv_696ab6b563d581.03369290.pdf',
  'cv_696ab6b563d581.03369290.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_696ab6b563d581.03369290.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T22:07:49+00:00'::timestamptz,
  '2026-01-16T22:07:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  445,
  'Damara Poblete',
  'pobletdxmi@gmail.com',
  '2646274235',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_445_cv_696ac19ad913b7.17175846.pdf',
  'cv_696ac19ad913b7.17175846.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696ac19ad913b7.17175846.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-16T22:54:18+00:00'::timestamptz,
  '2026-01-16T22:54:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  447,
  'Tania Flores',
  'tanialexy35@gmail.com',
  '+5492645266940',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_447_cv_696af155958cd6.45037800.pdf',
  'cv_696af155958cd6.45037800.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696af155958cd6.45037800.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-17T02:17:57+00:00'::timestamptz,
  '2026-01-17T02:17:57+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  449,
  'Tania Flores',
  'tania_lexy@hotmail.com',
  '2645266940',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_449_cv_696af190cd47f8.30285046.pdf',
  'cv_696af190cd47f8.30285046.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696af190cd47f8.30285046.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-17T02:18:56+00:00'::timestamptz,
  '2026-01-17T02:18:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  451,
  'Jerónimo Flores',
  'jeronimoflores457@gmail.com',
  '2645262794',
  'Community Manager',
  NULL,
  'Soy Jerónimo Flores. Técnico en Marketing y Publicidad Digital. Actualmente estoy ayudando en la imagen del club Sportivo Desamparados y Desamparados Futsal. Tengo manejos en algunas otras redes sociales también. Estoy dispuesto a colaborar en lo que la empresa necesite, y en el puesto que requiera de más ayuda.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_451_cv_696b420a39c1a7.13892734.pdf',
  'cv_696b420a39c1a7.13892734.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_696b420a39c1a7.13892734.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-17T08:02:18+00:00'::timestamptz,
  '2026-01-17T08:02:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  452,
  'Mariana Gomez',
  'marilucero314@gmail.com',
  '02645409274',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_452_cv_696ba443f03d35.44201321.docx',
  'cv_696ba443f03d35.44201321.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_696ba443f03d35.44201321.docx","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-17T15:01:23+00:00'::timestamptz,
  '2026-01-17T15:01:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  453,
  'Marco Rodriguez',
  'rodsmarco@gmail.com',
  '2645404443',
  'Encargado de Presupuesto',
  NULL,
  '¡Hola! Un gusto saludar. Recientemente vi en la página web la convocatoria para "Encargado de presupuestos". Me interesó la descripción del puesto y me gustaría aplicar. Dejo adjunto mi CV y mis datos de contacto. Espero poder trabajar con ustedes, gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_453_cv_696e762717b3e6.80075074.pdf',
  'cv_696e762717b3e6.80075074.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_696e762717b3e6.80075074.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-19T18:21:27+00:00'::timestamptz,
  '2026-01-19T18:21:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  454,
  'Gabriela Salas',
  'gabrielasalas209@gmail.com',
  '+542645265794',
  'Vendedor/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_454_cv_697133e792a240.55524436.pdf',
  'cv_697133e792a240.55524436.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697133e792a240.55524436.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T20:15:35+00:00'::timestamptz,
  '2026-01-21T20:15:35+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  455,
  'Vera Lopez Pablo',
  'veralopezpablonicolas@hotmail.com',
  '2646317220',
  'Instalador/a de Cartelería',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_455_cv_69713485a0b0b7.79700312.pdf',
  'cv_69713485a0b0b7.79700312.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69713485a0b0b7.79700312.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T20:18:13+00:00'::timestamptz,
  '2026-01-21T20:18:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  456,
  'Figueroa maria',
  'maripazfigueroa24@gmail.com',
  '2644680768',
  'Cajero/a',
  NULL,
  'Buenas tardes. Me llamo Maria Figueroa tengo 28 años. Tengo experiencia en atención al público, manejo de cajas (efectivo,transferencia,qr) me gusta trabajar en equipo, soy responsable y puntual. Me encuentro a disposición para lograr los objetivos y metas de la empresa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_456_cv_69713a01a5e1d4.67805050.pdf',
  'cv_69713a01a5e1d4.67805050.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69713a01a5e1d4.67805050.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T20:41:37+00:00'::timestamptz,
  '2026-01-21T20:41:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  459,
  'Maximiliano Carbajal',
  'maxycarbajal@gmail.com',
  '2644753374',
  'Asesor/a Comercial',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_459_cv_6971472329d1d6.44749215.pdf',
  'cv_6971472329d1d6.44749215.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6971472329d1d6.44749215.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T21:37:39+00:00'::timestamptz,
  '2026-01-21T21:37:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  460,
  'Agostina Sarmiento',
  'agossarmientohys.as@gmail.com',
  '2644161958',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Hola, me llamo Agostina, tengo 23 años y actualmente estoy por recibirme de la Licenciatura en Diseño y Animación Digital. Anteriormente trabajé en Chacón Cartelería como diseñadora y en la empresa de MAS Higiene y Seguridad en el puesto de secretaria. 
Respecto a los programas, manejo Adobe Ilustreitor, Filmora, Adobe Substance Painter, Canva y un poco de Corel Drawl. 
Me entusiasma aprender y poder aportar mi creatividad a nuevos trabajos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_460_cv_69714a6d270844.83015772.pdf',
  'cv_69714a6d270844.83015772.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69714a6d270844.83015772.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T21:51:41+00:00'::timestamptz,
  '2026-01-21T21:51:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  461,
  'Giselle Lourdes Díaz Veron',
  'gisellediaz46@gmail.com',
  '2645042810',
  'Técnica universitaria en higiene y seguridad',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_461_cv_69714cbe34eef1.83775484.pdf',
  'cv_69714cbe34eef1.83775484.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69714cbe34eef1.83775484.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T22:01:34+00:00'::timestamptz,
  '2026-01-21T22:01:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  463,
  'Verónica Noemi Grimal Terrera',
  'vgrimaladm@gmail.com',
  '2645068574',
  'Asistente Administrativo/a',
  NULL,
  'Tengo experiencia en Administración (proveedores,  facturación,  impuestos provinciales y nacionales,  pago de sueldos, etc)',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_463_cv_69714d7b436ef1.02813148.pdf',
  'cv_69714d7b436ef1.02813148.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69714d7b436ef1.02813148.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T22:04:43+00:00'::timestamptz,
  '2026-01-21T22:04:43+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  464,
  'Martin Chirino',
  'martin.chirino15@gmail.com',
  '2644114776',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_464_cv_69715020c61184.45695511.pdf',
  'cv_69715020c61184.45695511.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69715020c61184.45695511.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T22:16:00+00:00'::timestamptz,
  '2026-01-21T22:16:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  466,
  'Micaela Florencia Dávila Morales',
  'micaelaflorenciadavila@gmail.com',
  '2644820646',
  'Ingeniero/a Industrial',
  NULL,
  'Mi nombre es Micaela, soy Ingeniera Industrial y cuento con experiencia en Sistemas de Gestión de Calidad, auditorías internas, seguimiento de indicadores, confección de documentación, también cuento con conocimiento en el area de Seguridad. Quedo a disposición para brindar cualquier otra información que necesiten si mi perfil es de su interés. Saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_466_cv_697150a36ba750.88774498.pdf',
  'cv_697150a36ba750.88774498.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697150a36ba750.88774498.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T22:18:11+00:00'::timestamptz,
  '2026-01-21T22:18:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  468,
  'Sanchez Lucas Emiliano',
  'eleesdg@gmail.com',
  '2645160508',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Resumen Profesional – Lucas Sánchez

Diseñador Gráfico y Community Manager con más de 5 años de experiencia en diseño visual, identidad corporativa, animación y marketing digital. He trabajado de forma freelance y en equipos multidisciplinarios para marcas, emprendimientos y organizaciones, gestionando desde la creación de logos y sitios web hasta campañas en redes sociales. Formado en la Universidad Nacional de San Juan, cuento con sólidos conocimientos en Adobe Creative Suite, edición de video, diseño web (HTML y CSS), y posicionamiento SEO. Me destaco por mi capacidad de aprendizaje rápido, pensamiento estratégico y habilidades en branding y gestión de proyectos. Mi enfoque combina creatividad, tecnología y comunicación efectiva para lograr resultados concretos.
https://www.behance.net/lucassanchez25',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_468_cv_69715a0e093af9.98872200.pdf',
  'cv_69715a0e093af9.98872200.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69715a0e093af9.98872200.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-21T22:58:22+00:00'::timestamptz,
  '2026-01-21T22:58:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  473,
  'Yael Magali Reinoso',
  'yaereinoso09@gmail.com',
  '02646218097',
  'Vendedor/a',
  NULL,
  'Desarrollarme profesionalmente dentro de la empresa, aportando mis habilidades y aprendiendo nuevas competencias.
Crecer tanto a nivel personal como profesional, contribuyendo al cumplimiento de los objetivos de la organización.
Obtener experiencia laboral que me permita mejorar mis capacidades y asumir mayores responsabilidades.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_473_cv_697169aa20b3f9.80221788.pdf',
  'cv_697169aa20b3f9.80221788.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697169aa20b3f9.80221788.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T00:04:58+00:00'::timestamptz,
  '2026-01-22T00:04:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  474,
  'Malena Vera Palacio',
  'lic.malenapalacio@gmail.com',
  '2646613200',
  'Analista de RRHH',
  NULL,
  'Mi nombre es Malena, soy licenciada en gestión de recursos humanos, estoy en búsqueda laboral activa, cuento con experiencia en el área administrativa, reclutamiento y selección de personal, capacitación, atención al cliente, entre otros. 
Mi principal objetivo es continuar adquiriendo experiencia y desempeñarme de la mejor manera posible en el puesto que se requiera.
Cuento con disponibilidad horaria y movilidad propia. 
Desde ya muchas gracias por su tiempo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_474_cv_697169ed15b5b0.56578719.pdf',
  'cv_697169ed15b5b0.56578719.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697169ed15b5b0.56578719.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T00:06:05+00:00'::timestamptz,
  '2026-01-22T00:06:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  475,
  'Mariana Torrent',
  'mariantotorrent@gmail.com',
  '2645251571',
  'Analista de RRHH',
  NULL,
  'Mi nombre es Mariana Torrent, recientemente recibida de Licenciada en Gestión de Recursos Humanos, y me encuentro en la búsqueda de mi primera oportunidad laboral. Soy una persona muy creativa, me gusta mucho el diseño, soy organizada y comprometida, con muchas ganas de aprender y aportar desde el lugar que se me asigne.
Me encantaría tener la posibilidad de formar parte de Plot Center y sumar mi trabajo al equipo. Adjunto mi currículum para su consideración.
Muchas gracias por su tiempo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_475_cv_69716c1348cc95.39471918.pdf',
  'cv_69716c1348cc95.39471918.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69716c1348cc95.39471918.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T00:15:15+00:00'::timestamptz,
  '2026-01-22T00:15:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  476,
  'Angel Alanis',
  'alanis.angel1988@gmail.com',
  '2645454956',
  'Operario de Depósito',
  NULL,
  'A quien corresponda:

Me dirijo a ustedes con el fin de postularme al puesto de Operario de Depósito / Logística, poniendo a disposición mi predisposición para el trabajo, responsabilidad y compromiso con las tareas asignadas.

Cuento con experiencia en labores generales de depósito, tales como recepción y control de mercadería, carga y descarga, preparación de pedidos, orden y mantenimiento del área de trabajo, y cumplimiento de normas de seguridad e higiene. Me adapto con facilidad al trabajo en equipo y a los ritmos propios del sector logístico.

Me considero una persona puntual, ordenada y con buena disposición para aprender y cumplir instrucciones, orientado a colaborar con el correcto funcionamiento del depósito y el cumplimiento de los objetivos diarios.

Adjunto mi currículum vitae para su evaluación y quedo a disposición para una entrevista personal.

Sin otro particular, los saludo atentamente.

Angel Orlando Alanis',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_476_cv_6971733b11c122.05126097.pdf',
  'cv_6971733b11c122.05126097.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6971733b11c122.05126097.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T00:45:47+00:00'::timestamptz,
  '2026-01-22T00:45:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  477,
  'Claudio Mahmud',
  'claudiomahmud@gmail.com',
  '3364219034',
  'Electricista',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_477_cv_6971751801ab17.29128696.pdf',
  'cv_6971751801ab17.29128696.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6971751801ab17.29128696.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T00:53:44+00:00'::timestamptz,
  '2026-01-22T00:53:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  478,
  'Lucas Guzmán',
  'guzmanlucasalberto@gmail.com',
  '2645489626',
  'Cajero/a',
  NULL,
  'Tengo experiencia en caja. Soy efectivo y rápido. Si no se algo lo aprendo rápido.
Se cobrar con todos los medios',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_478_cv_697182fd61e796.97407368.pdf',
  'cv_697182fd61e796.97407368.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697182fd61e796.97407368.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T01:53:01+00:00'::timestamptz,
  '2026-01-22T01:53:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  479,
  'Andrea carolina Pinto',
  'caro.pinto89@gmail.com',
  '2644468999',
  'Administrativo/a de Personal',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_479_cv_69718428a15d59.00099196.pdf',
  'cv_69718428a15d59.00099196.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69718428a15d59.00099196.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T01:58:00+00:00'::timestamptz,
  '2026-01-22T01:58:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  481,
  'Andrea Carolina Pinto',
  'pinto.nina64@gmail.com',
  '2644468999',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_481_cv_697184aaeb9795.72032182.pdf',
  'cv_697184aaeb9795.72032182.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697184aaeb9795.72032182.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T02:00:10+00:00'::timestamptz,
  '2026-01-22T02:00:10+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  482,
  'Luciano gauna',
  'lucigauna682@gmail.com',
  '02931409457',
  'Asistente Administrativo/a',
  NULL,
  'Estoy en busca de trabajo estoy capacitado para asumir desafíos importantes estoy estudiando una tecnicatura superior en administración de empresas y contable',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_482_cv_69718836a26678.36874406.pdf',
  'cv_69718836a26678.36874406.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69718836a26678.36874406.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T02:15:18+00:00'::timestamptz,
  '2026-01-22T02:15:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  483,
  'Gastón Maximiliano Quiroga',
  'maxiquiroga277@gmail.com',
  '2645071432',
  'Instalador/a de Cartelería',
  NULL,
  'Saludos.
Mi nombre es Gastón Quiroga. Es un placer para mi hacerle llegar mi Currículum vitae, el cual dejo adjunto a este correo electrónico. Estoy realmente interesado en poder obtener un puesto de trabajo en la empresa y considero que lo puedo desempeñar correctamente.
Espero que mi perfil sea de su agrado y quedo a su entera disposición. Si me da la oportunidad, será para mi un placer ampliar cualquier información que usted considere conveniente.

Muchas gracias de antemano por su atención, reciba un cordial saludo. 

Atte: Gastón Maximiliano Quiroga. 
Número de contacto: 2645071432 - 2644036239.
Correo: Maxiquiroga277@gmail.com',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_483_cv_69718a5673c002.10660812.pdf',
  'cv_69718a5673c002.10660812.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69718a5673c002.10660812.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T02:24:22+00:00'::timestamptz,
  '2026-01-22T02:24:22+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  484,
  'Valeria Bravo',
  'vale.bdlt@gmail.com',
  '2646273551',
  'Administrativo/a de Personal',
  NULL,
  'Soy una persona responsable y proactiva, con experiencia en atención al cliente y administración. Me adapto rápido, me gusta trabajar en equipo y aprender cosas nuevas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_484_cv_69718ea8b15197.65103772.pdf',
  'cv_69718ea8b15197.65103772.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69718ea8b15197.65103772.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T02:42:48+00:00'::timestamptz,
  '2026-01-22T02:42:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  486,
  'Valeria Bravo',
  'rrhh.almendra@gmail.com',
  '2646273551',
  'Cajero/a',
  NULL,
  'Soy una persona responsable y proactiva, con experiencia en atención al cliente y manejo de caja. Me adapto rápido, me gusta trabajar en equipo y aprender cosas nuevas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_486_cv_69718ee10bcca3.53578642.pdf',
  'cv_69718ee10bcca3.53578642.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69718ee10bcca3.53578642.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T02:43:45+00:00'::timestamptz,
  '2026-01-22T02:43:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  487,
  'Gabriel Esteban Montenegro Ortiz',
  'gabrielm846@gmail.com',
  '2644624657',
  'Asistente Administrativo/a',
  NULL,
  'Soy Gabriel Montenegro, recientemente graduado de Licenciado en Administración, cuento con experiencia trabajando en el área de desarrollo de negocios en WES y actualmente busco oportunidades donde pueda desarrollarme profesionalmente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_487_cv_69719179621987.81802230.pdf',
  'cv_69719179621987.81802230.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69719179621987.81802230.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T02:54:49+00:00'::timestamptz,
  '2026-01-22T02:54:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  488,
  'Valdez Alberto',
  'albeert.valdez.29@gmail.com',
  '2995746960',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_488_cv_6971942915f6c7.71195574.pdf',
  'cv_6971942915f6c7.71195574.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6971942915f6c7.71195574.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T03:06:17+00:00'::timestamptz,
  '2026-01-22T03:06:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  490,
  'Ignacio Manuel Ponce',
  'nachomponce@gmail.com',
  '2644174703',
  'Generalista de RRHH',
  NULL,
  'Mi nombre es Ignacio, soy estudiante avanzado de RRHH, llevo un año desempeñándome como generalista y reclutador de forma remota. Me gusta aplicar para futuras vacantes con ustedes!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_490_cv_6971a657062378.18574170.pdf',
  'cv_6971a657062378.18574170.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6971a657062378.18574170.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T04:23:51+00:00'::timestamptz,
  '2026-01-22T04:23:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  492,
  'Leonel Campillay',
  'leonelcbussines@gmail.com',
  '2645717166',
  'Encargado de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_492_cv_697201f6a0b1d8.20994261.pdf',
  'cv_697201f6a0b1d8.20994261.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697201f6a0b1d8.20994261.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T10:54:46+00:00'::timestamptz,
  '2026-01-22T10:54:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  493,
  'Matías Jesús Guevara Agüero',
  'mati.mjga@gmail.com',
  '2646623771',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_493_cv_69720a7feefcd4.67050504.pdf',
  'cv_69720a7feefcd4.67050504.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69720a7feefcd4.67050504.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T11:31:11+00:00'::timestamptz,
  '2026-01-22T11:31:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  495,
  'Marisel Del Valle Moreno',
  'mariseldelvalle2696@gmail.com',
  '2645059475',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_495_cv_69721a19512331.40554474.pdf',
  'cv_69721a19512331.40554474.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69721a19512331.40554474.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T12:37:45+00:00'::timestamptz,
  '2026-01-22T12:37:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  496,
  'Sonia Esther Briones',
  'soniabriones1978@gmail.com',
  '2644136462',
  'Administrativo/a Contable',
  NULL,
  'Soy Administrativa Contable con más de 15 años de experiencia en el sector público y privado, con sólidos conocimientos en tareas administrativas, contables y manejo de sistemas informáticos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_496_cv_69721ece86d999.49038167.pdf',
  'cv_69721ece86d999.49038167.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69721ece86d999.49038167.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T12:57:50+00:00'::timestamptz,
  '2026-01-22T12:57:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  497,
  'Juan Carlos Gimenez',
  'juancgimenez.142@gmail.com',
  '2604346256',
  'Instrusmentista para Oil & gas',
  NULL,
  'Hola, gusto en saludar. A continuación adjunto mi CV para el puesto. Desde ya muchas gracias y quedo atento a cualquier novedad. 

Saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_497_cv_6972218a3161e5.30934810.pdf',
  'cv_6972218a3161e5.30934810.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972218a3161e5.30934810.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T13:09:30+00:00'::timestamptz,
  '2026-01-22T13:09:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  499,
  'Celia Castro',
  'celiaselia653@gmail.com',
  '2645768075',
  'Cajero/a',
  NULL,
  'Busco una oportunidad laboral seria, me pongo a disposición para cubrir algún puesto vacante, prometo dar todo de mi para cumplir con las expectativas. Gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_499_cv_697223319f8518.18292504.pdf',
  'cv_697223319f8518.18292504.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697223319f8518.18292504.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T13:16:34+00:00'::timestamptz,
  '2026-01-22T13:16:34+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
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
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  525,
  'Diaz Sanchez Julieta Agustina Clarita',
  'julidiazsanchez2006@gmail.com',
  '2646600624',
  'Atención al Cliente',
  NULL,
  'Mi nombre es Julieta tengo 19 años y me gustaría tener la posibilidad aprender y aplicar mis habilidades en atención al cliente, en su empresa, desde ya muchas gracias por su atención, y espero su respuesta!!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_525_cv_697265cc896335.15264295.pdf',
  'cv_697265cc896335.15264295.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697265cc896335.15264295.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T18:00:44+00:00'::timestamptz,
  '2026-01-22T18:00:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  526,
  'Matias Ahumada',
  'ivanmatias907@gmail.com',
  '2646265607',
  'Atención al Cliente',
  NULL,
  'Tengo experiencia en atención al público.
Soy locutor , tengo experiencia en ventas.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_526_cv_6972673a72e730.80236766.pdf',
  'cv_6972673a72e730.80236766.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972673a72e730.80236766.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T18:06:50+00:00'::timestamptz,
  '2026-01-22T18:06:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  527,
  'Ludmila Astorga',
  'luliastorga1@gmail.com',
  '2645672759',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_527_cv_6972675d2bf096.49585795.pdf',
  'cv_6972675d2bf096.49585795.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6972675d2bf096.49585795.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T18:07:25+00:00'::timestamptz,
  '2026-01-22T18:07:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  529,
  'Sabrina Santander',
  'saelisa666@gmail.com',
  '2645309174',
  'Asistente Administrativo/a',
  NULL,
  'Vendedor, atención al público, cajero',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_529_cv_697268bc5d4fd6.75005756.pdf',
  'cv_697268bc5d4fd6.75005756.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697268bc5d4fd6.75005756.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T18:13:16+00:00'::timestamptz,
  '2026-01-22T18:13:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  530,
  'Facundo Vera',
  'facundovera.tech@gmail.com',
  '2645732745',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_530_cv_6972692aa5d676.38756612.pdf',
  'cv_6972692aa5d676.38756612.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972692aa5d676.38756612.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T18:15:06+00:00'::timestamptz,
  '2026-01-22T18:15:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  532,
  'Facundo Vera',
  'fvgraficas@gmail.com',
  '2645732745',
  'Analista de Presupuestos',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_532_cv_697269733e9235.20474631.pdf',
  'cv_697269733e9235.20474631.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697269733e9235.20474631.pdf","migrated_at":"2026-06-09T11:23:49.256Z"}'::jsonb,
  '2026-01-22T18:16:19+00:00'::timestamptz,
  '2026-01-22T18:16:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  533,
  'Fernando Martinez',
  'fm188239@gmail.com',
  '2646307137',
  'Atención al Cliente',
  NULL,
  'Buenas envío curriculum con experiencia de encargado de logistica,atención al cliente y vendedor.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_533_cv_69726c6c90c496.32252324.pdf',
  'cv_69726c6c90c496.32252324.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69726c6c90c496.32252324.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T18:29:00+00:00'::timestamptz,
  '2026-01-22T18:29:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  534,
  'Elias Ponce',
  'eliasponce0424@gmail.com',
  '2644456142',
  'Atención al Cliente',
  NULL,
  'Mi nombre es Elias Ponce y les escribo porque me gustaría postularme para trabajar en Plotcenter. Cuento con muchas ganas de laburar, aprender y sumarme a un equipo de trabajo profesional. Soy responsable, puntual y me adapto bien a distintas tareas, tanto de atención al público como de trabajo técnico. Quedo a disposición para coordinar una entrevista o acercar mi CV cuando lo consideren. Muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_534_cv_69726cc671cc36.05750706.pdf',
  'cv_69726cc671cc36.05750706.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69726cc671cc36.05750706.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T18:30:30+00:00'::timestamptz,
  '2026-01-22T18:30:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  535,
  'Lourdes Micaela Garay Fernandez',
  'luli.rnr.88@gmail.com',
  '2646716586',
  'Atención al Cliente',
  NULL,
  'Mi nombre es Lourdes y me postulo para el puesto de Atención al Cliente. Disfruto el trato con las personas y me caracterizo por ser amable, responsable y con buena predisposición. Tengo experiencia en atención al público, me adapto con facilidad y me gusta trabajar de manera ordenada y prolija. Busco una oportunidad laboral estable donde pueda aportar compromiso y seguir aprendiendo dentro de la empresa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_535_cv_69726d3ec00097.57444067.pdf',
  'cv_69726d3ec00097.57444067.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69726d3ec00097.57444067.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T18:32:30+00:00'::timestamptz,
  '2026-01-22T18:32:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  536,
  'vir martinez',
  'virgimartinez247@gmail.com',
  '02645297639',
  'Asistente Administrativo/a',
  NULL,
  'Estimado/a: 

Mi nombre es Virginia Martinez y me postulo para el puesto de Asistente Administrativo en Plot Center. Me interesa formar parte de una gráfica donde pueda aportar mis habilidades organizativas, administrativas y de atención al cliente, colaborando con el correcto funcionamiento del área.

Cuento con experiencia en tareas administrativas generales, manejo de pedidos, control de stock, organización de información y atención al público, tanto de manera presencial como digital. Me considero una persona responsable, ordenada y resolutiva, con buena predisposición para el trabajo en equipo y aprendizaje continuo.

Me adapto con facilidad a entornos dinámicos y valoro mucho la prolijidad, el cumplimiento de plazos y la buena comunicación, aspectos fundamentales en un entorno gráfico y de producción.

Quedo a disposición para ampliar esta información en una entrevista y adjunto mi currículum para su consideración.

Muchas gracias por su tiempo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_536_cv_69726ec4613c57.11390208.pdf',
  'cv_69726ec4613c57.11390208.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69726ec4613c57.11390208.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T18:39:00+00:00'::timestamptz,
  '2026-01-22T18:39:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  537,
  'yamila Luna',
  'lunafernnandam@gmail.com',
  '2617210256',
  'Atención al Cliente',
  NULL,
  'Soy una persona comprometida, amable y responsable, a la que le gusta el trato con las personas. Me caracterizo por escuchar con atención, brindar una atención cordial y buscar siempre soluciones claras y efectivas para cada cliente. Tengo buena predisposición, aprendo rápido y me adapto con facilidad a distintos entornos de trabajo. Disfruto aportar una actitud positiva, respeto y profesionalismo en cada tarea que realizo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_537_cv_69727253e30cb8.07380437.pdf',
  'cv_69727253e30cb8.07380437.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69727253e30cb8.07380437.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T18:54:11+00:00'::timestamptz,
  '2026-01-22T18:54:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  539,
  'Ismael garay',
  'laylamendoza66@gmail.com',
  '2645014039',
  'Atención al Cliente',
  NULL,
  'Hola mi nombre es imael garay de 22 años me se q buscan chicas pero me gustaria pertenecer a su equipo de trabajo tengo experiencia en atención al publico y  para poder tener una mejor forma de vida para mi hijo y para mi  esposa estamos pasando una mala situacion economica espero respuestas prontos gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_539_cv_6972757aa39798.37497499.pdf',
  'cv_6972757aa39798.37497499.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972757aa39798.37497499.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T19:07:38+00:00'::timestamptz,
  '2026-01-22T19:07:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  540,
  'Jennyfer Espin',
  'jennyferespin.103@gmail.com',
  '2645878078',
  'Analista de Presupuestos',
  NULL,
  'Buen día Estimados, me postulo para la Vacante actual o cualquier otro que se pueda presentar en el área Administrativa. Saludos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_540_cv_69727a024fc952.64162351.pdf',
  'cv_69727a024fc952.64162351.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69727a024fc952.64162351.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T19:26:58+00:00'::timestamptz,
  '2026-01-22T19:26:58+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  541,
  'Rocio Soledad Aballay',
  'rocioaballay1995@gmail.com',
  '2644570740',
  'Atención al Cliente',
  NULL,
  'Buenas tardes soy Rocio, tengo experiencia en atención al cliente y también como asesora comercial, por lo tanto en caso de ser elegida sera un placer en conjunto con ustedes, cualquier consulta estoy a su disposición. Desde ya, muchas gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_541_cv_69727cc16c7c58.78714488.pdf',
  'cv_69727cc16c7c58.78714488.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69727cc16c7c58.78714488.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T19:38:41+00:00'::timestamptz,
  '2026-01-22T19:38:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  542,
  'Mauro Payero',
  'payeromauro064@gmail.com',
  '2645803980',
  'Cajero/a',
  NULL,
  'Soy una persona pro activa, muy predispuesta y no me cierro a nuevas experiencias, todo mi tiempo e probado diferentes orientaciones de trabajo, siempre con el aprender mas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_542_cv_697284715588a7.09696375.docx',
  'cv_697284715588a7.09696375.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697284715588a7.09696375.docx","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T20:11:29+00:00'::timestamptz,
  '2026-01-22T20:11:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  543,
  'Mateo Manuel Vallejos Civico',
  'mateovallejoscivico@gmail.com',
  '2645319312',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_543_cv_697289ec146ab3.51737065.pdf',
  'cv_697289ec146ab3.51737065.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_697289ec146ab3.51737065.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T20:34:52+00:00'::timestamptz,
  '2026-01-22T20:34:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  544,
  'MATIAS MONTENEGRO',
  'onemoreclub.ar@gmail.com',
  '2645070857',
  'Atención al Cliente',
  NULL,
  'Buenas tardes estoy interesado en formar parte de la empresa. Soy muy responsable puntual me gusta trabajar en equipo y tengo mucha actitud. Tengo experiencia en asesoría comercial en caja y como así también me desenvuelvo como operario. Quedó a su disposición.
Atte: Matías Montenegro',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_544_cv_69728ad43768c3.35785174.pdf',
  'cv_69728ad43768c3.35785174.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69728ad43768c3.35785174.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T20:38:44+00:00'::timestamptz,
  '2026-01-22T20:38:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  545,
  'Hugo Gabriel Barrera',
  'hugogabrielbarrera@gmail.com',
  '2645037472',
  'Soldador/a',
  NULL,
  '20 años de Experiencia en la Industria Metalmecanica, Soy Técnico Informático, Técnico Aeronáutico (Mecánico), Soldador (Mig, Mag, Tig), Montador de Estructuras (Livianas, Pesadas), Mantenimiento Mecánico, Mantenimiento en General,',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_545_cv_69728fbc5a3e65.94751250.pdf',
  'cv_69728fbc5a3e65.94751250.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_69728fbc5a3e65.94751250.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T20:59:40+00:00'::timestamptz,
  '2026-01-22T20:59:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  546,
  'Polis Barbara Valentina',
  'valenchubarbi.43952.2001.2022@gmail.com',
  '2645829652',
  'Asistente Administrativo/a',
  NULL,
  'Hola buenas tardes , bueno espero poder tener un puesto de trabajo en su empresa ya que lo necesito, estoy desempleada y la verdad ganas de trabajar hay , aprendo rápido , horarios full time ...espero su respuesta desde ya muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_546_cv_69729ea7155d83.67616894.pdf',
  'cv_69729ea7155d83.67616894.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_69729ea7155d83.67616894.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T22:03:19+00:00'::timestamptz,
  '2026-01-22T22:03:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  547,
  'Justina Cuello',
  'cuelloyustina@gmail.com',
  '2645440706',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_547_cv_6972b14c661251.91938276.pdf',
  'cv_6972b14c661251.91938276.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972b14c661251.91938276.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-22T23:22:52+00:00'::timestamptz,
  '2026-01-22T23:22:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  548,
  'Marcos Elias Gallardo Kun',
  'marcoselias2000@hotmail.com',
  '2645067769',
  'Vendedor/a',
  NULL,
  '¡Hola! Buenas tardes
Mi nombre es Marcos Gallardo y me dirijo a ud. con el motivo de que había visto publicado a través de un anuncio 
la oportunidad de trabajar con ustedes, oportunidad a la cual me gustaría postular.

Asimismo, tengo experiencia tanto en el sector administrativo, ventas, y atención al público.
Cuento con disponibilidad Full time, al igual que tengo disponibilidad los fines de semana y feriados. 
Envío adjunto mi Currículum Vitae y quedo a su disposición.

Muchas gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_548_cv_6972cb5447e2f1.87114354.pdf',
  'cv_6972cb5447e2f1.87114354.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972cb5447e2f1.87114354.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T01:13:56+00:00'::timestamptz,
  '2026-01-23T01:13:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  549,
  'Franco Zavalla',
  'francozavalla97@gmail.com',
  '2645402788',
  'Mecánico/a',
  NULL,
  'Hola estimados, mí nombre es Franco Zavalla, tengo 28 años, soy técnico Mecánico recibido de escuela Industrial, estoy en búsqueda laboral activa, soy una persona responsable, detallista y me adapto fácil a cualquier área de trabajo, desde ya muchas gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_549_cv_6972e20f271357.79570791.pdf',
  'cv_6972e20f271357.79570791.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972e20f271357.79570791.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T02:50:55+00:00'::timestamptz,
  '2026-01-23T02:50:55+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  550,
  'Daiana Ailen Oropel Quinteros',
  'oropeldaiana121@gmail.com',
  '2646267728',
  'Cajero/a',
  NULL,
  'A lo largo de mi experiencia laboral eh desarrollado responsabilidad, organizacion y atencion al detalle, asimismo estoy acostumbrada a trabajar en entornos dinamicos, manteniendo un trato cordial, respetuoso con los clientes y compañeros de trabajo. Me considero una persona proactiva confiable y con gran compromiso laboral, con facilidad para adaptarme a distintos sistemas de trabajo y aprender de nuevos procedimientos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_550_cv_6972e2ee8ebe81.08180938.pdf',
  'cv_6972e2ee8ebe81.08180938.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6972e2ee8ebe81.08180938.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T02:54:38+00:00'::timestamptz,
  '2026-01-23T02:54:38+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  551,
  'Gustavo Nuñez',
  'gustavo.nunez.3655@gmail.com',
  '2644623927',
  'Instalador/a de Cartelería',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_551_cv_69735f9d45e0e9.36856106.pdf',
  'cv_69735f9d45e0e9.36856106.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69735f9d45e0e9.36856106.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T11:46:37+00:00'::timestamptz,
  '2026-01-23T11:46:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  552,
  'Axel Rodrigo Peralta vega',
  'rodrive766@gmail.com',
  '2644438318',
  'Electricista',
  NULL,
  'Quisiera formar parte del equipo y mostrar mis experiencias y trabajar en equipo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_552_cv_6973658c72cd61.03410728.pdf',
  'cv_6973658c72cd61.03410728.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973658c72cd61.03410728.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T12:11:56+00:00'::timestamptz,
  '2026-01-23T12:11:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  553,
  'Enzo ariel muñoz',
  'enzoarielmunoz850@gmail.com',
  '02644620323',
  'Cajero/a',
  NULL,
  'Me destaco por mi responsabilidad, compromiso y buen trato con las personas. Cuento con experiencia en atención al cliente, caja,administración y ventas, y me adapto fácilmente a nuevos desafíos. Busco un puesto donde pueda aportar, aprender y crecer dentro de un equipo de trabajo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_553_cv_6973848179b696.29182731.pdf',
  'cv_6973848179b696.29182731.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973848179b696.29182731.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T14:24:01+00:00'::timestamptz,
  '2026-01-23T14:24:01+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  554,
  'German Anibal Vega',
  'germanvega@live.com.ar',
  '02644587609',
  'Cajero/a',
  NULL,
  'Soy una persona comprometida y entusiasta al logro de objetivos en forma grupal',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_554_cv_6973952651ff69.36426796.pdf',
  'cv_6973952651ff69.36426796.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973952651ff69.36426796.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T15:35:02+00:00'::timestamptz,
  '2026-01-23T15:35:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  555,
  'Martín Eduardo Echegaray Castro',
  'martinechegaray200@gmail.com',
  '2645313269',
  'Atención al Cliente',
  NULL,
  'Mi nombre es Martín Echegaray, tengo 25 años y resido en Rivadavia. Me postulo al puesto de atención al cliente, contando con experiencia en ventas, orientación a resultados y buen manejo de relaciones interpersonales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_555_cv_6973b01ac792b4.37430455.pdf',
  'cv_6973b01ac792b4.37430455.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973b01ac792b4.37430455.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T17:30:02+00:00'::timestamptz,
  '2026-01-23T17:30:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  556,
  'Guadalupe Pizarro',
  'aguadapizarro@gmail.com',
  '2646277707',
  'Atención al Cliente',
  NULL,
  'Soy una persona responsable, con buena predisposición y orientación a la atención al público. Me gusta trabajar con personas, aprender cosas nuevas y cumplir con las tareas de manera ordenada y comprometida. Me adapto con facilidad, tengo buena actitud y busco aportar responsabilidad y ganas de trabajar al equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_556_cv_6973c294777eb0.54996968.pdf',
  'cv_6973c294777eb0.54996968.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973c294777eb0.54996968.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T18:48:52+00:00'::timestamptz,
  '2026-01-23T18:48:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  557,
  'Guadalupe Pizarro',
  'guadapizarro.2421@gmail.com',
  '2646277707',
  'Asistente Administrativo/a',
  NULL,
  'Soy una persona responsable, organizada y con buena predisposición para el trabajo administrativo. Me adapto con facilidad, presto atención a los detalles y me gusta mantener el orden y el cumplimiento de las tareas. Busco aportar compromiso, responsabilidad y ganas de aprender al equipo de trabajo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_557_cv_6973c2dfe74203.30711428.pdf',
  'cv_6973c2dfe74203.30711428.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973c2dfe74203.30711428.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T18:50:07+00:00'::timestamptz,
  '2026-01-23T18:50:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  558,
  'Maria Rosa Garcia',
  'marirogarcia06@gmail.com',
  '2646119454',
  'Cajero/a',
  NULL,
  'Hola buenas tardes 
Me comunico para postularme algun puesto.
Adjunto mi currículum para su consideración. Quedo a disposición para una entrevista o brindar más información si lo requieren.

Muchas gracias por su tiempo y consideración.

Saludos cordiales,
Maria Rosa Garcia 
2646119454',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_558_cv_6973dd979b0f75.72691302.docx',
  'cv_6973dd979b0f75.72691302.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973dd979b0f75.72691302.docx","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T20:44:07+00:00'::timestamptz,
  '2026-01-23T20:44:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  559,
  'Sol Figueroa',
  'fsol1829@gmail.com',
  '2645859233',
  'Atención al Cliente',
  NULL,
  'Soy una persona responsable, con buen trato al cliente, organizada y con facilidad para aprender y adaptarme.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_559_cv_6973f4bdb1ca19.90987735.pdf',
  'cv_6973f4bdb1ca19.90987735.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973f4bdb1ca19.90987735.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T22:22:53+00:00'::timestamptz,
  '2026-01-23T22:22:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  560,
  'Gustavo Keaik',
  'gkeaik@gmail.com',
  '2644003570',
  'Cajero/a',
  NULL,
  'Soy una persona responsable y proactiva, con experiencia en atención al cliente, manejo de caja, cobros y control de operaciones. Me destaco por el buen trato, la organización y la capacidad para trabajar en equipo. Tengo disponibilidad horaria y compromiso con el buen funcionamiento del punto de venta.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_560_cv_6973f8e40cf947.69624982.pdf',
  'cv_6973f8e40cf947.69624982.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6973f8e40cf947.69624982.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-23T22:40:36+00:00'::timestamptz,
  '2026-01-23T22:40:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  561,
  'Miguel Antonio Lopez',
  'tonyyylopez@outlook.com',
  '02644042148',
  'Atención al Cliente',
  NULL,
  'Estimado/a:

Me dirijo a usted con el fin de postularme para oportunidades laborales acordes a mi perfil. Adjunto mi currículum vitae para su consideración, quedando a disposición para ampliar cualquier información que considere necesaria.

Cuento con disponibilidad y predisposición para desempeñarme en el puesto que la empresa requiera, aportando compromiso, responsabilidad y ganas de trabajar.

Desde ya, muchas gracias por su tiempo y consideración.

Atentamente,
Miguel Antonio López',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_561_cv_69743564a4bd65.89107380.pdf',
  'cv_69743564a4bd65.89107380.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69743564a4bd65.89107380.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-24T02:58:44+00:00'::timestamptz,
  '2026-01-24T02:58:44+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  562,
  'Andrés Muro',
  'andres.muro@protonmail.com',
  '2644609987',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_562_cv_697471f0ef6798.14926847.pdf',
  'cv_697471f0ef6798.14926847.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697471f0ef6798.14926847.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-24T07:17:04+00:00'::timestamptz,
  '2026-01-24T07:17:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  563,
  'Sol Gomez',
  'solgomeez16@gmail.com',
  '2645870869',
  'Asistente Administrativo/a',
  NULL,
  'Ademas del puesto al que me postulo tengo la experiencia y conocimiento para aplicar a otros de loa puestos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_563_cv_6974ec2c255665.82627534.pdf',
  'cv_6974ec2c255665.82627534.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6974ec2c255665.82627534.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-24T15:58:36+00:00'::timestamptz,
  '2026-01-24T15:58:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  564,
  'Matias Vicentela',
  'mativicentela@gmail.com',
  '2644706196',
  'Vendedor/a',
  NULL,
  'Responsable con ganas de trabajar',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_564_cv_69754bc94fe483.66734411.pdf',
  'cv_69754bc94fe483.66734411.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69754bc94fe483.66734411.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-24T22:46:33+00:00'::timestamptz,
  '2026-01-24T22:46:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  565,
  'Facundo Tomas Quiroga',
  'facutq4@gmail.com',
  '264 467-3226',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_565_cv_697570cc7228c3.54118854.pdf',
  'cv_697570cc7228c3.54118854.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697570cc7228c3.54118854.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-25T01:24:28+00:00'::timestamptz,
  '2026-01-25T01:24:28+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  567,
  'Facundo Tomas Quiroga',
  'lf6969487@gmail.com',
  '264 467-3226',
  'Vendedor/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_567_cv_69757110f2e584.92166295.pdf',
  'cv_69757110f2e584.92166295.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69757110f2e584.92166295.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-25T01:25:36+00:00'::timestamptz,
  '2026-01-25T01:25:36+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  568,
  'Fernandez Maximiliano Manuel',
  'maximilianofernandez964@gmail.com',
  '2646273031',
  'Administrativo/a de Personal',
  NULL,
  'Soy Técnico Universitario en Archivistica, graduado en la Universidad Nacional de San Juan, soy una persona ordenada y me gusta el trabajo en equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_568_cv_69757e3f7498f9.94615703.pdf',
  'cv_69757e3f7498f9.94615703.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69757e3f7498f9.94615703.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-25T02:21:51+00:00'::timestamptz,
  '2026-01-25T02:21:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  569,
  'OMAR HERMAN VILLARROEL CUEVAS',
  'omarbboy19@gmail.com',
  '2645297030',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'HOLA ESTE ES MI EXTENSO CURRICULUM DESEO QUE LO MIREN CON ATENCION Y SI ME PUDIERAN DAR LA OPORTUNIDAD DE TRABAJAR ESTARE ETERNAMENTE AGRADESIDO. ESPERO SU RESPUESTA ATENTAMENTE. SALUDOS.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_569_cv_69758c082469b3.13956502.pdf',
  'cv_69758c082469b3.13956502.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_69758c082469b3.13956502.pdf","migrated_at":"2026-06-09T11:23:49.257Z"}'::jsonb,
  '2026-01-25T03:20:40+00:00'::timestamptz,
  '2026-01-25T03:20:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  570,
  'Carlos Alberto Tapia',
  'carlostapia1988@gmail.com',
  '2644129806',
  'Cajero/a',
  NULL,
  'Hola, mi nombre es Carlos Tapia, y cuento con experiencia en ventas, manejo de caja y trato directo con clientes.
Me caracterizo por el compromiso, la responsabilidad y el buen trato interpersonal, y me interesa formar parte de un equipo de trabajo donde pueda aportar desde la atención y el servicio al cliente.
Quedo a disposición para ampliar información o coordinar una entrevista.
Saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_570_cv_6976774eb1afe0.39758593.pdf',
  'cv_6976774eb1afe0.39758593.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6976774eb1afe0.39758593.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-25T20:04:30+00:00'::timestamptz,
  '2026-01-25T20:04:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  572,
  'Maira Alejandra Rojas',
  'mairar682@gmail.com',
  '2645169637',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_572_cv_6977754db897c9.10262458.pdf',
  'cv_6977754db897c9.10262458.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_6977754db897c9.10262458.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-26T14:08:13+00:00'::timestamptz,
  '2026-01-26T14:08:13+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  573,
  'Fernando Abel Torres',
  'purasluces@gmail.com',
  '264468282',
  'Electricista',
  NULL,
  'Soy una persona pro activa, con gran capacidad de aprendizaje y resolución de problemas. Poseo muy buena comunicación, busco crecer y expandirme en todo lo que implique conocimiento técnico/tecnológico.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_573_cv_697780571516a5.00954883.pdf',
  'cv_697780571516a5.00954883.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697780571516a5.00954883.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-26T14:55:19+00:00'::timestamptz,
  '2026-01-26T14:55:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  575,
  'Martín Adolfo Valdez',
  'management.pym@gmail.com',
  '03816580077',
  'Jefe de Área',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_575_cv_6977c25c852333.27492573.pdf',
  'cv_6977c25c852333.27492573.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6977c25c852333.27492573.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-26T19:37:00+00:00'::timestamptz,
  '2026-01-26T19:37:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  576,
  'Florencia Barahona',
  'florenciab953@gmail.com',
  '2622-516863',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_576_cv_6977d840c12dc2.03574945.pdf',
  'cv_6977d840c12dc2.03574945.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6977d840c12dc2.03574945.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-26T21:10:24+00:00'::timestamptz,
  '2026-01-26T21:10:24+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  577,
  'Jesica Montaña',
  'jesica.m0587@gmail.com',
  '2644059510',
  'Administrativo/a de Personal',
  NULL,
  'Actualmente me encuentro realizando asesoria en RRHH y cuento con experiencia en normas ISO.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_577_cv_69780511dd5fd5.52301912.pdf',
  'cv_69780511dd5fd5.52301912.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69780511dd5fd5.52301912.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-27T00:21:37+00:00'::timestamptz,
  '2026-01-27T00:21:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  578,
  'Agustina Rodriguez',
  'agusrg32@gmail.com',
  '2645214483',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_578_cv_69790fe45edcc3.71349292.pdf',
  'cv_69790fe45edcc3.71349292.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_69790fe45edcc3.71349292.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-27T19:20:04+00:00'::timestamptz,
  '2026-01-27T19:20:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  579,
  'Gonzalo Castro',
  'gonzacastro1407@gmail.com',
  '2644557855',
  'Community Manager',
  NULL,
  'Disponible asimismo para la atención al cliente, y ventas. Experiencia comprobable',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_579_cv_697933bc89a017.39038270.pdf',
  'cv_697933bc89a017.39038270.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697933bc89a017.39038270.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-27T21:53:00+00:00'::timestamptz,
  '2026-01-27T21:53:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  581,
  'Montaño julieta belen',
  'julimont67@gmail.com',
  '2645606507',
  'Higiene y seguridad',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_581_cv_697be35caaf173.70144859.pdf',
  'cv_697be35caaf173.70144859.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697be35caaf173.70144859.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-29T22:46:52+00:00'::timestamptz,
  '2026-01-29T22:46:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  582,
  'Rocio Di Paola',
  'dipaolarocio@gmail.com',
  '2644430266',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_582_cv_697cc294b04208.78111552.pdf',
  'cv_697cc294b04208.78111552.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697cc294b04208.78111552.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-30T14:39:17+00:00'::timestamptz,
  '2026-01-30T14:39:17+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  583,
  'Micaela Marinero',
  'mica.marinero@live.com',
  '2645466662',
  'Asistente Administrativo/a',
  NULL,
  'Buenas tardes, me postulo a los puestos "Asistente Administrativo/a" y "Atención al Público" ya que cuento con experiencia en tareas administrativas y de atención al cliente, desarrolladas en distintos ámbitos laborales. Me desempeño con responsabilidad, organización y buen manejo de la comunicación, tanto presencial como telefónica.

Tengo experiencia en gestión administrativa general, manejo de documentación, tareas de caja y cobranzas, y atención a clientes/pacientes, lo que me permite adaptarme con facilidad a diferentes dinámicas de trabajo. Me caracterizo por ser proactiva, ordenada y con buena predisposición para el trabajo en equipo.

Busco incorporarme a un entorno donde pueda aportar compromiso y profesionalismo, y continuar desarrollándome en el área administrativa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_583_cv_697d327ef38c19.94107624.pdf',
  'cv_697d327ef38c19.94107624.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697d327ef38c19.94107624.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-30T22:36:47+00:00'::timestamptz,
  '2026-01-30T22:36:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  584,
  'Leandro Manrique',
  'leandrosanjuan025@gmail.com',
  '02645629018',
  'Instalador/a de Cartelería',
  NULL,
  'Buenas tarde mí nombre es Leandro, llevo 5 años en el rubro, tengo experiencia en ploteo vehicular, cartelería en general, colocación, tensado de lona, armado de bastidores, conocimientos en diseño y marketing.( Entre otros)',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_584_cv_697e69d2ae1167.88026822.pdf',
  'cv_697e69d2ae1167.88026822.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_697e69d2ae1167.88026822.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-01-31T20:45:06+00:00'::timestamptz,
  '2026-01-31T20:45:06+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  586,
  'Martin Jesús Aguilera Ibañez',
  'subzeroaguilera1998@gmail.com',
  '2646198142',
  'Cajero/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_586_cv_697ebcbd52dff6.66013400.pdf',
  'cv_697ebcbd52dff6.66013400.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_697ebcbd52dff6.66013400.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-01T02:38:53+00:00'::timestamptz,
  '2026-02-01T02:38:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  588,
  'María Luján Trigo Zarate',
  'trigolujan@gmail.com',
  '2644855549',
  'Cajero/a',
  NULL,
  'Soy una persona responsable, organizada y con experiencia en atención al cliente. Me adapto con facilidad a distintos entornos de trabajo y me destaco por la buena comunicación, el trato respetuoso y el compromiso con las tareas asignadas. Busco incorporarme a un equipo donde pueda aportar responsabilidad y predisposición.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_588_cv_6980c16123a961.91818067.docx',
  'cv_6980c16123a961.91818067.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6980c16123a961.91818067.docx","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-02T15:23:15+00:00'::timestamptz,
  '2026-02-02T15:23:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  589,
  'Axel Yoel Reches',
  'axelreches700@gmail.com',
  '02645058906',
  'Community Manager',
  NULL,
  'Hola, soy Axel un joven apasionado por el Marketing que busca día a día superarse y obtener nuevas oportunidades. Me encantaría trabajar con ustedes, siento que mi perfil se adapta completamente a la empresa. Tengo muchas ganas de aportar frescura, juventud e ideas creativas, espero la oportunidad.
El link de mi portfolio se encuentra en mi CV. Saludos y gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_589_cv_698109293660c1.45481026.pdf',
  'cv_698109293660c1.45481026.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_698109293660c1.45481026.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-02T20:29:29+00:00'::timestamptz,
  '2026-02-02T20:29:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  591,
  'Elluz Castellar',
  'elluzacm.714@gmail.com',
  '2645272559',
  'Analista de Presupuestos',
  NULL,
  'Estimados.- Adjunto mi Cv para optar al puesto de Encargado de Presupuesto.

Espero sea de su agrado, saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_591_cv_69813590bee190.16989493.pdf',
  'cv_69813590bee190.16989493.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69813590bee190.16989493.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-02T23:38:56+00:00'::timestamptz,
  '2026-02-02T23:38:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  592,
  'Nazareno Uriel Soria Riveros',
  'sorianazareno14@gmail.com',
  '02645650769',
  'Community Manager',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_592_cv_698220534aee36.92109590.pdf',
  'cv_698220534aee36.92109590.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698220534aee36.92109590.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-03T16:20:35+00:00'::timestamptz,
  '2026-02-03T16:20:35+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  593,
  'Alexis Herrera',
  'alexisherrerank@gmail.com',
  '2646621720',
  'Atención al Cliente',
  NULL,
  'Buenas, les dejo mi cv a continuación, gracias y espero podamos ponernos en contacto. Gracias !',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_593_cv_698341ae4704c0.29811170.pdf',
  'cv_698341ae4704c0.29811170.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_698341ae4704c0.29811170.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-04T12:55:10+00:00'::timestamptz,
  '2026-02-04T12:55:10+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  594,
  'JUAN AGUSTIN MONTAÑO PEREZ',
  'agumontano18@gmail.com',
  '2644863327',
  'Administrativo/a Contable',
  NULL,
  'Hola, ¿cómo están? Mi nombre es Agustín Montaño. Les envío mi postulación para el puesto de Administrativo Contable.

Soy estudiante avanzado de Contador Público y actualmente me desempeño en el área administrativa de una constructora, donde desde hace más de tres años gestiono presupuestos de gran escala, liquidación de impuestos y sueldos. Manejo Excel de forma avanzada y estoy acostumbrado a trabajar con sistemas de gestión, buscando siempre la precisión en los cierres mensuales y el control de cuentas.

Me entusiasma la posibilidad de sumarme a Plot Center y aportar mi experiencia en una empresa con su trayectoria. Quedo atento a su contacto para una posible entrevista. Muchas gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_594_cv_698342f50b2da5.32054716.pdf',
  'cv_698342f50b2da5.32054716.pdf',
  'application/pdf',
  'en_revision',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"En revisión","legacy_cv_ruta":"uploads/cv/cv_698342f50b2da5.32054716.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-04T13:00:37+00:00'::timestamptz,
  '2026-02-04T13:00:37+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  595,
  'Manuela Manrique',
  'licrrhh.manuelamanrique@gmail.com',
  '02645057571',
  'Administrativo/a de Personal',
  NULL,
  'Hola! Me postulo para toda tarea administrativa y gestión/delegación de personal. Mi nombre es Manu y estoy recibida de Recursos Humanos y me encuentro en la búsqueda de trabajo para desarrollarme profesionalmente. Actualmente estudio inglés y tengo una gran capacidad de adaptación, aprendiendo nuevas tareas de forma rápida y eficiente. Me considero una persona comprometida, responsable y con buena predisposición al trabajo en equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_595_cv_69835eaa2baf76.19717339.pdf',
  'cv_69835eaa2baf76.19717339.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69835eaa2baf76.19717339.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-04T14:58:50+00:00'::timestamptz,
  '2026-02-04T14:58:50+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  596,
  'Facundo Andres Castro Alvarez',
  'facu_castro_24@outlook.com',
  '2644559483',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_596_cv_6984ccb9506550.87125376.pdf',
  'cv_6984ccb9506550.87125376.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6984ccb9506550.87125376.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-05T17:00:41+00:00'::timestamptz,
  '2026-02-05T17:00:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  597,
  'Carlos Rolando Catalan',
  'contactocatalan@gmail.com',
  '2645144094',
  'Desarrollador/a Frontend',
  NULL,
  'Mi trayectoria comenzó explorando el potencial visual con herramientas como Photoshop y After Effects, lo que me dio una base sólida en estética y composición. Hoy, esa visión creativa se potencia con mis estudios en Programación y Diseño Web, permitiéndome crear productos digitales donde la forma y la función van de la mano.

Me especializo en el ciclo completo de desarrollo: desde la concepción de la experiencia de usuario (UX/UI) hasta la implementación de la lógica y base de datos. Soy una persona detallista, comprometida con la excelencia y en constante aprendizaje para entregar siempre mi mejor versión técnica.

Proyecto en curso: Blog para Doctorado en Geografía
Un ejemplo de mi flujo de trabajo integral, desde el concepto hasta el despliegue:

🎨 Diseño UI/UX (Figma): Ver prototipo y wireframes

Estructuración visual y prototipado de alta fidelidad.

🚀 MVP en vivo (Vercel): doctoradogeografia.vercel.app

Aplicación funcional lista para interacción.

💻 Repositorio (GitHub): Acceder al código fuente

Estructura de datos y lógica de programación.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_597_cv_6985422908a8e8.63712069.pdf',
  'cv_6985422908a8e8.63712069.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6985422908a8e8.63712069.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T01:21:45+00:00'::timestamptz,
  '2026-02-06T01:21:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  598,
  'Ernesto Andres Alaniz',
  'alanizernestoandres@gmail.com',
  '2646129703',
  'Vendedor/a',
  NULL,
  'Estoy en búsqueda activa laboral tengo experiencia en ventas atención al cliente cajero operativo de deposito y logistica.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_598_cv_69857c2e692208.79805093.pdf',
  'cv_69857c2e692208.79805093.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_69857c2e692208.79805093.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T05:29:18+00:00'::timestamptz,
  '2026-02-06T05:29:18+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  599,
  'Axel Ticle',
  'ticleaxel12@gmail.com',
  '2646997844',
  'Vendedor/a',
  NULL,
  'Hola buenos días me llamo Axel ticle tengo 28 años y me encuentro en búsqueda de trabajo de manera urgente cuento con experiencia en manejo de camiones de gran porte y quitanieves también en ventas tengo carnét profesional habilitado hasta 2030 me gustaría que me tengan en cuenta para una entrevista muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_599_cv_6985bc333f7d34.98870559.pdf',
  'cv_6985bc333f7d34.98870559.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6985bc333f7d34.98870559.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T10:02:27+00:00'::timestamptz,
  '2026-02-06T10:02:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  600,
  'Pablo Montes de oca',
  'pablomontesdeoca2024@gmail.com',
  '0264 6701671',
  'Ayudante en imprenta',
  NULL,
  'Hola trabaje muchos años en empresas de limpiezas',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_600_cv_6985f722e54d00.82778047.pdf',
  'cv_6985f722e54d00.82778047.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_6985f722e54d00.82778047.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-06T14:13:54+00:00'::timestamptz,
  '2026-02-06T14:13:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  602,
  'María Luz Flores',
  'luz170584@gmail.com',
  '2644706856',
  'Atención al Cliente',
  NULL,
  'Me gustaría presentar mi solicitud de empleo para el puesto de Atención al cliente creo en mi experiencia y habilidades para el puesto que necesitan

Adjunto mi currículum en la que pueden encontrar más detalles sobre mis experiencias  

Agradezco su tiempo y consideración, 

Atentamente.                  

Maria Luz Flores',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_602_cv_69895c67967d78.88910692.pdf',
  'cv_69895c67967d78.88910692.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69895c67967d78.88910692.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-09T04:02:47+00:00'::timestamptz,
  '2026-02-09T04:02:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  604,
  'Tomas Moreno',
  'tommymoreno2301@gmail.com',
  '2645840885',
  'Generalista de RRHH',
  NULL,
  'Estimados, me dirijo a ustedes con el propósito de postularme para el área de Capital Humano. Como Licenciado en Gestión de Recursos Humanos, cuento con experiencia en la profesionalización de áreas de RRHH en entornos dinámicos e industriales. Mi enfoque combina la eficiencia administrativa con una visión estratégica del talento, orientada a acompañar el crecimiento del negocio y fortalecer el clima organizacional. Quedo a su entera disposición para una entrevista y agradezco de antemano su tiempo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_604_cv_698a00997df666.52844903.pdf',
  'cv_698a00997df666.52844903.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698a00997df666.52844903.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-09T15:43:21+00:00'::timestamptz,
  '2026-02-09T15:43:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  605,
  'Guadalupe Savall',
  'savallguadalupe@gmail.com',
  '+5492645100766',
  'Desarrollador/a Backend',
  NULL,
  '¡Hola! Soy Guadalupe Savall. Me postulo para el área de Backend, aunque me considero un perfil Full Stack porque me gusta estar en todo el proceso. 
Tengo experiencia desarrollando plataformas desde cero con PHP, JavaScript y SQL, metiéndome de lleno en la lógica de negocio y la seguridad de los accesos. Lo que me diferencia es mi base técnica en infraestructura y networking: no solo escribo el código, sino que entiendo perfectamente la red y los servidores donde corre, gracias a mi experiencia con Fortinet y MikroTik.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_605_cv_698baea7cdf1a0.47227335.pdf',
  'cv_698baea7cdf1a0.47227335.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698baea7cdf1a0.47227335.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-10T22:18:15+00:00'::timestamptz,
  '2026-02-10T22:18:15+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  606,
  'Facundo Vera',
  'facundo.vera.tech@gmail.com',
  '2645732745',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_606_cv_698e5e6e319f03.00321846.pdf',
  'cv_698e5e6e319f03.00321846.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698e5e6e319f03.00321846.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-12T23:12:46+00:00'::timestamptz,
  '2026-02-12T23:12:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  607,
  'Paula Nahir Sasu',
  'paulasasu4@gmail.com',
  '2645474692',
  'Proyectista',
  NULL,
  'Hola, buenas tardes.
Mi nombre es Paula Sasu, soy estudiante de Arquitectura y me interesa postularme para formar parte de su equipo.
Tengo interés en documentación técnica, armado de planos y procesos de impresión, y me gustaría ganar experiencia en un entorno de trabajo vinculado a la producción gráfica y atención a profesionales.
Les comparto mi CV para su consideración.
Muchas gracias por su tiempo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_607_cv_698e65ccba4d15.12932405.pdf',
  'cv_698e65ccba4d15.12932405.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_698e65ccba4d15.12932405.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-12T23:44:12+00:00'::timestamptz,
  '2026-02-12T23:44:12+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  608,
  'Martina Bruno Sánchez',
  'martinabruno301@gmail.com',
  '2644506247',
  'Atención al Cliente',
  NULL,
  'No tengo problema en relacionarme con otros, además de trabajar en equipo y mantener una relación cordial',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_608_cv_699256ef47c5b1.27176321.pdf',
  'cv_699256ef47c5b1.27176321.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699256ef47c5b1.27176321.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-15T23:29:51+00:00'::timestamptz,
  '2026-02-15T23:29:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  610,
  'Martina Bruno Sánchez',
  'marttinabrunosanchez@gmail.com',
  '2644506247',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Tengo base en diseño, además de conocimiento de los materiales y métodos de impresión',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_610_cv_6992578b92a141.19909483.pdf',
  'cv_6992578b92a141.19909483.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6992578b92a141.19909483.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-15T23:32:27+00:00'::timestamptz,
  '2026-02-15T23:32:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  611,
  'Mayco Washington Diaz',
  'maycodiaz015@gmail.com',
  '2645851504',
  'Instalador/a de Cartelería',
  NULL,
  'Hola buenos días estoy en búsqueda de empleo tengo experiencia en distintas áreas en las cuales están necesitando acá les dejo mi cv desde ya muchas gracias',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_611_cv_699458d53752f4.94967993.pdf',
  'cv_699458d53752f4.94967993.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699458d53752f4.94967993.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-17T12:02:29+00:00'::timestamptz,
  '2026-02-17T12:02:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  613,
  'María de los Ángeles Herrera',
  'mmariaherrera23@gmail.com',
  '2644159316',
  'Cajero/a',
  NULL,
  'Cuento con experiencia en atención al cliente y manejo de caja, desarrolladas en un entorno dinámico y de contacto constante con el público. Me destaco por ser una persona responsable, organizada, con buena comunicación y capacidad para resolver situaciones de manera eficiente. Tengo excelente predisposición para el trabajo en equipo, aprendizaje de nuevas tareas y compromiso con las responsabilidades asignadas. Actualmente me encuentro en la búsqueda de una oportunidad laboral donde pueda continuar desarrollándome y aportar mis conocimientos.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_613_cv_6995dd34b97558.52898318.pdf',
  'cv_6995dd34b97558.52898318.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6995dd34b97558.52898318.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-18T15:39:32+00:00'::timestamptz,
  '2026-02-18T15:39:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  614,
  'Enzo Molina',
  'em2328369@gmail.com',
  '2646284661',
  'Proyectista',
  NULL,
  'Soy Maestro Mayor de obra y técnico en Higiene y Seguridad, tengo 24 años y ando en búsqueda laboral y me gustaría formar parte de su equipo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_614_cv_6997defc482305.65640530.pdf',
  'cv_6997defc482305.65640530.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6997defc482305.65640530.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-20T04:11:40+00:00'::timestamptz,
  '2026-02-20T04:11:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  615,
  'Juan Ignacio Acosta',
  'ignacosta11@gmail.com',
  '2644848136',
  'Operario/a de Impresión',
  NULL,
  'Mi nombre es Juan Ignacio Acosta tengo experiencia comprobable en Operario de producción en serigrafia y vinillo.
En serigrafía:
Preparación y revelado de marcos
Registro de colores
Manejo de pulpo manual
Curado de tinta
Control de calidad
En vinilos:
Manejo de plotter
Diseño básico en Illustrator o Corel
Depilado
Posicionado sin burbujas
Aplicación en vidrio, paredes o vehículos',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_615_cv_699cdae452be05.68983662.pdf',
  'cv_699cdae452be05.68983662.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699cdae452be05.68983662.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-23T22:55:32+00:00'::timestamptz,
  '2026-02-23T22:55:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  616,
  'Carlos Miguel Moll Rojas',
  'miguelmollrojas@gmail.com',
  '02645716360',
  'Administrativo/a Contable',
  NULL,
  'Soy administrativo contable con experiencia en liquidación de sueldos, gestión administrativa y control documental. Actualmente trabajo en el Ministerio de Educación de San Juan, donde realizo tareas de carga y control de información, seguimiento de procesos y soporte operativo. Cuento con muy buen manejo de Excel y herramientas digitales, perfil ordenado, responsable y con disponibilidad inmediata. Me interesa incorporarme a una empresa dinámica donde pueda aportar mi experiencia administrativa y seguir desarrollándome profesionalmente.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_616_cv_699ce4013c6e15.37368389.pdf',
  'cv_699ce4013c6e15.37368389.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_699ce4013c6e15.37368389.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-23T23:34:25+00:00'::timestamptz,
  '2026-02-23T23:34:25+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  617,
  'Rodriguez Lopez Lucas',
  'lucasrrodriguez17@gmail.com',
  '2645893118',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Elegí este puesto porque creo que es ideal para mi perfil, pero tambien puedo aportar como Tecnico en diseño o diseño ux/ui. Me gusta trabajar en equipo y creo que esta empresa es un buen desafío para mi carrera en formación. 
Gracias, saludos cordiales.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_617_cv_699f28f860dca5.43690160.pdf',
  'cv_699f28f860dca5.43690160.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_699f28f860dca5.43690160.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-25T16:53:12+00:00'::timestamptz,
  '2026-02-25T16:53:12+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  618,
  'Bruno Javier Alanis Corzo',
  'brunojac@outlook.com.ar',
  '2645858428',
  'Electricista',
  NULL,
  'Soy una persona activa, servicial y con valores, me postulo para electricista aunque cuento con experiencia en el rubro en diversas áreas, tanto como cortes, ploteos, colocación de carteleria, etc.
Actualmente estudio Higiene y Seguridad laboral en el horario de mañana.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_618_cv_69a0524a0b23b6.04325052.pdf',
  'cv_69a0524a0b23b6.04325052.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69a0524a0b23b6.04325052.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-02-26T14:01:46+00:00'::timestamptz,
  '2026-02-26T14:01:46+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
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
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  647,
  'Tamara',
  'tamifsj@hotmail.com',
  '2644166724',
  'Asesor/a Comercial',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_647_cv_69b423726b8602.39674155.pdf',
  'cv_69b423726b8602.39674155.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b423726b8602.39674155.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-13T14:47:14+00:00'::timestamptz,
  '2026-03-13T14:47:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  649,
  'Martín miranda',
  'martinmiranda1617@gmail.com',
  '02646038195',
  'Vendedor/a',
  NULL,
  'Buenas, me llamo Martín miranda, soy una. Persona que se destaca por llevar a cabo su trabajo a profundidad y tener un buen rendimiento y mejor el alcance de ventas, tengo disponibilidad full time y estoy muy interesado en trabajar cuanto antes ya que tengo una familia que tengo que mantener, espero su msj',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_649_cv_69b594984ab5d5.06257336.pdf',
  'cv_69b594984ab5d5.06257336.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b594984ab5d5.06257336.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-14T17:02:16+00:00'::timestamptz,
  '2026-03-14T17:02:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  651,
  'Luis Rolando García',
  'lrg150181@gmail.com',
  '02644143618',
  'Administrativo/a Contable',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_651_cv_69b5e07cf0c9a7.84833527.pdf',
  'cv_69b5e07cf0c9a7.84833527.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b5e07cf0c9a7.84833527.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-14T22:26:05+00:00'::timestamptz,
  '2026-03-14T22:26:05+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  652,
  'Alberto riveros',
  'albertoriveros803@gmail.con',
  '2645161880',
  'Instalador/a de Cartelería',
  NULL,
  'Tengo un año de experiencia en instalación de vinilo ,me gustaría poder seguir desarrollando este rubro hermoso',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_652_cv_69b7fa409eaf60.60689391.pdf',
  'cv_69b7fa409eaf60.60689391.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69b7fa409eaf60.60689391.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-16T12:40:33+00:00'::timestamptz,
  '2026-03-16T12:40:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  654,
  'José Antonio Espina Mansilla',
  'joseantonioespina17@gmail.com',
  '2646275130',
  'Electricista',
  NULL,
  'Hola soy de Rawson.Tengo conocimiento en varias cosas del trabajo que realiza la empresa. Electricidad, colocación de lonas, chofer, venta al público administrativo etc. Me recibí en el colegio San Juan Bautista en Comunicación Arte y Diseño. También estudie 3 años en la escuela técnica Rogelio Boero como técnico automotor. Poseo licencia de conducir. Me adapto rápido a la tarea que me asignen y trabajo en equipo para poder brindar el mejor servicio a los clientes.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_654_cv_69bb1de6dc0326.70118562.pdf',
  'cv_69bb1de6dc0326.70118562.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69bb1de6dc0326.70118562.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-18T21:49:26+00:00'::timestamptz,
  '2026-03-18T21:49:26+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  655,
  'Tobias Alejandro Cabrera',
  'cabreratobias07@gmail.com',
  '2644600835',
  'Electricista',
  NULL,
  'soy alguien proactivo con ganas de trabajar, buena disposición, me gusta trabajar en equipo y disponibilidad full-time',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_655_cv_69c1d9a5684b00.12381099.pdf',
  'cv_69c1d9a5684b00.12381099.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c1d9a5684b00.12381099.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-24T00:24:07+00:00'::timestamptz,
  '2026-03-24T00:24:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  657,
  'Diego Pasten',
  'vivaresornella794@gmail.com',
  '2645592350',
  'Soldador/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_657_cv_69c36b11211bc7.44008200.pdf',
  'cv_69c36b11211bc7.44008200.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c36b11211bc7.44008200.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-25T04:56:49+00:00'::timestamptz,
  '2026-03-25T04:56:49+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  659,
  'Rodriguez Lopez Lucas',
  'rllucaswork@gmail.com',
  '2645893118',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Estoy en búsqueda de un proyecto a largo plazo, un puesto presencial y nuevas oportunidades. Me encantaría poder trabajar para y con ustedes. Este es mi email laboral.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_659_cv_69c44e1abb1938.45755412.pdf',
  'cv_69c44e1abb1938.45755412.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c44e1abb1938.45755412.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-25T21:05:30+00:00'::timestamptz,
  '2026-03-25T21:05:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  660,
  'Tomás Agustin Illanes Sansone',
  'tillanes605@gmail.com',
  '2645471769',
  'Instalaciones',
  NULL,
  'Me considero una persona responsable, organizada y con muy buena predisposición para el trabajo en equipo. Pero, sobre todo, destaco mis ganas de aprender, crecer y evolucionar tanto en lo personal como en lo profesional. Busco constantemente nuevos desafíos que me permitan desarrollarme, adquirir conocimientos y aportar valor desde mi lugar.
Cuento con disponibilidad full time y total predisposición para adaptarme, capacitarme y dar lo mejor de mí en cada tarea.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_660_cv_69c45907672789.16023393.pdf',
  'cv_69c45907672789.16023393.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c45907672789.16023393.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-25T21:52:07+00:00'::timestamptz,
  '2026-03-25T21:52:07+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  661,
  'Catalina Hidalgo',
  'mariacatalinahidalgo@gmail.com',
  '+549 2645403598',
  'Atención al Cliente',
  NULL,
  'Hola Plotcenter! soy Catalina Hidalgo tengo 20 años y tengo muchas ganas de aprender y crecer con ustedes!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_661_cv_69c4723b167ed4.97693440.pdf',
  'cv_69c4723b167ed4.97693440.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c4723b167ed4.97693440.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-25T23:39:39+00:00'::timestamptz,
  '2026-03-25T23:39:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  662,
  'Barbano',
  'antonellabarbano97@gmail.com',
  '2645437374',
  'Asistente Administrativo/a',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_662_cv_69c49f85184cb4.76406346.pdf',
  'cv_69c49f85184cb4.76406346.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c49f85184cb4.76406346.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T02:52:53+00:00'::timestamptz,
  '2026-03-26T02:52:53+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  663,
  'Damian Icazzatti',
  'damianicazzatti123@gmail.com',
  '2645046162',
  'Atención al Cliente',
  NULL,
  'Hola buenas!!
Si bien no cuento con experiencia, tengo unas ganas inmensas de crecer y poder lograr metas que tengo propuestas, Vi una publicación de Instagram de la empresa y me encantaría crecer aquí y gracias a ustedes poder cumplir con mis metas.
Muchas gracias por la atención y estaré atento a su respuesta.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_663_cv_69c4a508253fe9.75994324.pdf',
  'cv_69c4a508253fe9.75994324.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c4a508253fe9.75994324.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T03:16:24+00:00'::timestamptz,
  '2026-03-26T03:16:24+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  664,
  'Facundo Nahuel Salinas Mercado',
  'ppp.facu@gmail.com',
  '2644854849',
  'Cajero/a',
  NULL,
  'Hola buena, soy Facundo Salinas, quiero postularme a cualquier vacante disponible, si no se hacer algo lo aprendo rápido y lo aplicó de inmediato, espero su llamado, desde ya muchas gracias saludos cordiales',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_664_cv_69c52a79419ae8.44429396.pdf',
  'cv_69c52a79419ae8.44429396.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c52a79419ae8.44429396.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T12:45:45+00:00'::timestamptz,
  '2026-03-26T12:45:45+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  669,
  'Majo Tello',
  'majotello.importante@gmail.com',
  '2645088851',
  'Atención al Cliente',
  NULL,
  'Hola mi nombre es María José Tello. 
Les comparto mi currículum para que puedan tenerlo en cuenta ante cualquier oportunidad laboral.
Actualmente trabajo en el comercio jornada completa, pero me encuentro en búsqueda de un trabajo de media jornada o que me permita continuar desarrollándome profesionalmente y retomar mis estudios.
Soy una persona que prende rápido y predispuesta, puse atención al cliente pero siento que donde sea que me necesiten puedo aportar mis conocimientos  y aprender si es necesario. 
Desde ya muchas gracias, quedo a disposición para cualquier consulta.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_669_cv_69c530db378391.87786040.pdf',
  'cv_69c530db378391.87786040.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c530db378391.87786040.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T13:12:59+00:00'::timestamptz,
  '2026-03-26T13:12:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  670,
  'Geremias Bustos',
  'geremiasbustos10@gmail.com',
  '2645603434',
  'Analista de Presupuestos',
  NULL,
  'Me gustaria trabajar en el puesto que se pueda, soy ilustrador, pintor, muralista, hago mis stickers con ustedes, y estoy dispuesto a apreder',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_670_cv_69c53acc69d697.08570691.pdf',
  'cv_69c53acc69d697.08570691.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c53acc69d697.08570691.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T13:55:24+00:00'::timestamptz,
  '2026-03-26T13:55:24+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  671,
  'Torrente',
  'noeliadelvalletorrente97@gmail.com',
  '2646271201',
  'Cajero/a',
  NULL,
  'Hola buenas tardes, me presento soy Noelia Torrente, tengo 29 años, vivo en la ciudad de san Juan y estoy en busca de una vacante de empleo, tengo variada experiencia en ventas, caja, etc... Me gustaría formar parte del equipo aunque no tenga experiencia, tengo muchas ganas de aprender lo que fuere. Muchas gracias por su atención!  Les envio saludos al equipo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_671_cv_69c54f0bb41e61.08741653.pdf',
  'cv_69c54f0bb41e61.08741653.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c54f0bb41e61.08741653.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T15:21:47+00:00'::timestamptz,
  '2026-03-26T15:21:47+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  672,
  'Santiago Tapia',
  'santi.boster2003@gmail.com',
  '2645809262',
  'ayudante de deposito o repositor',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_672_cv_69c54f3e9ddd98.01846735.pdf',
  'cv_69c54f3e9ddd98.01846735.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c54f3e9ddd98.01846735.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T15:22:39+00:00'::timestamptz,
  '2026-03-26T15:22:39+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  673,
  'Guillermo daniel',
  'guillermodanielhuerta@gmail.com',
  '2644588196',
  'Instalador/a de Cartelería',
  NULL,
  'Tengo conocimiento en vinilo he intalaciones..',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_673_cv_69c55fd35a7ea8.55871261.pdf',
  'cv_69c55fd35a7ea8.55871261.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c55fd35a7ea8.55871261.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T16:33:23+00:00'::timestamptz,
  '2026-03-26T16:33:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  674,
  'Renzo Javier Gomez',
  'renzogomez1622@gmail.com',
  '+5492645751724',
  'Instalador/a de Cartelería',
  NULL,
  'Me amoldo rapido a los grupos, muy activo, con muchas ganas de aprender siempre',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_674_cv_69c56529074429.58347060.pdf',
  'cv_69c56529074429.58347060.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c56529074429.58347060.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T16:56:09+00:00'::timestamptz,
  '2026-03-26T16:56:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  675,
  'Nestor bustos',
  'p0lilob4444@gmail.com',
  '0264155859165',
  'Pre-impresor/a',
  NULL,
  'Buenas tardes, aprendo rápido ☺️ soy muy práctico 😌',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_675_cv_69c567cf69c480.50805584.pdf',
  'cv_69c567cf69c480.50805584.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c567cf69c480.50805584.pdf","migrated_at":"2026-06-09T11:23:49.258Z"}'::jsonb,
  '2026-03-26T17:07:27+00:00'::timestamptz,
  '2026-03-26T17:07:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  676,
  'Martin Campanello',
  'campanellomartin@gmail.com',
  '2644033278',
  'Asesor/a Comercial',
  NULL,
  'Soy Martin Campanello, tecnico en informatica, con conocimientos en atencion al cliente y asesoramiento. Puedo desempeñarme eficazmente en cualquier ambito laboral que la empresa desee y asi contribuir a su exito.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_676_cv_69c5d3fb44c806.11267861.pdf',
  'cv_69c5d3fb44c806.11267861.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c5d3fb44c806.11267861.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T00:48:59+00:00'::timestamptz,
  '2026-03-27T00:48:59+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  677,
  'Joel Tejada',
  'joeltejada04@gmail.com',
  '2645433586',
  'Asistente Administrativo/a',
  NULL,
  'Soy Joel tengo 21 años y ganas de progresar en una empresa que me brinde las condiciones para hacerlo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_677_cv_69c5e158b387b0.88002293.pdf',
  'cv_69c5e158b387b0.88002293.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c5e158b387b0.88002293.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T01:46:00+00:00'::timestamptz,
  '2026-03-27T01:46:00+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  679,
  'Joel Tejada',
  'joeltejada2004@gmail.com',
  '+542645433586',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_679_cv_69c6583f9d5771.69937401.pdf',
  'cv_69c6583f9d5771.69937401.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6583f9d5771.69937401.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T10:13:19+00:00'::timestamptz,
  '2026-03-27T10:13:19+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  680,
  'Elias Alfredo berrios videla',
  'berrioselias2021@gmail.com',
  '2644730806',
  'Cajero/a',
  NULL,
  'Mi nombre es Elias, tengo 22 años y soy estudiante de la licenciatura en recursos humanos, me adapto rápido y me considero una persona muy ordenada, tengo muchas ganas de aprender y podés desarrollarme profesionalmente en el ámbito laboral, hace mucho tiempo que sigo a plot Center y sería un orgullo para mí trabajar en su empresa',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_680_cv_69c6b1951efd40.18720970.pdf',
  'cv_69c6b1951efd40.18720970.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6b1951efd40.18720970.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T16:34:29+00:00'::timestamptz,
  '2026-03-27T16:34:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  681,
  'Jonathan Saul',
  'jonathandsaul@hotmail.com',
  '3517512070',
  'Atención al Cliente',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_681_cv_69c6b58fcbe361.88789120.pdf',
  'cv_69c6b58fcbe361.88789120.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6b58fcbe361.88789120.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T16:51:27+00:00'::timestamptz,
  '2026-03-27T16:51:27+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  682,
  'Nicolas Roco',
  'roconicolas93@gmail.com',
  '2645851341',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Ademas de ser diseñador, soy editor de videos y motion graphic designer.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_682_cv_69c6be145098e8.13023458.docx',
  'cv_69c6be145098e8.13023458.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6be145098e8.13023458.docx","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T17:27:48+00:00'::timestamptz,
  '2026-03-27T17:27:48+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  684,
  'Bruno Rodríguez',
  'bruniirod011@gmail.com',
  '2644035264',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Hola cómo están ? Cuento con más de 5 años de experiencia en el rubro sobre diseño, me considero con todas las capacidades necesarias para cumplir con el puesto, tengo 23 años y muchísimas ganas de ser parte de plotcenter.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_684_cv_69c6c2f07ffb90.59347637.pdf',
  'cv_69c6c2f07ffb90.59347637.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6c2f07ffb90.59347637.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T17:48:32+00:00'::timestamptz,
  '2026-03-27T17:48:32+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  685,
  'Pablo Exequiel Castillo Muñoz',
  'pppablocastillo999@gmail.com',
  '2646019798',
  'Instalador/a de Cartelería',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_685_cv_69c6c82000a6d9.17510107.pdf',
  'cv_69c6c82000a6d9.17510107.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6c82000a6d9.17510107.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T18:10:40+00:00'::timestamptz,
  '2026-03-27T18:10:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  686,
  'Josefina yanzon',
  'yanzonjosefina@gmail.com',
  '2646299365',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_686_cv_69c6de728bc1f2.49110225.pdf',
  'cv_69c6de728bc1f2.49110225.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6de728bc1f2.49110225.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T19:45:54+00:00'::timestamptz,
  '2026-03-27T19:45:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  688,
  'Ana Belén Espinosa',
  'anabelenespinosa2@gmail.com',
  '02644108520',
  'Ventas y caja',
  NULL,
  'Buenas tardes, mi nombre es Ana y me comunico con ustedes por la oferta de trabajo disponible!
Envío mi currículum vitae para que este a disposición de ustedes!! Muchas gracias!',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_688_cv_69c6f3695c32a4.72887019.docx',
  'cv_69c6f3695c32a4.72887019.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6f3695c32a4.72887019.docx","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T21:15:21+00:00'::timestamptz,
  '2026-03-27T21:15:21+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  690,
  'Leonardo Ferreyra',
  'leoferreyra20116@gmail.com',
  '2645737864',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Hola soy Leonardo Ferreyra soy programador web y app además tengo experiencia en programas de diseño',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_690_cv_69c6f47ad1b7a1.82246048.pdf',
  'cv_69c6f47ad1b7a1.82246048.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c6f47ad1b7a1.82246048.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T21:19:54+00:00'::timestamptz,
  '2026-03-27T21:19:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  695,
  'Facundo Sanchez',
  'facundonahuel2008@gmail.com',
  '2645062850',
  'Diseñador/a Gráfico/a Junior',
  NULL,
  'Mi nombre es Facundo Sanchez, soy Licenciado en Diseño y Animacion Digital. Tengo experiencia trabajando como Diseñador Grafico para algunas marcas y empresas. Estoy buscando sumarme a proyectos donde pueda crecer laboralmente y ganar mas experiencia en este rubro.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_695_cv_69c709d77673c8.95325745.pdf',
  'cv_69c709d77673c8.95325745.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c709d77673c8.95325745.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-27T22:51:03+00:00'::timestamptz,
  '2026-03-27T22:51:03+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  696,
  'Ciro Nazareno',
  'nazarenocarrizoortiz2@gmail.com',
  '2644681118',
  'Asistente Administrativo/a',
  NULL,
  'Buenas tardes me presento soy Ciro Nazareno, soy un chico muy atento a cualquier orden, me gusta mucho el trabajo en equipo, me gusta aprender en las tareas que se me pongan en frente, soy muy responsable y cumplo siempre con los horarios de entrada.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_696_cv_69c83e84210bb7.85064002.pdf',
  'cv_69c83e84210bb7.85064002.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69c83e84210bb7.85064002.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-28T20:48:04+00:00'::timestamptz,
  '2026-03-28T20:48:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  699,
  'Pablo Sánchez',
  'pablosanchez04@hotmail.com',
  '264 512 5912',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Me llamo Pablo, soy diseñador gráfico especializado en identidad visual, señalética y comunicación estratégica.
Desde hace más de 15 años trabajo con marcas, empresas e instituciones que necesitan claridad en su comunicación y coherencia en su imagen.
Trabajo desde el concepto hasta la implementación, cuidando cada decisión del proceso con una mirada estratégica y un enfoque humano.
Me gustan los desafíos, estoy abierto a nuevos proyectos y colaboraciones.
Sin otro particular, los saludo atte.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_699_cv_69cbd98ecf0949.12207370.pdf',
  'cv_69cbd98ecf0949.12207370.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69cbd98ecf0949.12207370.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-31T14:26:23+00:00'::timestamptz,
  '2026-03-31T14:26:23+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  701,
  'alejandro emanuel sanchez',
  'aleema02sa@gmail.com',
  '2645090632',
  'Cajero/a',
  NULL,
  'Estoy para cualquier puesto aprendo rápido y me encarga sumarme al equipo de trabajo',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_701_cv_69cc37244180a3.81539857.pdf',
  'cv_69cc37244180a3.81539857.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69cc37244180a3.81539857.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-03-31T21:05:40+00:00'::timestamptz,
  '2026-03-31T21:05:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  704,
  'Cespedes Cecilia',
  'cc.cesp20@gmail.com',
  '2644177276',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Hola, me llamo Cecilia, actualmente estoy por recibirme de la carrera de diseño gráfico, me considero un apersona creativa y organizada para la resolución de problemas, me adapto a las situaciones con responsabilidad. Me dedico a la gestión y diseño de redes sociales como así también la edición de videos y mothion grapics en la parte digital, tengo experiencia en imprentas trabaje en SOMOS, y Código Visual, como así también en otras instituciones.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_704_cv_69cdbb9f3e2783.94392744.pdf',
  'cv_69cdbb9f3e2783.94392744.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69cdbb9f3e2783.94392744.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-02T00:43:11+00:00'::timestamptz,
  '2026-04-02T00:43:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  705,
  'Alan Molina',
  'alan.22molina@gmail.com',
  '2645802195',
  'Atención al Cliente',
  NULL,
  'Estimado/a 
Mi nombre es Alan. Me destaco por mi compromiso, responsabilidad y excelente trato con el cliente. Busco una oportunidad para demostrar mis capacidades y aportar al crecimiento de la empresa.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_705_cv_69cf02204cfe22.68458671.pdf',
  'cv_69cf02204cfe22.68458671.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69cf02204cfe22.68458671.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-02T23:56:16+00:00'::timestamptz,
  '2026-04-02T23:56:16+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  712,
  'Luciana Nazareth Correa Quiroga',
  'luciana_1666@hotmail.com',
  '2646612706',
  'Asistente Administrativo/a',
  NULL,
  'Buenas tardes, soy Luciana, Técnica Universitaria en Administración de Empresas, me encuentro en Búsqueda activa de inmediato para desarrollar actividades Administrativas o a fines. Tengo experiencia, soy proactiva y muchas ganas de seguir creciendo. 
Espero su respuesta, desde ya, muchas gracias.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_712_cv_69d7dc72192a93.03263094.pdf',
  'cv_69d7dc72192a93.03263094.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69d7dc72192a93.03263094.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-09T17:05:54+00:00'::timestamptz,
  '2026-04-09T17:05:54+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  713,
  'Marcos González',
  'gmarcos740@gmail.com',
  '2645608702',
  'Atención al Cliente',
  NULL,
  'Mi nombre es Marcos González y me encuentro en la búsqueda de una oportunidad laboral en el área administrativa.
Cuento con experiencia en atención al cliente, gestión de datos y trabajo en entornos dinámicos, además de formación en gestión ambiental. Me considero una persona responsable, organizada y con gran predisposición para aprender.
Adjunto mi CV para su consideración y quedo a disposición para una entrevista.

Muchas gracias por su tiempo.

Saludos cordiales,  
Marcos González  
Tel: 2645608702',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_713_cv_69de6052e77708.23447389.pdf',
  'cv_69de6052e77708.23447389.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69de6052e77708.23447389.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-14T15:42:10+00:00'::timestamptz,
  '2026-04-14T15:42:10+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  714,
  'Victor Elizondo',
  'victorelizondorafa@gmail.com',
  '2644835889',
  'Atención al Cliente',
  NULL,
  'Proactivo y dedicado al trabajo con capacidad de trabajo en equipo y adaptabilidad a cualquier entorno de trabajo, responsable y dedicado...',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_714_cv_69df953dc01170.84816702.pdf',
  'cv_69df953dc01170.84816702.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69df953dc01170.84816702.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-15T13:40:14+00:00'::timestamptz,
  '2026-04-15T13:40:14+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  719,
  'Marianela Albarrán',
  'marianela_albarran@hotmail.com',
  '2644437828',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Buen día, les cuento que estoy muy entusiasmada con poder tener la oportunidad laboral en una empresa como PLOT CENTER, soy clienta desde sus inicios y fiel admiradora de la responsabilidad y Prolijidad con la que trabajan. Dispongo años de experiencia en trato con el cliente, buscando satisfacer sus necesidades, por medio de la empatia responsabilidad moral y profesional. Me destaco en mi habilidad de aprendizaje y adaptabilidad a la función que se me asigne. Poseo profundo conocimiento de programas de diseño especialmente Ilustrator, Photoshop, scribus entre otros.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_719_cv_69dfaa4a74bd62.18412050.pdf',
  'cv_69dfaa4a74bd62.18412050.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69dfaa4a74bd62.18412050.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-15T15:10:02+00:00'::timestamptz,
  '2026-04-15T15:10:02+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  720,
  'Eve nuñez',
  'eveliin.nunez@gmail.com',
  '+542644630275',
  'Asistente Administrativo/a',
  NULL,
  'Me encantaría sumar nuevos desafíos en una importante empresa como la de ustedes.  Me apasiona el trato con clientes etc además de tareas administrativas en si.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_720_cv_69dfdf002cc276.64194272.pdf',
  'cv_69dfdf002cc276.64194272.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69dfdf002cc276.64194272.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-15T18:54:56+00:00'::timestamptz,
  '2026-04-15T18:54:56+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  726,
  'Sergio Blanco',
  'sergio11.smb@outlook.com',
  '2645055125',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  'Hola soy Sergio, envío mi portfolio esperando tener la oportunidad de formar parte de su equipo de trabajo. Soy diseñador gráfico con experiencia en redes, branding, diseño para imprenta (Somos) y actualmente incursionando en diseño UI. Los invito a ver algunos de mis trabajos en https://www.behance.net/sergiomblanco',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_726_cv_69e11c90f1e954.20387045.pdf',
  'cv_69e11c90f1e954.20387045.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69e11c90f1e954.20387045.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-16T17:29:52+00:00'::timestamptz,
  '2026-04-16T17:29:52+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  727,
  'Eyelen Lujan Millen',
  'eyelenm@outlook.com',
  '03424474821',
  'Diseñador/a UX/UI',
  NULL,
  'Soy Eyelen Millen, Diseñadora UX/UI con más de 4 años de experiencia en productos digitales.

Trabajé construyendo y manteniendo sistemas de diseño desde cero en Figma, creando componentes escalables, accesibles y bien documentados. Tengo experiencia definiendo design tokens y asegurando consistencia visual en todos los canales. Colaboré de cerca con equipos de desarrollo gracias a mis conocimientos de HTML, CSS, JavaScript y React, lo que me permite documentar buenas prácticas y comunicarme sin fricciones con frontend. Trabajé en entornos ágiles y tengo experiencia en testeo A/B y usabilidad.

Además incorporo herramientas de IA como v0, Figma Make, Google Stitch, ChatGPT y Gemini en mi flujo de trabajo, lo que me permite iterar más rápido y explorar soluciones con un enfoque de vibe design.

Dejo algunos links para que puedan echarle un ojo y ver mi experiencia

Proyecto reciente: https://www.iview3d.app/
Portafolio: https://www.behance.net/eyelen-ux-ui/
LinkedIn: https://www.linkedin.com/in/eyelen-ui/',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_727_cv_69efaa2f881442.27795108.pdf',
  'cv_69efaa2f881442.27795108.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69efaa2f881442.27795108.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-27T18:25:51+00:00'::timestamptz,
  '2026-04-27T18:25:51+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  728,
  'Joaquin Sastre Penisi',
  'joaquinsastrepenisi@gmail.com',
  '2645834827',
  'Ingeniero/a Industrial',
  NULL,
  'Hola soy Joaquín, Ingeniero Industrial recién graduado de la UNSJ, y con una convicción clara: los problemas reales se resuelven con análisis, acción y las personas correctas a tu lado.

Durante mi formación desarrollé competencias en mejora y control de procesos, logística, gestión de proyectos, análisis económico-financiero y evaluación de proyectos. Pero lo que más me define no está en ningún plan de estudios: es la capacidad de entrar a un entorno dinámico, entender qué no funciona y hacer que funcione.

Lo demostré en mi primera experiencia profesional: en una farmacia detecté cuellos de botella en el sector de pedidos a domicilio, implementé mejoras concretas y los resultados fueron medibles: -30% en tiempos de respuesta, +20% en facturación y +10% en tickets de venta. Eso es lo que busco hacer en cada lugar donde trabajo.

También llevé esa mentalidad al ámbito estudiantil. Fui parte de la organización de la 38°, 40° y 42° Jornadas de Estudiantes de Ingeniería Industrial de San Juan, liderando el área de auspicios: negocié acuerdos con empresas, gestioné equipos y cumplí objetivos financieros en estos eventos de gran escala. También fui miembro de tesorería a nivel nacional en la Asociación Argentina de Estudiantes de Ingeniería Industrial, manejé flujos de caja y el seguimiento económico de la organización. Aprendí que gestionar dinero y relaciones con el mismo nivel de atención es lo que hace que los proyectos se sostengan.

Creo profundamente en el trabajo en equipo. Los mejores resultados que viví no los logré solo: los logré con personas. Por eso valoro tanto la colaboración, la escucha activa y la empatía como herramientas de trabajo cotidianas.

Fuera del ámbito profesional mantengo el mismo pensamiento sobre mi energía personal: voy al gimnasio todos los días, me alimento de manera equilibrada y le doy importancia a la salud mental como base de cualquier rendimiento sostenible. Creo que un profesional que se cuida a sí mismo está en mejores condiciones de cuidar sus proyectos y su equipo.

Si buscan a alguien comprometido, orientado a resultados y con ganas reales de aportar valor desde el primer día, sin dudas que soy una buena elección.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_728_cv_69f0af97576340.39251669.pdf',
  'cv_69f0af97576340.39251669.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69f0af97576340.39251669.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-28T13:01:11+00:00'::timestamptz,
  '2026-04-28T13:01:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  729,
  'Angel Gabriel flores Riveros',
  'angelgflores003@gmail.com',
  '2645772355',
  'Cajero/a',
  NULL,
  'Me postulo para el puesto de cajero tengo muchísimas ganas de trabajar y dar todo lo mejor de mi para cualquier tipo de puesto laboral',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_729_cv_69f1343fcc4537.82953567.pdf',
  'cv_69f1343fcc4537.82953567.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_69f1343fcc4537.82953567.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-04-28T22:27:11+00:00'::timestamptz,
  '2026-04-28T22:27:11+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  730,
  'Pablo guillen',
  'guillen.pablo.1994@gmail.com',
  '‪2643 16‑1907‬',
  'Técnico/a en Instalaciones',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_730_cv_69fdfa19976366.88600865.pdf',
  'cv_69fdfa19976366.88600865.pdf',
  'application/pdf',
  'descartado',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Rechazado","legacy_cv_ruta":"uploads/cv/cv_69fdfa19976366.88600865.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-05-08T14:58:33+00:00'::timestamptz,
  '2026-05-08T14:58:33+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  731,
  'Julieta Garcia',
  'estefmanfredi111@gmail.com',
  '2644695731',
  'Cajero/a',
  NULL,
  'Soy una persona muy responsable a la hora de realizar mis tareas. Tamnien soy muy sociable y tengo mucha paciencia.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_731_cv_6a021d5cd0aeb0.23601138.pdf',
  'cv_6a021d5cd0aeb0.23601138.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6a021d5cd0aeb0.23601138.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-05-11T18:18:04+00:00'::timestamptz,
  '2026-05-11T18:18:04+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  732,
  'Luciana Dominguez',
  'luli.2000.dominguez@gmail.com',
  '2645174864',
  'Atención al Cliente',
  NULL,
  'Hola! Buen día 😊
Mi nombre es Luciana. Quería consultar si actualmente están recibiendo CV para puestos de atención al cliente, ventas o caja. muchas ganas de trabajar y aprender.
Si les sirve, puedo enviarles mi CV por este medio o acercarlo personalmente.
Muchas gracias ✨',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_732_cv_6a0262a5d95a03.24386512.pdf',
  'cv_6a0262a5d95a03.24386512.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6a0262a5d95a03.24386512.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-05-11T23:13:41+00:00'::timestamptz,
  '2026-05-11T23:13:41+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  734,
  'JUAN CRUZ NAVEDA',
  'sanchezmarialorena76@gmail.com',
  '2644101328',
  'atencion al publico ,chofer ,cajero ,otros.',
  NULL,
  'Buenos dias ,quedo a disposición para cubrir puestos de trabajos varios ,poseo carnet de conducir vigente y experiencia en atencion al publico ,estando abierto a cualquier oportunidad de otro puesto de trabajo, dispuesto a poner todo mi empeño para aprender y cubrir las expectativas de la empresa . sin saludos atte .',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_734_cv_6a10806e2a8cf8.26828462.pdf',
  'cv_6a10806e2a8cf8.26828462.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6a10806e2a8cf8.26828462.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-05-22T16:12:30+00:00'::timestamptz,
  '2026-05-22T16:12:30+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  736,
  'Enzo Martinez',
  'enzomart22898@gmail.com',
  '2645565956',
  'Instalador/a de Cartelería',
  NULL,
  'Estimado, admiro su trayectoria y crecimiento constante. Me gustaría ser parte de plotcenter y poder ayudar desde mis conocimientos y habilidades en futuros proyectos de la empresa.
Quedo a disposición a brindar mayor información en una entrevista cuando asi lo disponga.
Cordial saludo.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_736_cv_6a197d49da70d3.49930264.pdf',
  'cv_6a197d49da70d3.49930264.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6a197d49da70d3.49930264.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-05-29T11:49:29+00:00'::timestamptz,
  '2026-05-29T11:49:29+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  738,
  'Juan Oro',
  'juanorodev22@gmail.com',
  '2646277552',
  'Desarrollador/a Backend',
  NULL,
  'Puedo hacer desarrollo tanto FrontEnd como Backend, también manejo base de Datos, DevOps  . Aparte de eso tengo disposición para cualquier trabajo y mi disponibilidad es Full-time.',
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_738_cv_6a204ed5b08043.01944669.pdf',
  'cv_6a204ed5b08043.01944669.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6a204ed5b08043.01944669.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-06-03T15:57:09+00:00'::timestamptz,
  '2026-06-03T15:57:09+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO public.rrhh_postulaciones (
  legacy_id, nombre, email, telefono, puesto, categoria_puesto, mensaje,
  cv_url, cv_nombre, cv_mime, estado, notas_rrhh, metadata_ia, created_at, updated_at
) VALUES (
  739,
  'Gabriel Zabala',
  'zabalapedro0@gmail.com',
  '264 585 8375',
  'Diseñador/a Gráfico/a Senior',
  NULL,
  NULL,
  'https://bwdtrzcdzbzrtykjzber.supabase.co/storage/v1/object/public/archivos/cv-postulaciones/legacy_739_cv_6a216bb8276cb9.22574244.pdf',
  'cv_6a216bb8276cb9.22574244.pdf',
  'application/pdf',
  'nuevo',
  NULL,
  '{"imported_from":"php_postulaciones","legacy_status":"Nuevo","legacy_cv_ruta":"uploads/cv/cv_6a216bb8276cb9.22574244.pdf","migrated_at":"2026-06-09T11:23:49.259Z"}'::jsonb,
  '2026-06-04T12:12:40+00:00'::timestamptz,
  '2026-06-04T12:12:40+00:00'::timestamptz
) ON CONFLICT (legacy_id) DO NOTHING;
COMMIT;