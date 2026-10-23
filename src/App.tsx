import { HashRouter, Route, Routes } from 'react-router-dom';
import { ApiContext } from './lib/api';
import type { Api } from './lib/types';
import { CarFormPage } from './pages/CarFormPage';
import { HomePage } from './pages/HomePage';
import { InvitePage } from './pages/InvitePage';
import { JoinPage } from './pages/JoinPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TripPage } from './pages/TripPage';

export function AppRoutes() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/j/:code" element={<JoinPage />} />
        <Route path="/t/:code" element={<TripPage />} />
        <Route path="/t/:code/inviter" element={<InvitePage />} />
        <Route path="/t/:code/voiture" element={<CarFormPage />} />
        <Route path="/t/:code/voiture/:carId" element={<CarFormPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
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
