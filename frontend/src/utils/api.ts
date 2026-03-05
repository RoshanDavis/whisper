const API_URL = import.meta.env.VITE_API_URL || '';
export default API_URL;

/**
 * Authenticated fetch wrapper.
 * Automatically redirects to /login and clears local state on 401/403
 * (expired cookie, revoked session, etc.).
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'include', ...init });

  if (res.status === 401 || res.status === 403) {
    // Clear cross-tab sync flag so other tabs also reset
    localStorage.setItem('auth_sync', Date.now().toString());
    window.location.href = '/login';
    // Return the response so callers don't throw before the redirect fires
    return res;
  }

  return res;
}
