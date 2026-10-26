import { useEffect, useId, type ReactNode } from 'react';

interface Props {
  title: string;
  /** Sous le titre (adresse, contexte…). */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Fenêtre de dialogue : panneau depuis le bas sur mobile, fenêtre centrée sur grand écran. */
export function Sheet({ title, subtitle, onClose, children }: Props) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet__handle" aria-hidden="true" />
        <div>
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          {subtitle}
        </div>
        {children}
      </div>
    </div>
  );
}
