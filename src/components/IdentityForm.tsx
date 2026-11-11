import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mail from '../assets/figma/mail.svg';
import person from '../assets/figma/person.svg';
import phoneIcon from '../assets/figma/phone.svg';
import { useApi } from '../lib/api';
import type { LoginOutcome } from '../lib/auth';
import { isEmail } from '../lib/format';
import { parsePhone } from '../lib/phone';
import { AUTH_TITLE, useDocumentTitle } from '../lib/useDocumentTitle';
import { BrandHeader } from './BrandHeader';
import { CrashedCoconut, MailboxCoconut, PaperPlaneCoconut } from './Delight';
import { TextField } from './TextField';

/** Délai avant de pouvoir renvoyer l'email (s), et fréquence de suivi du clic (ms). */
const RESEND_DELAY = 60;
const POLL_EVERY = 3000;

type Step =
  | { kind: 'email' }
  /** Lien envoyé : on attend le clic. */
  | { kind: 'sent'; request: string }
  /** Clic fait sur un autre appareil (ou un autre onglet). */
  | { kind: 'verified'; request: string }
  | { kind: 'expired' }
  /** Nom et téléphone ; `request` : adresse vérifiée par le lien. */
  | { kind: 'name'; request?: string };

interface Props {
  title: ReactNode;
  intro?: string;
  /** Formulaire inactif (ex. voyage en cours de chargement). */
  disabled?: boolean;
  /** Reprise à une étape donnée (page du lien de vérification). */
  start?: { step: Step; email: string };
  /** Après l'email : connecté, nom à demander, ou lien de vérification envoyé. */
  onEmail: (email: string) => Promise<LoginOutcome>;
  onName: (email: string, name: string, phone: string | null, request?: string) => Promise<void>;
}

/**
 * Identification : email, puis (adresse inconnue) vérification par un lien
 * envoyé par email, puis nom et téléphone facultatif.
 */
export function IdentityForm({ title, intro, disabled, start, onEmail, onName }: Props) {
  useDocumentTitle(AUTH_TITLE);
  const [step, setStep] = useState<Step>(start?.step ?? { kind: 'email' });
  const [email, setEmail] = useState(start?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendEmail() {
    setBusy(true);
    setError(null);
    try {
      const res = await onEmail(email.trim());
      if (res === 'needs_name') setStep({ kind: 'name' });
      else if (typeof res === 'object') setStep({ kind: 'sent', request: res.request });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setBusy(false);
    }
  }

  const back = () => {
    setError(null);
    setStep({ kind: 'email' });
  };

  switch (step.kind) {
    case 'sent':
      return (
        <EmailSent
          email={email.trim()}
          request={step.request}
          busy={busy}
          error={error}
          onResend={sendEmail}
          onBack={back}
          onVerified={() => setStep({ kind: 'verified', request: step.request })}
          onExpired={() => setStep({ kind: 'expired' })}
        />
      );
    case 'verified':
      return (
        <Screen>
          <MailboxCoconut />
          <h1 className="verify__title">C'est vérifié !</h1>
          <p className="verify__text">Votre adresse est confirmée. Il ne reste qu'à vous présenter.</p>
          <div className="verify__actions">
            <button type="button" className="btn btn--primary" onClick={() => setStep({ kind: 'name', request: step.request })} autoFocus>
              Continuer
            </button>
          </div>
        </Screen>
      );
    case 'expired':
      return (
        <Screen>
          <CrashedCoconut />
          <h1 className="verify__title">{email ? 'Ce lien a expiré' : "Ce lien n'est pas valide"}</h1>
          <p className="verify__text">
            {email
              ? 'Les liens de confirmation sont valables 24 h. On vous en envoie un nouveau ?'
              : 'Le lien est peut-être incomplet. Reconnectez-vous pour en recevoir un nouveau.'}
          </p>
          {error && (
            <p className="field-hint field-hint--error" role="alert">
              {error}
            </p>
          )}
          <div className="verify__actions">
            {email ? (
              <button type="button" className="btn btn--primary" onClick={() => void sendEmail()} disabled={busy}>
                Recevoir un nouveau lien
              </button>
            ) : (
              <Link className="btn btn--primary" to="/identification">
                Se connecter
              </Link>
            )}
            <Link className="btn btn--text" to="/">
              Retour à l'accueil
            </Link>
          </div>
        </Screen>
      );
    default:
      return (
        <EmailAndName
          title={step.kind === 'name' && step.request ? 'Bienvenue !' : title}
          intro={step.kind === 'name' && step.request ? undefined : intro}
          verified={step.kind === 'name' && !!step.request}
          disabled={disabled}
          email={email}
          setEmail={setEmail}
          askName={step.kind === 'name'}
          busy={busy}
          error={error}
          onSubmitEmail={sendEmail}
          onSubmitName={async (name, phone) => {
            setBusy(true);
            setError(null);
            try {
              await onName(email.trim(), name, phone, step.kind === 'name' ? step.request : undefined);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            } finally {
              setBusy(false);
            }
          }}
          onBack={back}
        />
      );
  }
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <>
      <BrandHeader />
      <main className="verify">{children}</main>
    </>
  );
}

/** Lien envoyé : avion en papier, suivi du clic, renvoi après une minute. */
function EmailSent({
  email,
  request,
  busy,
  error,
  onResend,
  onBack,
  onVerified,
  onExpired,
}: {
  email: string;
  request: string;
  busy: boolean;
  error: string | null;
  onResend: () => Promise<void>;
  onBack: () => void;
  onVerified: () => void;
  onExpired: () => void;
}) {
  const api = useApi();
  const navigate = useNavigate();
  const [wait, setWait] = useState(RESEND_DELAY);
  const [demoToken, setDemoToken] = useState<string | null>(null);

  // Compte à rebours avant « Renvoyer l'email », relancé à chaque nouvelle demande.
  useEffect(() => {
    setWait(RESEND_DELAY);
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, [request]);

  // Le clic peut se faire ailleurs (téléphone, autre onglet) : on suit l'état de la demande.
  // Rappels gardés dans une ref : le compte à rebours redessine l'écran chaque seconde.
  const done = useRef({ onVerified, onExpired });
  done.current = { onVerified, onExpired };
  useEffect(() => {
    let alive = true;
    const t = setInterval(() => {
      api.emailVerificationStatus(request).then(
        (s) => {
          if (!alive) return;
          if (s === 'verified') done.current.onVerified();
          else if (s === 'expired') done.current.onExpired();
        },
        () => undefined,
      );
    }, POLL_EVERY);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [api, request]);

  // Mode démo : aucun email ne part, on propose d'ouvrir le lien directement.
  useEffect(() => {
    let alive = true;
    api.demoVerificationToken?.(request).then((t) => alive && setDemoToken(t));
    return () => {
      alive = false;
    };
  }, [api, request]);

  return (
    <Screen>
      <PaperPlaneCoconut />
      <h1 className="verify__title">Vérifiez vos emails</h1>
      <p className="verify__text">
        On vient d'envoyer un lien à <strong>{email}</strong>. Cliquez dessus pour continuer : il est valable 24 h.
      </p>
      <p className="verify__small">Rien reçu ? Regardez dans les spams.</p>
      <p className="verify__live" role="status">
        En attente de votre clic…
      </p>
      {error && (
        <p className="field-hint field-hint--error" role="alert">
          {error}
        </p>
      )}
      <div className="verify__actions">
        {demoToken && (
          <button type="button" className="btn btn--primary" onClick={() => navigate(`/verifier/${demoToken}`)}>
            Ouvrir le lien (démo)
          </button>
        )}
        <button type="button" className="btn btn--tertiary" onClick={() => void onResend()} disabled={busy || wait > 0}>
          {wait > 0 ? `Renvoyer l'email (dans ${wait} s)` : "Renvoyer l'email"}
        </button>
        <button type="button" className="btn btn--text" onClick={onBack}>
          Ce n'est pas mon email
        </button>
      </div>
    </Screen>
  );
}

/** Email, puis nom et téléphone (facultatif). */
function EmailAndName({
  title,
  intro,
  verified,
  disabled,
  email,
  setEmail,
  askName,
  busy,
  error,
  onSubmitEmail,
  onSubmitName,
  onBack,
}: {
  title: ReactNode;
  intro?: string;
  verified: boolean;
  disabled?: boolean;
  email: string;
  setEmail: (email: string) => void;
  askName: boolean;
  busy: boolean;
  error: string | null;
  onSubmitEmail: () => Promise<void>;
  onSubmitName: (name: string, phone: string | null) => Promise<void>;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const canSubmit = !disabled && (askName ? name.trim().length > 0 : isEmail(email));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    if (!askName) return onSubmitEmail();
    const parsed = parsePhone(phone);
    if (parsed === undefined) {
      setPhoneError('Numéro invalide : par exemple 06 12 34 56 78');
      return;
    }
    await onSubmitName(name.trim(), parsed);
  }

  return (
    <>
      <BrandHeader />
      <div className="page-title">
        <h1 className="display-small">{title}</h1>
        {intro && <p className="body-medium">{intro}</p>}
        {verified && <span className="verified-chip">✓ Email vérifié</span>}
      </div>
      <form className="form" onSubmit={submit} noValidate>
        <TextField
          label="Mon email"
          icon={mail}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={askName || disabled}
          autoFocus={!askName}
        />
        {askName && (
          <TextField
            label="Mon nom"
            icon={person}
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Le prénom que les autres verront dans les voitures"
            maxLength={80}
            autoFocus
          />
        )}
        {askName && (
          <TextField
            label="Mon téléphone (facultatif)"
            icon={phoneIcon}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError(null);
            }}
            error={phoneError}
            hint="Pour vous joindre le jour du départ : visible par votre chauffeur si vous êtes passager, par le voyage si vous conduisez."
          />
        )}
        {error && (
          <p className="field-hint field-hint--error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={!canSubmit || busy}>
          {verified ? "C'est parti" : 'Suivant'}
        </button>
        {askName && !verified && (
          <button type="button" className="btn btn--text" onClick={onBack}>
            Ce n'est pas mon email
          </button>
        )}
      </form>
    </>
  );
}
