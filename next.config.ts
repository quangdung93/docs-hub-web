import type { NextConfig } from 'next';

/**
 * Content-Security-Policy and hardening headers.
 *
 * `'unsafe-inline'` on style-src is required by Tailwind/next-themes runtime
 * style injection; script-src stays strict. `connect-src 'self'` keeps all
 * client traffic same-origin — the BFF proxy (`/api/*`) is the only egress the
 * browser sees, which is the whole point of the BFF auth model (see core/auth).
 * Tighten per-environment via env if you add third-party origins (Sentry, GA).
 */
const isDev = process.env.NODE_ENV !== 'production';

const cspDirectives = [
  "default-src 'self'",
  // Next injects a nonce for its own scripts in prod; dev needs eval for HMR.
  `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline'`,
  "style-src 'self' 'unsafe-inline'",
  // Project avatars are served from object storage as presigned links, so the
  // storage host has to be allowed here. `connect-src` deliberately stays
  // `'self'` — a rendered image is a far smaller surface than a fetch target.
  "img-src 'self' data: blob: https://storage.docshub.io.vn",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/**
 * Mount point when the app is served under a sub-path of a shared domain
 * (e.g. `https://mobix.asia/docshub_su5`). Next rewrites its own asset URLs,
 * router links and route handlers to sit under this prefix, so nginx can proxy
 * the location straight through without stripping it. Empty = served at root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for small Docker images (Module 8).
  output: 'standalone',
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep heavy client libs out of the initial bundle where possible.
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
