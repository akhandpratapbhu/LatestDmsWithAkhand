/** Resolve API-hosted media paths like `/uploads/avatars/...` for the browser. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;

  const apiBase = import.meta.env.VITE_API_URL ?? '/api/v1';
  // Prefer same-origin `/uploads` (Vite proxy) when API is relative.
  if (apiBase.startsWith('/')) {
    return url.startsWith('/') ? url : `/${url}`;
  }

  try {
    const origin = new URL(apiBase).origin;
    return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
  } catch {
    return `http://localhost:3000${url.startsWith('/') ? url : `/${url}`}`;
  }
}
