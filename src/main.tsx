import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createDefaultApi } from './lib/api';
import { listenForInstallPrompt } from './lib/install';
import { reloadOnNewVersion } from './lib/swUpdate';
import './styles/app.css';

listenForInstallPrompt();
reloadOnNewVersion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={createDefaultApi()} />
  </StrictMode>,
);
