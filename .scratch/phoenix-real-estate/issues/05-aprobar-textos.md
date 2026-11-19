# 05: Generar, editar y aprobar textos

**Qué construir:** El vendedor prepara y aprueba cuatro textos editables para publicación manual.

**Bloqueado por:** 02 · Guardar y publicar una ficha privada

**Estado:** implementado

## Criterios de aceptación

- [x] Incluye Facebook ES, Facebook EN, WhatsApp individual y respuesta inicial.
- [x] Gemini recibe los datos públicos pertinentes sin domicilio. El texto usa detalles reales y condiciones confirmadas.
- [x] Las plantillas de respaldo siguen el mismo flujo. Solo se copia como final lo aprobado.

**Verificación local:** API con Gemini y Supabase simulados, plantillas, revisión por texto, conflictos de edición y migración verificada en PostgreSQL. Pendiente aplicar el SQL y probar el flujo con una cuenta real.
