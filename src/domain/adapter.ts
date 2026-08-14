/**
 * Interruptor del adaptador "real" opcional — ver 08-seguridad-privacidad.md
 * y 05-arquitectura-tecnica.md §Configuración y secretos.
 *
 * Kill switch: el adaptador real está permanentemente deshabilitado en este
 * build. Poner options.deterministic a false en la UI NO llega a hacer una
 * llamada de red real — solo demuestra el camino de fallback que tomaría una
 * integración real (ver IDEMP_DEPENDENCY_FALLBACK en rules.ts).
 */
export const REAL_ADAPTER_ENABLED = false as const;
