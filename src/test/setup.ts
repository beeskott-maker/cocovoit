import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Les tests sans navigateur (« @vitest-environment node ») n'ont ni window ni localStorage.
const browser = typeof window !== 'undefined';

afterEach(() => {
  if (browser) {
    cleanup();
    localStorage.clear();
  }
  vi.restoreAllMocks();
});

// jsdom n'implémente pas le défilement : les pages qui remontent en haut ne font rien en test.
if (browser) window.scrollTo = () => undefined;
