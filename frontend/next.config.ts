import type { NextConfig } from "next";

const stripSlash = (value: string) => value.replace(/\/$/, "");

const extraOrigins = (process.env.NEXT_PUBLIC_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const apiBackend = stripSlash(process.env.API_BACKEND_URL || "http://127.0.0.1:5005");
const supabaseInternal = stripSlash(
  process.env.SUPABASE_INTERNAL_URL || "http://183.82.117.36:8800"
);
const keycloakInternal = stripSlash(
  process.env.KEYCLOAK_INTERNAL_URL || "http://183.82.117.36:33003"
);

const nextConfig: NextConfig = {
  // Allow opening `next dev` from office LAN IPs and the public VPS host.
  allowedDevOrigins: Array.from(
    new Set([
      "173.249.6.61",
      "newhrms.brihaspathi.in",
      "172.21.2.137",
      "172.21.4.18",
      "183.82.117.36",
      ...extraOrigins,
    ])
  ),
  async rewrites() {
    // Same-origin paths so office LAN (no nginx) and VPS HTTPS (nginx) both work.
    // When nginx already proxies these paths, it wins; these are the LAN / :3005 fallback.
    return [
      { source: "/api/:path*", destination: `${apiBackend}/api/:path*` },
      { source: "/supabase/:path*", destination: `${supabaseInternal}/:path*` },
      { source: "/keycloak/:path*", destination: `${keycloakInternal}/:path*` },
    ];
  },
};

export default nextConfig;
