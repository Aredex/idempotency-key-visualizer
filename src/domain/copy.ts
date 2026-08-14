/**
 * Cadenas de lenguaje natural reutilizables que el propio MOTOR emite en
 * Finding.message / Transition.explanation (la UI tendrá su copy adicional,
 * pero cualquier texto que salga del dominio vive aquí para poder testearlo
 * de forma centralizada).
 *
 * Regla dura, verificada por un test dedicado: ninguna cadena de este
 * archivo (ni de ningún otro lugar donde el motor emita mensajes) puede
 * afirmar certificación, entrega exactly-once garantizada, ni frases como
 * "garantizado", "certificado", "100% seguro", "nunca falla". Preferimos
 * lenguaje como "supuesto", "límite conocido", "confianza: alta/media/baja".
 */

export const IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER =
  "Esto confirma idempotencia observada en este simulador local (misma clave + mismo payload " +
  "devuelve el mismo resultado guardado), no una garantía de exactly-once en un sistema " +
  "distribuido real.";

export const FIRST_EXECUTION_EXPLANATION =
  "No había ningún registro para esta clave de idempotencia: se trata como primera ejecución " +
  "y su resultado queda guardado como referencia para futuros reintentos.";

export const RETRY_HIT_EXPLANATION =
  `Misma clave y mismo payload (misma huella canónica) que una ejecución anterior: se devuelve ` +
  `el resultado ya guardado sin volver a ejecutar nada. ${IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER}`;

export const CONFLICT_EXPLANATION =
  "Misma clave de idempotencia pero la huella del payload no coincide con la del payload " +
  "guardado originalmente: es un supuesto de este simulador que dos payloads distintos bajo la " +
  "misma clave son la misma operación reintentada por error, o una colisión de claves. El " +
  "resultado guardado no se sobrescribe.";

export const CONCURRENT_GUARD_EXPLANATION =
  "Llegó una segunda solicitud para la misma clave mientras la primera aún se estaba " +
  "procesando: es una ventana de carrera simulada en un único hilo, no concurrencia real " +
  "multi-hilo. Los backends reales usan locks distribuidos, que se comportan de forma distinta " +
  "(pueden encolar, rechazar o esperar según el diseño concreto).";

export const EXPIRED_KEY_EXPLANATION =
  "El registro guardado para esta clave superó su TTL simulado: este simulador lo trata como " +
  "una clave nueva. Límite conocido: esta expiración local no demuestra que la operación " +
  "original no pueda volver a ejecutarse en un sistema distribuido real — solo reinicia esta " +
  "demo local.";

export const DEPENDENCY_FALLBACK_EXPLANATION =
  "Se pidió el modo 'no determinista' (adaptador real), pero el adaptador real está " +
  "deshabilitado por diseño en este despliegue: el motor determinista continuó la operación " +
  "en su lugar.";

export const CANCELLED_MESSAGE = "Ejecución cancelada por el visitante antes de completarse.";

/** Mensaje para una solicitud que quedó pendiente en el Web Worker justo
 * cuando este falló (evento "error") o cuando el cliente se destruyó
 * (`terminate()`): no puede completarse tal cual estaba en curso, así que se
 * resuelve como fallida en vez de dejar la promesa colgada para siempre. */
export const WORKER_DEGRADED_FALLBACK_MESSAGE =
  "El Web Worker falló (o se cerró) mientras esta ejecución seguía en curso: esta demo cambió " +
  "al modo de respaldo en el mismo hilo, pero esta solicitud concreta no pudo completarse. " +
  "Vuelve a intentarlo.";
