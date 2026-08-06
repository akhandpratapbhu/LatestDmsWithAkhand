const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string | string[];
  statusCode?: number;
  error?: string;
};

const ACCESS_TOKEN_KEY = 'configure_access_token';
const REFRESH_TOKEN_KEY = 'configure_refresh_token';
const ORGANIZATION_ID_KEY = 'configure_organization_id';

/** Migrate legacy DMS localStorage keys once, then drop them. */
function readMigrated(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key);
  if (current) return current;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy) {
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  }
  return null;
}

let accessToken: string | null = readMigrated(ACCESS_TOKEN_KEY, 'dms_access_token');
let refreshToken: string | null = readMigrated(REFRESH_TOKEN_KEY, 'dms_refresh_token');
let organizationId: string | null = readMigrated(ORGANIZATION_ID_KEY, 'dms_organization_id');
let refreshPromise: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getOrganizationId(): string | null {
  return organizationId;
}

export function setOrganizationId(id: string | null): void {
  organizationId = id;
  if (id) {
    localStorage.setItem(ORGANIZATION_ID_KEY, id);
  } else {
    localStorage.removeItem(ORGANIZATION_ID_KEY);
  }
  localStorage.removeItem('dms_organization_id');
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  localStorage.removeItem('dms_access_token');
  localStorage.removeItem('dms_refresh_token');
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  organizationId = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ORGANIZATION_ID_KEY);
  localStorage.removeItem('dms_access_token');
  localStorage.removeItem('dms_refresh_token');
  localStorage.removeItem('dms_organization_id');
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

export async function api<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
  withOrg = false,
  organizationIdOverride?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (withOrg) {
    const orgId = organizationIdOverride || organizationId;
    if (orgId) {
      headers.set('X-Organization-Id', orgId);
    }
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

export type OrgApiOptions = RequestInit & {
  /** Override X-Organization-Id for this request (e.g. Menu Builder project picker). */
  organizationId?: string;
};

export function orgApi<T>(path: string, options: OrgApiOptions = {}): Promise<T> {
  const { organizationId: orgOverride, ...fetchOpts } = options;
  return api<T>(path, fetchOpts, true, true, orgOverride);
}
