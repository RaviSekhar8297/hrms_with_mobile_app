const stripSlash = (value: string) => value.replace(/\/$/, "");

/**
 * Browser API origin.
 * Empty string = same-origin `/api` (Next.js rewrite on office LAN, nginx on VPS).
 * Set NEXT_PUBLIC_API_URL only when the browser must call the backend directly.
 */
function resolveApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return stripSlash(fromEnv);
  return "";
}

export const API_BASE = resolveApiBase();

/**
 * Browser-facing Supabase Kong URL.
 * Empty NEXT_PUBLIC_SUPABASE_URL uses same-origin `/supabase`
 * (rewritten to office LAN Kong, or nginx on the VPS).
 */
export function getSupabaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return stripSlash(fromEnv);
  if (typeof window !== "undefined") return `${window.location.origin}/supabase`;
  return "/supabase";
}

export const getHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return { "Content-Type": "application/json" };
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const getUrl = (path: string, companyId?: string | null) => {
  if (companyId) {
    return `${API_BASE}${path}${path.includes("?") ? "&" : "?"}companyId=${companyId}`;
  }
  return `${API_BASE}${path}`;
};
