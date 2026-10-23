import { useNavigate, useSearchParams } from 'react-router-dom';
import { IdentityForm } from '../components/IdentityForm';
import { saveIdentity } from '../lib/identity';

/**
 * Identification avant d'organiser un voyage (#/identification?suite=/).
 * L'identité est mémorisée dans ce navigateur, puis on revient à la page demandée.
 */
export function IdentifyPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('suite');
  // Uniquement une page de l'appli, jamais une adresse externe.
  const target = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

  return (
    <IdentityForm
      title="Qui êtes-vous ?"
      intro="Votre email et votre nom seront mémorisés sur cet appareil pour vos prochains voyages."
      onEmail={async () => 'needs_name'}
      onName={async (email, name) => {
        saveIdentity({ email, name });
        navigate(target, { replace: true });
      }}
    />
  );
}
