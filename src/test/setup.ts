import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Les tests sans navigateur (« @vitest-environment node ») n'ont ni window ni localStorage.
const browser = typeof window !== 'undefined';

// Date du jour fixe (1er octobre 2026) : les voyages des tests, en octobre 2026,
// restent à venir quel que soit le jour où l'on lance les tests.
beforeEach(() => {
  if (!browser) return;
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 1, 10, 0));
});

afterEach(() => {
  if (browser) {
    vi.useRealTimers();
    cleanup();
    localStorage.clear();
  }
  vi.restoreAllMocks();
});

// jsdom n'implémente pas le défilement : les pages qui remontent en haut ne font rien en test.
if (browser) window.scrollTo = () => undefined;
