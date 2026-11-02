export const API_DIAGNOSTICS_KEY = 'chancery-api-diagnostics-v1';
export const API_DIAGNOSTICS_LIMIT = 40;
const ENDPOINTS = new Set(['/api/rpg/health', '/api/rpg/session/start', '/api/rpg/dialogue']);
const KINDS = new Set(['health_error', 'http_error', 'network_error', 'client_error', 'provider_fallback', 'provider_not_configured']);

export function readApiDiagnostics(storage) {
  try {
    const rows = JSON.parse(storage?.getItem(API_DIAGNOSTICS_KEY) ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => row && ENDPOINTS.has(row.endpoint) && KINDS.has(row.kind) && typeof row.at === 'string').slice(-API_DIAGNOSTICS_LIMIT).reverse();
  } catch { return []; }
}

export function appendApiDiagnostic(storage, { endpoint, kind, status = null, code = null, at = new Date().toISOString() } = {}) {
  if (!storage || !ENDPOINTS.has(endpoint) || !KINDS.has(kind)) return readApiDiagnostics(storage);
  const safeStatus = Number.isInteger(status) && status >= 0 && status <= 599 ? status : null;
  const safeCode = typeof code === 'string' && /^[a-z0-9_-]{1,48}$/i.test(code) ? code : 'unspecified';
  const rows = [...readApiDiagnostics(storage)].reverse();
  rows.push({ at, endpoint, kind, status: safeStatus, code: safeCode });
  const bounded = rows.slice(-API_DIAGNOSTICS_LIMIT);
  try { storage.setItem(API_DIAGNOSTICS_KEY, JSON.stringify(bounded)); } catch { return bounded.reverse(); }
  return bounded.reverse();
}

export function clearApiDiagnostics(storage) {
  try { storage?.removeItem(API_DIAGNOSTICS_KEY); } catch { /* storage may be unavailable */ }
  return [];
}
