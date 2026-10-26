import { useEffect, useId, useState, type ReactNode } from 'react';

const ICONS = {
  trash: 'M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2z',
  car: 'M5 11l1.5-4.5h11L19 11m-1.5 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m-11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3M18.92 6c-.2-.58-.76-1-1.42-1h-11c-.66 0-1.22.42-1.42 1L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8z',
};

interface Props {
  title: string;
  icon?: keyof typeof ICONS;
  /** Conséquences de l'action. */
  children: ReactNode;
  confirmLabel?: string;
  busyLabel?: string;
  /** L'action confirmée ; la fenêtre reste ouverte (bouton désactivé) pendant qu'elle s'exécute. */
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

/** Pop-in centrée de confirmation d'une action destructive, à la place de window.confirm. */
export function ConfirmDialog({
  title,
  icon = 'trash',
  children,
  confirmLabel = 'Supprimer',
  busyLabel = 'Suppression…',
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const textId = useId();
  const [busy, setBusy] = useState(false);
  const cancel = () => !busy && onCancel();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="confirm-layer">
      <div className="sheet-scrim" onClick={cancel} aria-hidden="true" />
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}>
        <div className="confirm__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d={ICONS[icon]} />
          </svg>
        </div>
        <h2 id={titleId} className="confirm__title">
          {title}
        </h2>
        <div id={textId} className="confirm__text">
          {children}
        </div>
        <div className="confirm__actions">
          {/* Le focus va sur « Annuler » : valider par erreur avec Entrée ne supprime rien. */}
          <button type="button" className="btn btn--outline" onClick={cancel} disabled={busy} autoFocus>
            Annuler
          </button>
          <button type="button" className="btn btn--destructive" onClick={confirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
