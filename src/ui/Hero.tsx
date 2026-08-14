import { PrivacyNote } from "./PrivacyNote";
import "./Hero.css";

export function Hero() {
  return (
    <header className="hero">
      <div className="app-shell hero-inner">
        <p className="section-eyebrow">Idempotency Key Visualizer</p>
        <h1 className="hero-title">Haz visible lo que normalmente falla en silencio.</h1>
        <p className="hero-subtitle measure">
          Repite una operación con la misma clave de idempotencia, cambia el payload y observa cada
          decisión del motor explicada: primera ejecución, reintento, conflicto, solicitud concurrente y
          expiración de clave — todo en local, sin backend.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#workbench">
            Ejecutar escenario
          </a>
          <a className="btn btn-quiet" href="#como-funciona">
            Cómo funciona
          </a>
        </div>
        <PrivacyNote variant="hero" />
      </div>
    </header>
  );
}
