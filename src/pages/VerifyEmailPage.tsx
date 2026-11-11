import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loading } from '../components/Delight';
import { IdentityForm } from '../components/IdentityForm';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { EmailVerification } from '../lib/types';

const safeNext = (next: string | null | undefined) =>
  next?.startsWith('/') && !next.startsWith('//') ? next : '/voyages';

/**
 * Lien de l'email de vérification (#/verifier/<jeton>) : l'adresse est confirmée,
 * puis on demande le nom et le téléphone (ou on connecte directement si le
 * compte existe déjà) et on reprend là où on en était.
 */
export function VerifyEmailPage() {
  const { token = '' } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const { auth, login } = useAuth();
  const [result, setResult] = useState<EmailVerification | null>(null);
  const [askName, setAskName] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || auth.status === 'loading') return;
    started.current = true;
    (async () => {
      const v = await api.verifyEmail(token).catch((): EmailVerification => ({ status: 'invalid' }));
      setResult(v);
      if (v.status !== 'verified') return;
      if (auth.status === 'connected' && auth.account.email.toLowerCase() === v.email.toLowerCase()) {
        navigate(safeNext(v.next), { replace: true });
        return;
      }
      // Compte déjà créé (ex. depuis l'écran d'attente) : connexion directe.
      const res = await login(v.email, undefined, undefined, v.request);
      if (res === 'done') navigate(safeNext(v.next), { replace: true });
      else setAskName(true);
    })();
  }, [api, auth, login, navigate, token]);

  if (!result || (result.status === 'verified' && !askName)) return <Loading label="Vérification de votre adresse…" />;

  if (result.status === 'verified') {
    return (
      <IdentityForm
        title="Bienvenue !"
        start={{ step: { kind: 'name', request: result.request }, email: result.email }}
        onEmail={(email) => login(email, undefined, undefined, null, result.next)}
        onName={async (email, name, phone, request) => {
          await login(email, name, phone, request);
          navigate(safeNext(result.next), { replace: true });
        }}
      />
    );
  }

  const email = result.status === 'expired' ? result.email : '';
  const next = result.status === 'expired' ? result.next : null;
  return (
    <IdentityForm
      title="Qui êtes-vous ?"
      start={{ step: { kind: 'expired' }, email }}
      onEmail={(e) => login(e, undefined, undefined, null, next)}
      onName={async (e, name, phone, request) => {
        await login(e, name, phone, request);
        navigate(safeNext(next), { replace: true });
      }}
    />
  );
}
