---
name: auditoria-web
description: Audita exhaustivamente el código fuente de una aplicación web en modo solo lectura y entrega un reporte técnico accionable de arquitectura, mantenibilidad, rendimiento, seguridad, UX, pruebas y observabilidad, con evidencia por archivo y mejoras priorizadas por impacto y esfuerzo. Úsala cuando el usuario solicite una auditoría integral del proyecto.
---

# Auditoría web

Analiza el repositorio real y entrega un reporte técnico accionable, siguiendo todas las fases y el formato final de esta skill. Considera los objetivos del producto y los flujos críticos documentados al priorizar.

## Reglas operativas obligatorias

1. **Modo solo lectura.** NO modifiques, borres ni crees archivos de código durante la auditoría. El único entregable es el análisis y las recomendaciones en la respuesta. Los fragmentos sugeridos permanecen dentro del reporte. Una implementación posterior requiere que el usuario elija qué mejoras ejecutar.
2. **Evidencia exacta.** Cada hallazgo cita la ruta exacta y el rango de líneas, con el formato `ruta/archivo.ext:L10-L45`. Comprueba los números con una lectura numerada del archivo actual. Cuando el problema depende de varios módulos, cita cada punto relevante. Evita consejos genéricos sin respaldo en el código del repositorio.
3. **Sin saturación.** Recorre primero estructura y configuración y luego módulos clave. Excluye de la lectura archivos autogenerados, `node_modules`, `dist`, `build`, cachés y archivos de lock. Lee selectivamente los archivos propios y sigue sus llamadas hasta verificar el comportamiento.
4. **Criterio pragmático.** Prioriza cambios que reduzcan bugs, deuda técnica o problemas de rendimiento. Evita nitpicks puramente estilísticos. Vincula cada propuesta a una consecuencia concreta y a su esfuerzo estimado.

La auditoría respeta el modo solo lectura también al usar herramientas. Ejecuta únicamente comprobaciones cuyos efectos conozcas y sean compatibles con ese modo. Describe como pendientes los tests, builds o verificaciones que generen archivos o contacten servicios con efectos externos. Distingue lo observado, las inferencias y lo que falta verificar. Redacta cualquier secreto encontrado y cita su ubicación sin reproducir su valor.

## Fases obligatorias de análisis

### Fase 1: Mapeo del Stack y Arquitectura

- Identifica lenguajes, frameworks, librerías principales, gestor de estado, base de datos/ORM y herramientas de build.
- Evalúa estructura de carpetas, separación de responsabilidades entre UI, lógica de negocio y acceso a datos, y acoplamiento entre módulos.
- Detecta dependencias obsoletas, redundantes o sin usar en configuraciones como `package.json` o `requirements.txt`. Confirma usos en imports, scripts y configuración antes de afirmar que sobran. Verifica obsolescencia con fuentes oficiales actuales cuando sea necesario y cita además la declaración local. Expresa cualquier incertidumbre si esa verificación falta.

### Fase 2: Calidad de Código y Mantenibilidad

- Identifica archivos, componentes o funciones excesivamente largos o con demasiadas responsabilidades y alta complejidad ciclomática. Señala las ramas y responsabilidades que justifican el hallazgo.
- Detecta lógica duplicada que convenga abstraer en utilidades, hooks o servicios compartidos, preservando el comportamiento de sus consumidores.
- Revisa manejo de errores, incluyendo `try/catch` vacíos, promesas sin capturar y errores silenciados.
- Detecta código muerto, imports sin usar, variables globales peligrosas y problemas de tipado, incluyendo abuso de `any` o ausencia de validación de esquemas.

### Fase 3: Rendimiento (Frontend y Backend)

- **Frontend.** Revisa re-renderizados innecesarios, efectos mal configurados, lazy loading y code splitting donde aporten valor, recursos pesados y ubicación del estado.
- **Backend / Datos.** Revisa consultas ineficientes y N+1, falta de paginación, ausencia de caché donde aplique, operaciones síncronas bloqueantes y payloads excesivos.
- Fundamenta cada problema en un recorrido de ejecución verificable. Diferencia un coste inferido del código de una degradación medida.

### Fase 4: Seguridad y Configuración

- Revisa variables de entorno y posibles secretos o credenciales expuestos en el código.
- Verifica validación y sanitización de entradas en cliente y servidor.
- Revisa autenticación, autorización, CORS, headers de seguridad y manejo de sesiones y tokens.
- Sigue los controles hasta su implementación efectiva, incluyendo permisos de datos y migraciones posteriores, antes de reportar una exposición.

### Fase 5: UX Técnica, Pruebas y Observabilidad

- Comprueba estados de carga, estados vacíos y mensajes de error claros en flujos críticos.
- Evalúa accesibilidad básica del frontend, incluyendo semántica HTML, etiquetas `aria` y navegación por teclado.
- Revisa tests unitarios, de integración y E2E e identifica partes críticas del negocio sin cobertura. Cita el flujo y los tests existentes que sustentan la conclusión.
- Evalúa logging y monitoreo para diagnosticar fallos de producción.

Completa las cinco fases. Cuando una dimensión no aplique o no pueda verificarse, decláralo brevemente en el reporte con su motivo. Consolida causas compartidas para evitar repetir el mismo hallazgo. Usa IDs estables, como `AW-01`, en la tabla, los detalles y el plan. Ordena por impacto y, entre impactos equivalentes, por menor esfuerzo. Impacto y esfuerzo usan exclusivamente Alto, Medio o Bajo. Justifica las valoraciones en el detalle con los flujos afectados y el alcance de la solución. Reporta solo hallazgos respaldados, aunque eso produzca menos de tres prioridades.

## Formato obligatorio del reporte final

Entrega exactamente estas cinco secciones, en este orden.

### 1. Resumen Ejecutivo

Diagnóstico general del proyecto en 3–5 líneas y las 3 prioridades más urgentes, referidas a sus IDs. Incluye el alcance real de la verificación y cualquier limitación material. Si existen menos de tres hallazgos sustentados, indica cuántos y conserva únicamente esos.

### 2. Matriz de Mejoras Priorizadas (Tabla)

| ID | Categoría | Hallazgo | Archivo(s) | Impacto (Alto/Medio/Bajo) | Esfuerzo (Alto/Medio/Bajo) |
| --- | --- | --- | --- | --- | --- |

Completa una fila por hallazgo. En `Archivo(s)` cita rutas y rangos exactos con el formato `ruta/archivo.ext:L10-L45`.

### 3. Detalle Técnico de Hallazgos (ordenados de mayor a menor impacto)

Para cada ID incluye lo siguiente.

- **Problema:** qué está mal y dónde, con la referencia `ruta/archivo.ext:L10-L45` y el comportamiento observado en el código.
- **Riesgo / Consecuencia:** qué puede fallar o degradarse, en qué condiciones y por qué tiene el impacto indicado.
- **Propuesta de mejora:** solución o refactorización concreta, alcance que determina el esfuerzo y verificación sugerida. Incluye un fragmento breve de código propuesto cuando ayude a clarificar.

### 4. Plan de Acción Sugerido

Agrupa los IDs de la tabla en estas categorías, conservando sus valoraciones.

- **Quick wins:** alto impacto y bajo esfuerzo.
- **Refactorizaciones planificadas:** alto impacto y esfuerzo medio/alto.
- **Mantenimiento:** mejoras menores para después.

Ubica las mejoras de impacto medio o bajo en Mantenimiento y conserva su prioridad relativa. Indica dependencias entre mejoras si afectan el orden de ejecución. Si una categoría está vacía, indícalo.

### 5. Cierre interactivo

Pregunta al usuario qué IDs de la tabla desea implementar primero antes de tocar cualquier archivo. Termina la auditoría y espera esa selección.
