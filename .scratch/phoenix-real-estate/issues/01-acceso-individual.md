# 01: Acceso individual al panel

**Qué construir:** El vendedor inicia y cierra sesión con una cuenta propia y gestiona el inventario existente.

**Bloqueado por:** Ninguno (puede empezar de inmediato)

**Estado:** implementado

## Criterios de aceptación

- [x] Una cuenta autorizada puede consultar, dar de alta, cambiar estado y eliminar propiedades.
- [x] Las rutas privadas rechazan solicitudes sin sesión válida o sin autorización. El PIN deja de usarse.
- [x] El responsable técnico puede usar una cuenta separada si necesita acceso.

**Verificación local:** las pruebas ejercitan las cuatro rutas privadas con Supabase y Gemini simulados. La validación con la cuenta real del vendedor forma parte del ensayo de lanzamiento (Ticket 11).
