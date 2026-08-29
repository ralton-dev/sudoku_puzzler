/**
 * jsdom setup for the `web-client` vitest project.
 *
 * Vitest runs without globals here, so Testing Library's automatic cleanup
 * never registers itself — without this file, one test's board is still in the
 * document when the next one queries for `board` and the failures read as
 * "found multiple elements".
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
