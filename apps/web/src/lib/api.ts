const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string | string[];
  statusCode?: number;
  error?: string;
};

let accessToken: string | null = localStorage.getItem('dms_access_token');
let refreshToken: string | null = localStorage.getItem('dms_refresh_token');
let refreshPromise: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('dms_access_token', access);
  localStorage.setItem('dms_refresh_token', refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('dms_access_token');
  localStorage.removeItem('dms_refresh_token');
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) {
    return false;
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const json = (await res.json()) as ApiEnvelope<{
          tokens: { accessToken: string; refreshToken: string };
        }>;
        if (!res.ok || !json.data?.tokens) {
          clearTokens();
          return false;
        }
        setTokens(json.data.tokens.accessToken, json.data.tokens.refreshToken);
        return true;
      } catch {
        clearTokens();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function api<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed && accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || json.success === false) {
    const msg = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message || json.error || 'Request failed';
    throw new Error(msg);
  }

  return json.data as T;
}
