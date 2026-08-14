import { Hero } from "./ui/Hero";
import { Workbench } from "./ui/Workbench";
import { HowItWorks } from "./ui/HowItWorks";
import { CaseStudyPointer } from "./ui/CaseStudyPointer";

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      <Hero />
      <main id="main-content">
        <Workbench />
        <HowItWorks />
        <CaseStudyPointer />
      </main>
      <footer className="app-footer">
        <div className="app-shell app-footer-inner">
          <p>
            Idempotency Key Visualizer — demo local, sin backend. Todo lo que ves corre en tu navegador y
            no se envía a ningún sitio.
          </p>
          <a
            href="https://github.com/Aredex/idempotency-key-visualizer"
            target="_blank"
            rel="noopener noreferrer"
          >
            Código en GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
