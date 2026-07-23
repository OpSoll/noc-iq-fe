/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose only explicitly whitelisted env variables to the browser bundle.
  // Server-side variables (no NEXT_PUBLIC_ prefix) are never sent to the client.
  env: {
    // Intentionally empty — use NEXT_PUBLIC_* prefix for client-side vars.
  },

  // Security headers applied to every response.
  // ref: https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent the page from being embedded in iframes (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS for 1 year (only meaningful when deployed over TLS)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Control referrer information sent with requests
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
