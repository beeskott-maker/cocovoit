import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// jsdom n'implémente pas le défilement : les pages qui remontent en haut ne font rien en test.
window.scrollTo = () => undefined;
