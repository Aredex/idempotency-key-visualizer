import "./CaseStudyPointer.css";

const REPO_URL = "https://github.com/Aredex/idempotency-key-visualizer";

export function CaseStudyPointer() {
  return (
    <section id="caso-de-estudio" aria-labelledby="caso-de-estudio-heading">
      <div className="app-shell">
        <p className="section-eyebrow">Caso de estudio</p>
        <h2 id="caso-de-estudio-heading">El porqué de cada decisión, en el repositorio</h2>
        <p className="measure">
          Este demo es la parte visible de un ejercicio más amplio: contrato de entrada/salida versionado,
          motor puro y testeable, worker con fallback, y un sistema visual pensado para explicar —no
          decorar— cada transición de estado. El caso de estudio completo (decisiones de diseño, límites
          conocidos y lo que dejé fuera a propósito) vive en el README del repositorio.
        </p>
        <a className="btn btn-secondary" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Ver el repositorio en GitHub
        </a>
      </div>
    </section>
  );
}
