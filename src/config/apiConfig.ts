const trimTrailingSlash = (value: string): string => value.trim().replace(/\/+$/, '');

function readViteEnv(): Record<string, string | undefined> {
  try {
    return ((import.meta as unknown as { env?: Record<string, string | undefined> })?.env) ?? {};
  } catch {
    return {};
  }
}

/**
 * Resolves the optional HTTP backend base URL (`VITE_API_BASE_URL`).
 * Defaults to "" so `/api/*` uses the Vercel rewrite proxy in production
 * and the local Vite/Express server during development.
 */
export function getApiBaseUrl(envOverride?: Record<string, string | undefined>): string {
  const env = envOverride ?? readViteEnv();
  return trimTrailingSlash(String(env.VITE_API_BASE_URL || ''));
}

/**
 * Resolves the WebSocket base URL (`VITE_WS_BASE_URL`) for Voice Tutor connections.
 * Because Vercel rewrites do not proxy WebSocket upgrades, set `VITE_WS_BASE_URL`
 * (e.g. `wss://your-render-backend.onrender.com`) when the frontend runs on Vercel.
 */
export function getWsBaseUrl(
  envOverride?: Record<string, string | undefined>,
  locationLike?: { protocol: string; host: string }
): string {
  const env = envOverride ?? readViteEnv();
  const explicitWs = trimTrailingSlash(String(env.VITE_WS_BASE_URL || ''));
  if (explicitWs) {
    if (/^https:\/\//i.test(explicitWs)) return explicitWs.replace(/^https:\/\//i, 'wss://');
    if (/^http:\/\//i.test(explicitWs)) return explicitWs.replace(/^http:\/\//i, 'ws://');
    return explicitWs;
  }

  const apiBase = getApiBaseUrl(env);
  if (apiBase) {
    if (/^https:\/\//i.test(apiBase)) return apiBase.replace(/^https:\/\//i, 'wss://');
    if (/^http:\/\//i.test(apiBase)) return apiBase.replace(/^http:\/\//i, 'ws://');
  }

  const loc =
    locationLike ??
    (typeof window !== 'undefined'
      ? { protocol: window.location.protocol, host: window.location.host }
      : { protocol: 'http:', host: 'localhost:3000' });
  const wsProtocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${loc.host}`;
}

export function apiUrl(path: string, envOverride?: Record<string, string | undefined>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl(envOverride);
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function wsUrl(
  path: string,
  envOverride?: Record<string, string | undefined>,
  locationLike?: { protocol: string; host: string }
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getWsBaseUrl(envOverride, locationLike);
  return `${base}${normalizedPath}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
