/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // CSP in report-only mode: logs violations without blocking.
    // Once verified in production, change the key to 'Content-Security-Policy'.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://*.supabase.co https://*.r2.cloudflarestorage.com https://*.pages.dev",
      "font-src 'self' data:",
      "frame-src https://*.pages.dev http://localhost:* http://127.0.0.1:*",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
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
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: csp,
          },
        ],
      },
    ]
  },
};

export default nextConfig;
