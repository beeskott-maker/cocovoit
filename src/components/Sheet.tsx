import { useEffect, useId, useRef, type ReactNode, type TouchEvent } from 'react';

interface Props {
  title: string;
  /** Sous le titre (adresse, contexte…). */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Glissement vers le bas au-delà duquel le panneau se ferme (px), ou vitesse (px/ms). */
const CLOSE_DISTANCE = 80;
const CLOSE_SPEED = 0.5;

/**
 * Fenêtre de dialogue : panneau depuis le bas sur mobile, fenêtre centrée sur
 * grand écran. Sur écran tactile, on le ferme en le faisant glisser vers le bas.
 */
export function Sheet({ title, subtitle, onClose, children }: Props) {
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  function onTouchStart(e: TouchEvent) {
    drag.current = { y: e.touches[0].clientY, t: e.timeStamp, dy: 0 };
  }
  function onTouchMove(e: TouchEvent) {
    const d = drag.current;
    if (!d || !sheet.current) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    sheet.current.style.transition = 'none';
    sheet.current.style.transform = `translateY(${d.dy}px)`;
  }
  function onTouchEnd(e: TouchEvent) {
    const d = drag.current;
    drag.current = null;
    const el = sheet.current;
    if (!d || !el || d.dy === 0) return;
    el.style.transition = 'transform 0.2s ease-out';
    // Fermé si glissé assez loin, ou d'un geste vif (mais pas un simple effleurement).
    const flick = d.dy > 24 && d.dy / Math.max(1, e.timeStamp - d.t) > CLOSE_SPEED;
    if (d.dy > CLOSE_DISTANCE || flick) {
      el.style.transform = 'translateY(100%)';
      el.addEventListener('transitionend', onClose, { once: true });
    } else {
      el.style.transform = '';
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheet}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
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
