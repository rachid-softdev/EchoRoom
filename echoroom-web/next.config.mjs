/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const cspHeader = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://app.posthog.com https://js.stripe.com`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' https: data: blob:`,
      `connect-src 'self' https://app.posthog.com https://api.stripe.com https://us.i.posthog.com wss://us.i.posthog.com`,
      `frame-src 'self' https://js.stripe.com https://hooks.stripe.com`,
      `media-src 'self' https: blob:`,
      `font-src 'self' data:`,
      `form-action 'self' https://hooks.stripe.com`,
      `base-uri 'self'`,
      `worker-src 'self' blob:`,
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
