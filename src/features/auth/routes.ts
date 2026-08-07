/** Path constants for the auth feature (typed, single source for links/redirects). */
export const authRoutes = {
  login: '/login',
  /** Where a successful sign-in lands — the project picker. */
  projects: '/projects',
  account: '/account',
} as const;
