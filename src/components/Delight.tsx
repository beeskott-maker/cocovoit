import { useEffect, useId, useState } from 'react';
import { storageKey } from '../lib/env';
import { localToday } from '../lib/format';

/** Chargement : une noix de coco entière qui roule d'un côté à l'autre. */
export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="loading__roller" aria-hidden="true">
        <svg viewBox="0 0 60 60" width="48" height="48">
          <circle cx="30" cy="30" r="26" fill="#aa614b" stroke="#390175" strokeWidth="4" />
          <path d="M14 22q4-6 10-9M12 34q2 6 6 10M34 50q6-1 11-6" fill="none" stroke="#7f3d2e" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="22" cy="20" r="3" fill="#390175" />
          <circle cx="31" cy="16" r="3" fill="#390175" />
          <circle cx="27" cy="27" r="3" fill="#390175" />
        </svg>
      </span>
      {label}
    </div>
  );
}

/** Confettis rose, citron et violet qui s'envolent une fois (place réservée). */
export function Confetti() {
  return (
    <span className="confetti" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

/** Noix de coco qui agite les bras et fait un clin d'œil (« C'est tout bon »). */
export function CheerCoconut() {
  return (
    <svg className="cheer" viewBox="0 0 120 96" width="120" height="96" aria-hidden="true">
      <path className="cheer__arm cheer__arm--l" d="M28 56 L8 40" stroke="#390175" strokeWidth="6" strokeLinecap="round" />
      <path className="cheer__arm cheer__arm--r" d="M92 56 L112 40" stroke="#390175" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="60" cy="58" rx="36" ry="32" fill="#aa614b" stroke="#390175" strokeWidth="4.5" />
      <ellipse cx="62" cy="54" rx="28" ry="25" fill="#fff" stroke="#390175" strokeWidth="4" />
      <ellipse cx="62" cy="55" rx="22" ry="19" fill="#f7e9da" />
      <path d="M47 50q4-5 8 0" fill="none" stroke="#390175" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse className="cheer__wink" cx="73" cy="49" rx="3.5" ry="4" fill="#390175" />
      <path d="M52 60q10 9 20 0" fill="#390175" />
      <circle cx="45" cy="59" r="3.5" fill="#ff7ab6" opacity=".7" />
      <circle cx="80" cy="59" r="3.5" fill="#ff7ab6" opacity=".7" />
    </svg>
  );
}

const VAN_BODY = 'M30 40a20 20 0 0 1 20-20h230c18 0 30 8 38 22l34 59.5q6 11 6 22.5v28a12 12 0 0 1-12 12H42a12 12 0 0 1-12-12z';

/** Le jour du départ : le van traverse l'en-tête du voyage, une fois par jour et par voyage. */
export function DepartureVan({ code }: { code: string }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const key = storageKey(`van:${code}`);
    const today = localToday();
    try {
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch {
      // Stockage indisponible : l'animation joue quand même.
    }
    setPlaying(true);
  }, [code]);
  if (!playing) return null;
  return (
    <div className="departure-van" aria-hidden="true" onAnimationEnd={(e) => e.target === e.currentTarget && setPlaying(false)}>
      <span className="departure-van__puff" />
      <svg viewBox="0 0 400 200" width="96" height="48">
        <rect x="70" y="0" width="240" height="18" rx="9" fill="#E8F04A" />
        <path d={VAN_BODY} fill="#FF7AB6" stroke="#390175" strokeWidth="8" />
        <rect x="50" y="45" width="78" height="50" rx="8" fill="#FFEAF3" />
        <rect x="140" y="45" width="78" height="50" rx="8" fill="#FFEAF3" />
        <path d="M238 45H292Q300 45 304 51.7L326 88.3Q330 95 322 95H238Q230 95 230 87V53Q230 45 238 45Z" fill="#FFEAF3" />
        <circle cx="95" cy="166" r="30" fill="#1B1B1B" />
        <circle cx="95" cy="166" r="12" fill="#E8F04A" />
        <circle cx="290" cy="166" r="30" fill="#1B1B1B" />
        <circle cx="290" cy="166" r="12" fill="#E8F04A" />
      </svg>
      <span className="departure-van__road" />
    </div>
  );
}

/** Mes voyages vide : la noix de coco fait la sieste au soleil, en lunettes noires. */
export function SleepyCoconut() {
  return (
    <svg className="sleepy" viewBox="0 0 240 150" width="220" height="138" aria-hidden="true">
      <g className="sleepy__sun">
        <circle cx="196" cy="36" r="15" fill="#e8f04a" stroke="#390175" strokeWidth="3" />
        <path
          d="M196 10v-6M196 68v-6M170 36h-6M228 36h-6M178 18l-4-4M218 58l-4-4M178 54l-4 4M218 14l-4 4"
          stroke="#390175"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <text className="sleepy__z" x="140" y="62">z</text>
      <text className="sleepy__z sleepy__z--2" x="146" y="58">z</text>
      <text className="sleepy__z sleepy__z--3" x="152" y="54">Z</text>
      <ellipse cx="104" cy="138" rx="56" ry="7" fill="#390175" opacity=".12" />
      <g transform="rotate(-14 104 100)">
        <g className="sleepy__breath">
          <ellipse cx="104" cy="100" rx="48" ry="38" fill="#aa614b" stroke="#390175" strokeWidth="5" />
          <path d="M66 92q-2 12 5 22M73 120q7 7 16 9" fill="none" stroke="#7f3d2e" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="108" cy="95" rx="37" ry="30" fill="#fff" stroke="#390175" strokeWidth="4.5" />
          <ellipse cx="109" cy="96" rx="30" ry="24" fill="#f7e9da" />
          <path
            d="M84 88h20a6 6 0 0 1-6 9h-8a6 6 0 0 1-6-9zM112 88h20a6 6 0 0 1-6 9h-8a6 6 0 0 1-6-9zM104 89h8"
            fill="#1b1b1b"
            stroke="#1b1b1b"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M88 90h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
          <path d="M100 108q8 5 16 0" fill="none" stroke="#390175" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="86" cy="104" r="4.5" fill="#ff7ab6" opacity=".7" />
          <circle cx="131" cy="104" r="4.5" fill="#ff7ab6" opacity=".7" />
        </g>
      </g>
    </svg>
  );
}

/** Visage de noix de coco (demi-noix) centré en (cx, cy), réutilisé par les illustrations. */
function CocoHalf({ cx, cy, mood }: { cx: number; cy: number; mood: 'happy' | 'joy' | 'sad' }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="42" ry="36" fill="#aa614b" stroke="#390175" strokeWidth="4.5" />
      <ellipse cx={cx + 3} cy={cy - 4} rx="32" ry="28" fill="#fff" stroke="#390175" strokeWidth="4" />
      <ellipse cx={cx + 4} cy={cy - 3} rx="25" ry="22" fill="#f7e9da" />
      {mood === 'happy' && (
        <>
          <ellipse cx={cx - 6} cy={cy - 9} rx="3.5" ry="4.5" fill="#390175" />
          <ellipse cx={cx + 14} cy={cy - 9} rx="3.5" ry="4.5" fill="#390175" />
          <path d={`M${cx - 6} ${cy + 3}q10 8 20 0`} fill="none" stroke="#390175" strokeWidth="3.2" strokeLinecap="round" />
        </>
      )}
      {mood === 'joy' && (
        <>
          <path d={`M${cx - 12} ${cy - 10}q5-6 10 0M${cx + 8} ${cy - 10}q5-6 10 0`} fill="none" stroke="#390175" strokeWidth="3.2" strokeLinecap="round" />
          <path d={`M${cx - 8} ${cy + 2}q11 10 22 0`} fill="#390175" />
        </>
      )}
      {mood === 'sad' && (
        <>
          <path d={`M${cx - 12} ${cy - 7}h10M${cx + 10} ${cy - 7}h10`} stroke="#390175" strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M${cx - 6} ${cy + 8}q10-6 20 0`} fill="none" stroke="#390175" strokeWidth="3.2" strokeLinecap="round" />
        </>
      )}
      {mood !== 'sad' && (
        <>
          <circle cx={cx - 14} cy={cy} r="3.5" fill="#ff7ab6" opacity=".7" />
          <circle cx={cx + 22} cy={cy} r="3.5" fill="#ff7ab6" opacity=".7" />
        </>
      )}
    </g>
  );
}

/** Email envoyé : la noix de coco lance un avion en papier, en boucle. */
export function PaperPlaneCoconut() {
  return (
    <svg className="mail-scene" viewBox="0 0 260 180" width="240" height="166" aria-hidden="true">
      <path className="plane-trail" d="M92 70 C 130 20, 190 10, 250 40" fill="none" stroke="#5b3cc4" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="70" cy="168" rx="50" ry="7" fill="#390175" opacity=".12" />
      <g className="plane-hop">
        <path className="plane-arm" d="M86 112 L96 76" stroke="#390175" strokeWidth="6" strokeLinecap="round" />
        <path d="M36 118 L22 140" stroke="#390175" strokeWidth="6" strokeLinecap="round" />
        <CocoHalf cx={66} cy={128} mood="happy" />
      </g>
      <g className="plane">
        <path d="M-16 -8 L16 0 L-16 9 L-8 0 Z" fill="#fff" stroke="#390175" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M-8 0 L16 0" stroke="#390175" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** C'est vérifié : la porte de la boîte aux lettres s'ouvre, la noix de coco sourit, le drapeau se lève. */
export function MailboxCoconut() {
  const id = useId();
  return (
    <svg className="mail-scene mailbox" viewBox="-15 0 290 190" width="240" height="157" aria-hidden="true">
      <ellipse cx="130" cy="182" rx="60" ry="6" fill="#390175" opacity=".12" />
      <rect x="119" y="128" width="22" height="54" rx="4" fill="#1b1b1b" />
      <path d="M62 132V78a68 68 0 0 1 136 0v54z" fill="#5b3cc4" stroke="#390175" strokeWidth="5" strokeLinejoin="round" />
      <path d="M76 128V80a54 54 0 0 1 108 0v48z" fill="#2a1260" />
      <clipPath id={id}>
        <path d="M76 128V80a54 54 0 0 1 108 0v48z" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <g className="mailbox__peek">
          <CocoHalf cx={128} cy={112} mood="joy" />
        </g>
      </g>
      <g className="mailbox__door">
        <path d="M76 128V80a54 54 0 0 1 108 0v48z" fill="#e8f04a" stroke="#390175" strokeWidth="4" strokeLinejoin="round" />
        <rect x="122" y="70" width="16" height="6" rx="3" fill="#390175" />
      </g>
      <g className="mailbox__flag">
        <rect x="203" y="66" width="6" height="52" rx="3" fill="#390175" />
        <path d="M206 66h24l-6 9 6 9h-24z" fill="#ff7ab6" stroke="#390175" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="mailbox__spark">
        <path d="M58 44l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#e8f04a" stroke="#390175" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="210" cy="40" r="5" fill="#ff7ab6" stroke="#390175" strokeWidth="2.2" />
        <circle cx="40" cy="86" r="3.5" fill="#5b3cc4" />
      </g>
    </svg>
  );
}

/** Lien expiré : noix de coco dépitée, avion écrasé. */
export function CrashedCoconut() {
  return (
    <svg className="mail-scene" viewBox="0 0 260 180" width="240" height="166" aria-hidden="true">
      <ellipse cx="130" cy="168" rx="50" ry="7" fill="#390175" opacity=".12" />
      <g className="crashed">
        <CocoHalf cx={127} cy={128} mood="sad" />
      </g>
      <path d="M170 60 l26 6 -24 8 6 -7z" fill="#fff" stroke="#390175" strokeWidth="2.5" strokeLinejoin="round" transform="rotate(35 180 66)" />
      <path d="M176 92q6 6 14 2" fill="none" stroke="#390175" strokeWidth="2" strokeDasharray="3 5" />
    </svg>
  );
}
