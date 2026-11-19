# 08: Corregir precios y volver a aprobar textos

**Qué construir:** El vendedor actualiza el importe de una ficha publicada y revisa los anuncios afectados.

**Bloqueado por:** 05 · Generar, editar y aprobar textos

**Estado:** implementado

## Criterios de aceptación

- [x] El catálogo y los avisos que se generen después usan el importe nuevo. El enlace se conserva.
- [x] Las ediciones se conservan y los textos afectados requieren otra aprobación antes de copiarse como finales.

**Verificación local:** actualización y conflictos en la API, regeneración del aviso y disparador de revisión validado en PostgreSQL local. Pendiente aplicar la migración en Supabase.
