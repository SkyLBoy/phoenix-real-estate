This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Acceso individual al panel

Crea una cuenta con correo y contraseña para el vendedor en Supabase Auth.
Si el responsable técnico necesita entrar, crea otra cuenta. Copia los IDs de
usuario de las cuentas autorizadas y configura `ADMIN_USER_IDS` en el servidor
como una lista separada por comas. Ejemplo con un identificador ficticio:

```dotenv
ADMIN_USER_IDS=11111111-1111-4111-8111-111111111111
```

En local, configura la variable en `.env.local` y reinicia el servidor. En
Vercel, configúrala en el entorno del despliegue correspondiente. El panel
usa la misma URL y clave anónima de Supabase que el catálogo.
`SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` siguen siendo variables
exclusivas del servidor. Retira `ADMIN_PIN` de la configuración.

Abre `/admin` e inicia sesión con el correo y la contraseña de una cuenta
autorizada. El catálogo público sigue disponible sin cuenta.

Ejecuta `npm test` con Node.js 22.15 o posterior para comprobar las rutas
privadas con Supabase y Gemini simulados. La prueba con una cuenta real se
puede hacer después de configurar `ADMIN_USER_IDS`.

## Migración del catálogo y publicación de fichas

Ejecuta el SQL de `supabase/migrations/20261119000200_publicacion_propiedades.sql`
en el SQL Editor de Supabase antes de desplegar esta versión. Requiere Postgres 15
o posterior y las tablas existentes `propiedades` y `leads_compradores`.
Prepara el cambio de código y SQL para la misma ventana. El catálogo quedará
vacío hasta que vuelvas a publicar fichas desde el panel.

Las propiedades existentes conservan sus datos, textos e ID y pasan a borrador
privado. Desde el panel, completa los campos que falten, prepara y revisa las
copias de las fotos públicas y pulsa **Confirmar revisión y publicar**.
El catálogo lee de `propiedades_publicas`. La vista respeta RLS y expone los
campos públicos solo para fichas publicadas. El formulario VIP conserva la
inserción anónima y su listado queda protegido.

En Vercel, configura `NEXT_PUBLIC_WHATSAPP_ASESOR` en **Production** con el
número internacional real de Sergio y vuelve a desplegar. La compilación de
producción verifica el formato y descarta el antiguo número de ejemplo. En
desarrollo y Preview puedes dejarlo pendiente y usar el acceso a la Lista VIP.
Comprueba desde un celular que WhatsApp abra el chat correcto antes de difundirlo.

## Fotos de Google Drive

1. Aplica la migración de publicación de fichas y después ejecuta
   `supabase/migrations/20261119000400_fotos_drive.sql` en el SQL Editor.
2. En Drive, comparte la carpeta como **Cualquier persona con el enlace →
   Lector** y permite las descargas. Pega el enlace completo de la carpeta en
   el panel, incluido `resourcekey` cuando aparezca. Revisa el nombre de la
   carpeta, los archivos y las imágenes antes de publicar.
3. Deja `GOOGLE_DRIVE_API_KEY` sin definir para usar la vista pública de Drive.
   El selector lee el HTML del primer nivel y abre miniaturas y descargas
   directamente en Google. Si Drive cambia la vista, el panel informará que
   no pudo leerla. Comprueba el enlace en una ventana sin sesión de Google.

Si ya tienes una clave y quieres usar la API oficial, habilita **Google Drive
API**, restringe la clave a esa API y configura `GOOGLE_DRIVE_API_KEY` solo en
el servidor. [Configuración de claves](https://docs.cloud.google.com/docs/authentication/api-keys).

El selector admite JPEG, PNG, WebP, GIF y AVIF que Drive muestre en el primer
nivel. **Usar de portada** incluye esa imagen en la selección. Se puede
descargar cada original desde el selector o la ficha guardada. La ficha pública
muestra las copias revisadas en una galería propia. También puedes
descargar los originales seleccionados en un solo ZIP desde el selector o
desde el inventario (hasta 60 fotos, 24 MB por archivo y 80 MB por selección).

## Generar y aprobar textos

Después de las migraciones de publicación y fotos, ejecuta
`supabase/migrations/20261119000500_aprobacion_textos.sql` en el SQL Editor.
Los textos existentes permanecen guardados y requieren su primera aprobación.

En el inventario de `/admin`, abre **Textos de la propiedad**. Marca las
condiciones confirmadas para esa ficha y genera los cuatro borradores. Edita
y guarda cada texto, apruébalo y copia la versión final para publicar
manualmente. Elige el público y las características confirmadas que quieras
destacar en español e inglés. Puedes regenerar un solo canal. Si cambias los
datos compartidos, las demás piezas conservan su redacción y regresan a revisión.

Se reutiliza `GEMINI_API_KEY`. Si falta la clave o Gemini no devuelve cuatro
textos válidos, se usan plantillas con las condiciones confirmadas. Ambos
resultados requieren revisión y aprobación.

## Actualizar disponibilidad

Ejecuta `supabase/migrations/20261119000600_disponibilidad_publica.sql`
después de las migraciones anteriores. Añade la fecha de última confirmación
a la vista pública y conserva los estados actuales.

Desde el inventario publicado en `/admin`, usa **Confirmar disponible**,
**Marcar en contrato** o **Marcar ya no disponible**. Tras 72 horas sin
confirmación, una propiedad disponible permanece visible como **Por
confirmar**. Cuando cambia a **En contrato** o **Ya no disponible**, su ficha
sigue abriendo con el estado y acceso a otras propiedades. **Volver a
disponible** confirma la fecha y devuelve la ficha al catálogo con el mismo
enlace. Desde la ficha histórica se puede consultar por una casa similar. Si
hay opciones confirmadas en las últimas 72 horas, la página muestra hasta dos,
priorizando el mismo ZIP y luego la cercanía de precio dentro de la zona.

### Actualización de zona pública y portadas

Sobre la base existente, aplica las siguientes migraciones en orden desde el SQL Editor.

1. `supabase/migrations/20261120001100_zona_y_disponibilidad.sql`. Incluye
   consultas de inspección. Las fichas publicadas con zona inválida vuelven a
   borrador con el mismo ID. Las disponibles cuya confirmación anterior
   coincidía exactamente con la publicación quedan pendientes de verificar.
   Las confirmaciones posteriores se conservan.
2. `supabase/migrations/20261120001200_portada_optimizada.sql`. Guarda la
   portada revisada de Drive en formato WebP. El mecanismo de preparación se
   actualiza con la migración de material público descrita más abajo.

Al publicar verás la zona que recibirá el visitante. Marca la confirmación de
disponibilidad cuando acabes de verificarla con el proveedor. El inventario
muestra primero una cola de fichas por confirmar, ordenada por antigüedad.

## Corregir el precio de una ficha publicada

Ejecuta `supabase/migrations/20261119000800_revision_textos_por_precio.sql`
después de las migraciones anteriores. En `/admin`, abre **Corregir precio**
en una ficha publicada. El catálogo y los avisos preparados después usan el
importe actualizado, con el mismo enlace de ficha. Los cuatro textos conservan
su contenido y vuelven a revisión cuando cambia el precio. Aprueba de nuevo
cada texto antes de copiarlo como final.

## Compradores VIP

Ejecuta `supabase/migrations/20261119000900_permisos_compradores_vip.sql`
después de las migraciones anteriores, al actualizar la aplicación. La
migración bloquea el acceso directo del navegador a la tabla. El formulario
público de esta versión registra a los compradores mediante el servidor.

En `/admin`, pulsa **Ver compradores** y usa **Abrir WhatsApp** para dar
seguimiento manual. El formulario pide elegir México (+52) o Estados Unidos (+1) para
números locales de diez dígitos.

## Ciudad y ZIP del área de Phoenix

El catálogo usa un selector fijo de ciudades y un filtro de ZIP combinable.
En el panel, elige la ciudad y escribe el ZIP público. El pegado de datos
reconoce localidades coincidentes con el selector. Revisa cualquier ubicación
ambigua antes de publicar.

Aplica `supabase/migrations/20261125001300_ciudad_zip.sql` en el SQL Editor
después de las migraciones anteriores. Añade las columnas calculadas `ciudad`
y `zip`, conservando `ciudad_zona` y los enlaces de las fichas existentes.
La consulta comentada al final identifica ubicaciones sin ciudad reconocida.
El catálogo interpreta también las ubicaciones anteriores mientras aplicas el SQL.
Las opciones estables se mantienen en `lib/ciudades-phoenix.ts` y en la función
SQL de la migración.

## Versiones de borrador, captación y pruebas de base

Para actualizar una base existente que ya tiene las migraciones anteriores,
ejecuta en el SQL Editor, antes de usar esta versión del panel:

1. `supabase/migrations/20261125001400_version_ficha.sql`.
2. `supabase/migrations/20261125001500_proteger_captacion.sql`.

Abre de nuevo el panel para cargar `ficha_version`. Si otra sesión cambió el
borrador, el guardado devuelve un conflicto y conserva tu edición local.
«Recargar inventario» obtiene los datos recientes. Compara los cambios antes
de cargar la ficha de nuevo en el formulario.

La captación usa una función de PostgreSQL que registra la solicitud y su
huella en una transacción. Los envíos idénticos se reconocen durante 24 horas.
Una corrección del registro VIP actualiza los datos del teléfono existente.
Un propietario puede ofrecer varias casas diferentes. Se permiten hasta cinco
envíos distintos por teléfono y hora, sumando ambos formularios, y 300 envíos
por hora en total. Un límite devuelve HTTP 429 con `Retry-After`. Los reintentos
idénticos aceptados anteriormente devuelven éxito sin consumir otra cuota.
El campo oculto `sitio_web` descarta automatizaciones simples. Estos controles
reducen el abuso y se comparten entre instancias del servidor.

Las huellas se calculan con HMAC usando la clave de servidor de Supabase.
La tabla temporal de control conserva únicamente huellas, canal y fecha,
y elimina registros mayores de 24 horas al procesar un envío. Rotar la clave
de servidor cambia las huellas y reinicia de hecho su ventana de reconocimiento.
Los límites se pueden ajustar en la función SQL. La protección falla con un
mensaje de reintento si la base no está disponible.

Para una instalación vacía, el esquema inicial está versionado en
`supabase/migrations/20261118000000_esquema_inicial.sql`. Aplica toda la cadena
por orden de nombre. En una base existente, conserva las migraciones ya
aplicadas. El esquema inicial usa `create table if not exists` y no reconstruye
ni reemplaza tablas anteriores.

- `npm test` ejecuta pruebas de rutas, componentes y PostgreSQL en memoria.
- `npm run test:db` aplica todas las migraciones desde cero en PGlite y comprueba
  permisos anónimos/autenticados, versiones, triggers, idempotencia, límites y
  recuperación tras una escritura fallida.
- `npm run test:e2e` ejecuta los recorridos móviles en Playwright. Usa una copia
  temporal aislada del proyecto, fuentes del sistema y respuestas simuladas de
  red. Comprueba que los formularios preserven datos tras un rechazo y que el
  panel envíe su versión al guardar. También comprueba los filtros, la paginación,
  la actualización al volver a la pestaña y la revisión de fotos antes de publicar.
  El servidor de ensayo ocupa el puerto 3107.

Para los recorridos de navegador, instala Chromium con
`npx playwright install chromium` o configura `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
con la ruta de un Chrome/Chromium instalado. Las pruebas requieren Node.js
22.15 o posterior. La suite PostgreSQL no necesita claves ni acceso a Supabase.
Las políticas del despliegue real requieren además un ensayo sobre su entorno.


## Mantenimiento del catálogo y fotos públicas

Después de las migraciones anteriores, aplica
`supabase/migrations/20261125001600_material_publico.sql` antes de desplegar
esta versión. Conserva las referencias originales para el operador y limita
la vista pública a las copias revisadas.

En una ficha guardada, pulsa **Revisar ficha y fotos**, elige hasta 12 fotos
(la portada está incluida) y pulsa **Preparar fotos públicas**. El servidor
prepara una imagen por solicitud. Revisa las copias que aparecen, marca que
ocultan el domicilio y confirma la publicación. Los nombres de archivos, las
claves de Drive y el enlace a la carpeta de origen quedan reservados al panel.
Para una portada alternativa por URL, sube una copia de la imagen de hasta
4 MB. El servidor procesa ese archivo para evitar descargar URLs arbitrarias.

Las fichas ya publicadas tienen **Actualizar fotos públicas**. Las portadas
WebP que ya estaban guardadas siguen disponibles. Las antiguas que carezcan
de copia requieren prepararla desde el panel. Las visitas públicas sólo leen
material guardado y revalidan su ETag, incluso cuando Drive está caído. Una
ficha retirada deja de servir fotos. Los archivos que el visitante haya
descargado previamente permanecen en su dispositivo.

Las copias se guardan en PostgreSQL con un máximo de 2 MB por foto optimizada.
Cada preparación tiene una reserva de 90 segundos que evita trabajo duplicado.
El reintento aprovecha las fotos terminadas y puede recuperar una reserva
vencida. Al preparar material, se limpian las copias antiguas sin referencias;
eliminar una ficha elimina sus copias. Actualizar la galería conserva el enlace
individual y exige revisar la versión actual de la ficha.

Puedes guardar correcciones de datos sin consultar Drive cuando mantengas
la carpeta y uses fotos ya verificadas. Una selección que incorpore archivos
nuevos vuelve a comprobar su acceso.

El catálogo consulta páginas de 12 propiedades con ciudad y ZIP filtrados
en el servidor y un conteo total correspondiente a esos filtros. Cambiar un
filtro vuelve a la primera página. Se actualiza al recuperar el foco, al volver
a una pestaña visible, cada minuto mientras está visible o con **Actualizar
catálogo**. Las respuestas de consultas anteriores se cancelan al cambiar los
filtros.

Los errores de servidor incluyen una referencia de incidente que puede
buscarse en los logs del despliegue. Se registran operación, código permitido
y estado HTTP cuando existe. Se excluyen mensajes originales, teléfonos,
domicilios, claves, tokens y cuerpos de peticiones. El panel separa acceso,
peticiones autenticadas, inventario, tarjetas y revisión de material en módulos.
