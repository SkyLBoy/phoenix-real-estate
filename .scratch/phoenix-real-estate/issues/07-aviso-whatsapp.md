# 07: Preparar el aviso diario de WhatsApp

**Qué construir:** El vendedor comparte el inventario del día con el grupo existente.

**Bloqueado por:** 06 · Actualizar disponibilidad desde el celular

**Estado:** implementado

## Criterios de aceptación

- [x] El aviso incluye zona, precio y un único enlace al catálogo.
- [x] Incluye fichas vigentes de días anteriores y marca las pendientes como Por confirmar. Excluye En contrato y Ya no disponible.
- [x] Se pueden copiar el aviso y los enlaces individuales.

**Verificación local:** lectura paginada de la vista pública con Supabase simulado, inclusión de fichas vigentes de días anteriores, prioridad de confirmadas, exclusión de estados inactivos y un solo enlace al catálogo.
