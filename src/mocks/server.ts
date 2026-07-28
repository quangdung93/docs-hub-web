import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * Node request-interception for Jest (Module 8). Started/stopped in the test setup
 * file so unit tests exercise the same handlers as dev and e2e.
 */
export const server = setupServer(...handlers);
