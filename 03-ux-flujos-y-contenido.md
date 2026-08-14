<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 03 · UX, flujos y contenido

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Arquitectura de información

1. **Hero de prueba:** problema, privacidad y acción principal.
2. **Workbench:** entrada, escenario y ejecución.
3. **Resultado:** estado, explicación, evidencia y siguiente acción.
4. **Cómo funciona:** contrato, límites y arquitectura.
5. **Caso de estudio:** decisiones, pruebas y repositorio.

## Primeros 30 segundos

El visitante ve un fixture precargado, un texto breve sobre privacidad y el CTA **“Ejecutar escenario”**. La aplicación realiza: repetir una operación con la misma clave y cambiar el payload para observar cada transición.

## Primeros 90 segundos

El visitante abre un hallazgo, entiende causa y consecuencia, cambia un parámetro, vuelve a ejecutar y descarga un informe sin crear cuenta.

## Flujo

~~~mermaid
flowchart LR
    A[Abrir demo] --> B[Elegir fixture]
    B --> C[Revisar entrada]
    C --> D[Ejecutar]
    D --> E{Resultado}
    E -->|válido| F[Explorar evidencia]
    E -->|error| G[Corregir o cambiar escenario]
    F --> H[Exportar]
    G --> D
~~~

## Pantallas y estados

| Superficie | Estados obligatorios |
|---|---|
| Entrada | inicial, editada, inválida, demasiado grande |
| Ejecución | preparada, procesando, cancelada, completada |
| Resultado | sin hallazgos, advertencias, crítico, parcial |
| Exportación | disponible, generando, fallo recuperable |

## Wireframe

~~~text
+----------------------------------------------------------+
| Idempotency Key Visualizer                       [Privacidad]  |
| Problema en una frase             [Ejecutar escenario]   |
+---------------------------+------------------------------+
| Entrada / configuración   | Resultado y explicación      |
| fixture + edición         | estado · evidencia · detalle |
|                           | [Cambiar] [Exportar]          |
+---------------------------+------------------------------+
| Cómo funciona · límites · arquitectura · repositorio     |
+----------------------------------------------------------+
~~~

## Copy base

- **Título:** “Haz visible lo que normalmente falla en silencio.”
- **Ayuda:** “Usa el ejemplo incluido o carga datos propios. El modo local no los envía a ningún servidor.”
- **CTA:** “Ejecutar escenario”.
- **Vacío:** “Aún no hay resultado. Ejecuta el fixture para ver cada decisión.”
- **Error recuperable:** “No pudimos procesar esta entrada. Tus datos no se enviaron; corrige los campos señalados.”
- **Resultado:** “La ejecución terminó. Abre cada decisión para revisar su evidencia.”
