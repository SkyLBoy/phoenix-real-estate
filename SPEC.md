# Phoenix Real Estate · Especificación del primer lanzamiento

## Problema

Un vendedor inmobiliario que trabaja solo en Phoenix procesa alrededor de 15 propiedades al día. Elegir y descargar fotos de Drive y redactar anuncios bilingües consume tiempo en cada alta. Las propiedades de remate pueden dejar de estar disponibles en tres a cinco días, y el vendedor depende de que alguien le confirme el estado. Su grupo de WhatsApp, de unas 250 personas, reúne tanto a inversionistas como a compradores de vivienda. Necesita compartir el inventario sin llenar el chat de fotos, captar compradores fuera de Facebook y coordinar las visitas antes de revelar el domicilio.

## Solución

Un panel móvil permite al vendedor pegar los datos de la propiedad, revisar la ficha, elegir fotos desde Drive, aprobar textos editables y publicar el inmueble en un catálogo público. Desde el mismo panel mantiene la disponibilidad, prepara el aviso diario para el grupo y da seguimiento a los registros VIP. El catálogo muestra ciudad o ZIP, incluye un enlace a las fotos de Drive y facilita el contacto directo por WhatsApp.

## Historias de usuario

1. Como vendedor, quiero acceder con una cuenta propia para gestionar el inventario y los datos de compradores.
2. Como responsable técnico, quiero una cuenta separada si necesito entrar al panel para prestar soporte con mis propias credenciales.
3. Como vendedor, quiero pegar el bloque de datos que ya recibo para evitar transcribir precio, ARV y características.
4. Como vendedor, quiero ver los campos reconocidos y los faltantes para corregir la extracción antes de usarla.
5. Como vendedor, quiero guardar un borrador incompleto para retomarlo cuando consiga los datos que faltan.
6. Como vendedor, quiero guardar la dirección exacta en privado para poder compartirla al coordinar una visita.
7. Como vendedor, quiero pegar el enlace de una carpeta de Drive y ver sus fotos en el panel para elegir la portada sin descargarlas primero.
8. Como vendedor, quiero guardar la selección de fotos con la ficha para retomarla más adelante.
9. Como vendedor, quiero descargar las fotos seleccionadas para adjuntarlas manualmente a un anuncio de Facebook.
10. Como vendedor, quiero revisar el contenido de la carpeta pública para detectar direcciones visibles en fotos, nombres de archivo o nombres de carpeta.
11. Como vendedor, quiero dos borradores de Facebook, uno en español y otro en inglés, para atender a ambos públicos.
12. Como vendedor, quiero un texto para compartir una ficha por WhatsApp y una respuesta inicial para interesados para ahorrar tiempo en las consultas.
13. Como vendedor, quiero textos basados en los rasgos reales de cada casa y en mi tono para poder reutilizarlos con cambios mínimos.
14. Como vendedor, quiero revisar y editar cada texto antes de aprobarlo para corregir datos o condiciones comerciales.
15. Como vendedor, quiero copiar el texto aprobado para publicarlo manualmente.
16. Como vendedor, quiero recibir textos de plantilla si falla Gemini para poder continuar con el alta y la revisión.
17. Como vendedor, quiero publicar explícitamente una ficha revisada para controlar cuándo aparece en el catálogo.
18. Como visitante, quiero abrir y compartir el catálogo sin cuenta para consultar propiedades desde mi celular.
19. Como visitante, quiero filtrar por zona o ZIP y ver el precio y las características para encontrar propiedades relevantes.
20. Como inversionista, quiero consultar el ARV cuando esté confirmado para evaluar la oportunidad.
21. Como comprador, quiero abrir la galería completa en Drive para revisar las fotos por mi cuenta.
22. Como visitante, quiero abrir un chat con el vendedor que identifique la propiedad para pedir detalles y coordinar una visita.
23. Como vendedor, quiero cambiar el estado desde la lista de propiedades en mi celular para actualizar el inventario rápidamente.
24. Como vendedor, quiero identificar fichas que lleven 72 horas sin confirmación para saber cuáles debo revisar.
25. Como visitante, quiero ver la etiqueta **Por confirmar** cuando corresponda para saber que la disponibilidad sigue pendiente.
26. Como vendedor, quiero preparar un aviso diario con zona, precio y un enlace al catálogo para compartir el inventario del día con el grupo de WhatsApp.
27. Como miembro del grupo, quiero que el aviso incluya las casas que sigan vigentes de días anteriores y distinga las pendientes de confirmación para decidir cuáles consultar.
28. Como vendedor, quiero copiar también el enlace individual de una propiedad para compartirla cuando haga falta.
29. Como visitante con un enlace antiguo, quiero ver si la propiedad está en contrato o ya no está disponible y poder consultar otras casas.
30. Como vendedor, quiero devolver una propiedad a **Disponible** si se cae el trato para que reaparezca con el mismo enlace.
31. Como vendedor, quiero corregir el precio de una ficha publicada para actualizar el catálogo y los próximos avisos.
32. Como vendedor, quiero conservar mis ediciones y ver qué textos requieren otra revisión tras un cambio de precio para evitar copiar un importe anterior.
33. Como comprador, quiero inscribirme voluntariamente en la lista VIP para recibir novedades.
34. Como vendedor, quiero consultar los registros VIP en privado y abrir un chat con cada persona para darle seguimiento manual.
35. Como responsable técnico, quiero ensayar el flujo completo en Vercel para verificarlo antes de compartir el catálogo con compradores reales.

## Decisiones de implementación

- Mantener Next.js para el catálogo, el panel y las operaciones de servidor, Supabase para los datos y Gemini para generar borradores. Conservar el respaldo por plantillas locales y aplicar la misma revisión a textos generados y de respaldo.
- Sustituir el PIN compartido por acceso individual. El servidor comprueba la autorización para consultar o modificar el inventario privado y consultar la lista VIP. El vendedor opera el panel a diario. El responsable técnico puede usar una cuenta separada si necesita acceso.
- Separar la visibilidad de la ficha del estado comercial. Una ficha comienza como borrador y pasa al catálogo con **Publicar**. Para publicarla se requieren zona pública, precio y portada revisada. El ARV y las condiciones de financiamiento se incluyen cuando el vendedor los confirma para ese inmueble.
- Mantener una referencia estable para el enlace individual. **En contrato** y **Ya no disponible** salen del listado activo y del aviso diario. El enlace sigue mostrando el estado y ofrece volver al catálogo de disponibles. Al volver a **Disponible**, se reutiliza el mismo enlace.
- Registrar la última confirmación de disponibilidad. A las 72 horas sin confirmación, mostrar **Por confirmar** en la ficha, el catálogo y el aviso diario. El operador puede confirmar la disponibilidad o cambiar el estado desde la lista del panel. La antigüedad activa una señal de revisión y conserva la ficha visible.
- Limitar los datos de lectura pública en Supabase a los campos destinados al catálogo. Verificar que los permisos efectivos impidan consultar domicilios exactos, borradores, textos internos y leads con acceso anónimo. El domicilio tampoco se incluye en el contenido que recibe Gemini. El vendedor revisa fotos y nombres de archivo y carpeta antes de hacer público el enlace de Drive.
- Guardar la carpeta de Drive, la portada y la selección de fotos para Facebook con cada ficha. El visitante abre la carpeta pública desde la ficha. El vendedor puede descargar desde el panel las fotos elegidas para adjuntarlas en Facebook.
- Generar cuatro borradores editables con datos confirmados y con el anuncio real como referencia de tono. Destacar las características particulares de cada inmueble y usar términos de financiamiento específicos de la ficha. Separar **Aprobar texto** y **Publicar ficha**. Solo los textos aprobados quedan disponibles para copiar como versión final.
- Permitir editar el precio de una ficha publicada sin cambiar su enlace. Actualizar el catálogo y los próximos avisos al guardar. Conservar las ediciones de los textos afectados y devolverlos a revisión antes de habilitar de nuevo la copia final.
- Armar el resumen de WhatsApp con todas las fichas publicadas que estén disponibles o por confirmar, aunque ya hayan aparecido el día anterior. Incluir zona, precio, la etiqueta **Por confirmar** donde corresponda y un solo enlace al catálogo. El vendedor copia y envía el aviso al grupo existente.
- Mantener la inscripción VIP opcional. Capturar nombre, WhatsApp, perfil de comprador y el indicador actual del formulario sobre ITIN, pasaporte o enganche. La consulta de estos registros y el acceso al chat de cada comprador quedan en el panel privado.
- Configurar el WhatsApp real del vendedor, conservar las credenciales fuera del repositorio y preparar el despliegue en Vercel con sus variables de entorno. Versionar en GitHub el proyecto sin incluir secretos.

## Decisiones de pruebas

- Usar como punto principal de prueba las interfaces que ya usa cada actor: panel, catálogo móvil y enlaces compartidos. Comprobar resultados observables, como los datos que devuelve el catálogo, el texto que se puede copiar y los estados de las fichas. Complementar con solicitudes anónimas directas a las interfaces de datos para comprobar que los permisos también funcionan fuera de la interfaz visual.
- Cubrir el recorrido desde el bloque pegado y una carpeta real de prueba hasta la revisión, la selección y descarga de fotos, la aprobación de textos y la publicación. Incluir datos incompletos, generación con Gemini y generación con plantillas cuando falle el proveedor. Verificar que la foto quede lista para adjuntar y que un borrador permanezca privado.
- Comprobar desde el celular los estados **Disponible**, **Por confirmar**, **En contrato** y **Ya no disponible**, la reactivación con el mismo enlace y el aviso diario con propiedades repetidas y etiquetas correctas. Probar una corrección de precio y comprobar que los textos afectados requieren una nueva aprobación.
- Probar el registro VIP, su consulta con acceso autorizado, el enlace al WhatsApp correcto y la consulta anónima del catálogo. Verificar que la dirección exacta quede fuera de las respuestas públicas, del contenido enviado a Gemini y de los materiales que se compartan durante el ensayo.
- Completar un ensayo en Vercel con cinco fichas representativas antes de compartir el enlace. Comparar con el proceso actual el tiempo desde que el vendedor abre los datos y la carpeta hasta que publica la ficha, copia el texto y tiene las fotos listas para adjuntar. Usar el tiempo actual para acordar con él el objetivo de ahorro durante el ensayo.
- Los recorridos manuales ya realizados en local para Supabase y Gemini son el punto de partida. En el repositorio revisado no se encontró una suite de pruebas automatizadas.

## Fuera de alcance

- Publicación automática en Facebook o recuperación del acceso a Marketplace mediante cambios de redacción.
- Envío automático de mensajes a WhatsApp, migración del grupo a un Canal y campañas masivas a la lista VIP.
- Segmentación avanzada de compradores y adquisición de audiencia mediante canales adicionales.

## Notas

El catálogo propio y el grupo de WhatsApp son los canales de lanzamiento. Facebook se usa de forma manual cuando la cuenta y la categoría admiten la publicación. El mecanismo técnico para listar y descargar imágenes de Drive debe validarse con carpetas representativas durante la implementación. La dirección exacta se comparte por chat individual al coordinar la visita.
