# 04: Elegir y descargar fotos desde Drive

**Qué construir:** El vendedor prepara portada y fotos para Facebook desde la carpeta de Drive.

**Bloqueado por:** 02 · Guardar y publicar una ficha privada

**Estado:** implementado

## Criterios de aceptación

- [x] Puede listar y revisar fotos y nombres para detectar pistas del domicilio.
- [x] La portada y la selección persisten. Se pueden descargar las fotos seleccionadas.
- [x] La ficha pública enlaza a la carpeta completa revisada.

**Verificación local:** API con cuenta y Drive simulados, selección persistida, portada privada hasta publicar y migración SQL con roles de Supabase. Se admite una carpeta pública sin clave. Se verificó el formato HTML con una carpeta pública de ejemplo y las rutas con respuestas simuladas. Queda validar con una carpeta del vendedor.
