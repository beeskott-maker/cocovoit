import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { IdentityForm } from '../components/IdentityForm';
import { useAuth } from '../lib/auth';

/**
 * Connexion au compte (#/identification?suite=/…) : email, puis nom si le
 * compte n'existe pas encore. Ensuite, retour à la page demandée.
 */
export function IdentifyPage() {
  const navigate = useNavigate();
  const { auth, login } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('suite');
  // Uniquement une page de l'appli, jamais une adresse externe.
  const target = next?.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (auth.status === 'connected') return <Navigate to={target} replace />;

  return (
    <IdentityForm
      title="Qui êtes-vous ?"
      intro="Connectez-vous avec votre email. Si c'est votre première fois, on vous demandera votre nom."
      disabled={auth.status === 'loading'}
      onEmail={(email) => login(email)}
      onName={async (email, name) => {
        await login(email, name);
        navigate(target, { replace: true });
      }}
    />
  );
}
