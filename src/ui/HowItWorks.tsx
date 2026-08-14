import { LIMITS } from "../domain/limits";
import { IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER } from "../domain/copy";
import { formatNumber } from "./labels";
import "./HowItWorks.css";

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-heading">
      <div className="app-shell">
        <p className="section-eyebrow">Cómo funciona</p>
        <h2 id="como-funciona-heading">El contrato, las cuatro reglas y sus límites</h2>

        <div className="how-grid">
          <div className="how-block measure">
            <h3>Contrato</h3>
            <p>
              Cada ejecución envía una entrada validada contra <code>input.schema.json</code> y recibe una
              salida validada contra <code>output.schema.json</code> (<code>schemaVersion: "1.0.0"</code> en
              ambos). El validador está escrito a mano, sin compiladores de esquema en tiempo de
              ejecución, para poder mantener una CSP estricta (<code>script-src 'self'</code>, sin{" "}
              <code>'unsafe-eval'</code>).
            </p>
          </div>

          <div className="how-block measure">
            <h3>Las cuatro reglas que verás en acción</h3>
            <ul>
              <li>
                <strong>Primera ejecución.</strong> Si no hay registro para la clave, se ejecuta y su
                resultado se guarda como referencia.
              </li>
              <li>
                <strong>Reintento.</strong> Misma clave y misma huella de payload → se devuelve el
                resultado ya guardado, sin ejecutar nada de nuevo <em>en este simulador local</em>.
              </li>
              <li>
                <strong>Conflicto.</strong> Misma clave, huella de payload distinta → se rechaza sin
                sobrescribir lo guardado; hay que usar una clave nueva.
              </li>
              <li>
                <strong>Expiración.</strong> Una clave completada que supera su TTL simulado se trata
                como si nunca hubiera existido, pero eso solo reinicia este simulador local: no dice
                nada sobre si la operación original se ejecutará de nuevo aguas arriba en un sistema
                real.
              </li>
            </ul>

            <div className="how-disclaimer measure">
              <p className="transition-card-label">Idempotencia observada vs. exactly-once</p>
              <p>{IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER}</p>
            </div>
          </div>

          <div className="how-block measure">
            <h3>Arquitectura</h3>
            <p>
              100% estático, sin backend: la lógica corre en un Web Worker (con fallback automático en el
              mismo hilo principal si el navegador no soporta <code>Worker</code>). Nada de lo que escribas
              en el editor sale de tu navegador.
            </p>
          </div>

          <div className="how-block measure">
            <h3>Límites conocidos</h3>
            <ul className="mono how-limits">
              <li>maxProperties del payload: {formatNumber(LIMITS.MAX_PAYLOAD_PROPERTIES)}</li>
              <li>profundidad máxima del payload: {formatNumber(LIMITS.MAX_PAYLOAD_DEPTH)}</li>
              <li>texto pegado máximo: {formatNumber(LIMITS.MAX_INPUT_TEXT_CHARS)} caracteres</li>
              <li>TTL por defecto: {LIMITS.DEFAULT_TTL_MS / 3_600_000} h</li>
              <li>TTL corto (demo de expiración): {LIMITS.SHORT_TTL_MS / 1000} s</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
