# 06: Actualizar disponibilidad desde el celular

**Qué construir:** El vendedor confirma o cambia la disponibilidad desde la lista.

**Bloqueado por:** 02 · Guardar y publicar una ficha privada

**Estado:** implementado

## Criterios de aceptación

- [x] A las 72 horas sin confirmación, sigue visible con la etiqueta Por confirmar.
- [x] En contrato y Ya no disponible salen del listado. El enlace sigue mostrando el estado y alternativas.
- [x] Al volver a Disponible, reaparece con el mismo enlace.

**Verificación local:** umbral de 72 horas, confirmación y reactivación desde la API, y consulta de la vista pública con los permisos de Supabase en PostgreSQL local. Falta aplicar la migración en el proyecto Supabase.
