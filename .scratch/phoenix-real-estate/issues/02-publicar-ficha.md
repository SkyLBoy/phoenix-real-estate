# 02: Guardar y publicar una ficha privada

**Qué construir:** El vendedor guarda y publica una ficha con enlace estable.

**Bloqueado por:** 01 · Acceso individual al panel

**Estado:** implementado

## Criterios de aceptación

- [x] El borrador incompleto solo se puede consultar en privado.
- [x] Publicar exige zona, precio y portada revisada. El catálogo permite filtrar por ciudad o ZIP y abre un chat con el vendedor.
- [x] Los datos públicos excluyen direcciones exactas, borradores y textos internos.

**Verificación local:** pruebas de rutas con servicios simulados y migración probada en PostgreSQL local con los roles del Data API. Pendiente aplicar la migración en Supabase y probar allí el flujo completo.
