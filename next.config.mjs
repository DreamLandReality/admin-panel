/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist v3 optionally requires 'canvas' for Node.js — stub it out for browser builds
    config.resolve.alias.canvas = false
    return config
  },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.pages.dev' },
    ],
  },
  async redirects() {
    return [
      { source: '/drafts', destination: '/', permanent: true },
    ]
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:" : "script-src 'self' 'unsafe-inline' blob: data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' blob: data: https://*.supabase.co https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.pages.dev",
      "font-src 'self' data: https://fonts.gstatic.com",
      isDev
        ? "frame-src https://*.pages.dev http://localhost:* http://127.0.0.1:*"
        : "frame-src https://*.pages.dev",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.elevenlabs.io wss://api.elevenlabs.io",
      "worker-src 'self' blob:",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
        ],
      },
    ]
  },
};

export default nextConfig;
