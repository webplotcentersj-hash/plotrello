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
COMMIT;