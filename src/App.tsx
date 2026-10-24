import { HashRouter, Route, Routes } from 'react-router-dom';
import { ApiContext } from './lib/api';
import { AuthProvider } from './components/AuthProvider';
import { IS_DEV_ENV } from './lib/env';
import type { Api } from './lib/types';
import { CarFormPage } from './pages/CarFormPage';
import { HomePage } from './pages/HomePage';
import { IdentifyPage } from './pages/IdentifyPage';
import { InvitePage } from './pages/InvitePage';
import { JoinPage } from './pages/JoinPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TripPage } from './pages/TripPage';
import { TripsAdminPage } from './pages/TripsAdminPage';

export function AppRoutes() {
  return (
    <AuthProvider>
      <div className="app">
        {IS_DEV_ENV && (
          <p className="env-badge" title="Version de test : données de démo, stockées dans ce navigateur">
            DEV
          </p>
        )}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/identification" element={<IdentifyPage />} />
          <Route path="/j/:code" element={<JoinPage />} />
          <Route path="/t/:code" element={<TripPage />} />
          <Route path="/t/:code/inviter" element={<InvitePage />} />
          <Route path="/t/:code/voiture" element={<CarFormPage />} />
          <Route path="/t/:code/voiture/:carId" element={<CarFormPage />} />
          <Route path="/x/:key" element={<TripsAdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

// HashRouter : GitHub Pages ne sait pas réécrire les URLs vers index.html.
export function App({ api }: { api: Api }) {
  return (
    <ApiContext.Provider value={api}>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </HashRouter>
    </ApiContext.Provider>
  );
}
