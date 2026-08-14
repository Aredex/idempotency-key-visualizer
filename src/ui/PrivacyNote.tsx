/**
 * Nota de privacidad reutilizada en el Hero y junto al editor de payload
 * (08-seguridad-privacidad.md): nada sale del navegador, no hay cuenta, el
 * estado es local y "Eliminar datos locales" está siempre disponible.
 */
import "./PrivacyNote.css";

interface PrivacyNoteProps {
  variant?: "hero" | "inline";
}

export function PrivacyNote({ variant = "inline" }: PrivacyNoteProps) {
  return (
    <p className={`privacy-note privacy-note--${variant}`}>
      <span className="privacy-note-icon" aria-hidden="true">
        ●
      </span>
      Usa el ejemplo incluido o carga datos propios. El modo local no los envía a ningún servidor: todo
      corre en tu navegador y puedes borrarlo con «Eliminar datos locales» en cualquier momento.
    </p>
  );
}
