'use client';

/**
 * Client-side session storage — shared by buyers and sellers alike (the
 * `users` table isn't role-locked; the same JWT session works everywhere,
 * see site CLAUDE.md's "Data model essentials"). JWT-based per root
 * CLAUDE.md ("JWT-based auth (not cookies) — same token mechanism the app
 * uses") — stored in localStorage and sent as a Bearer header, exactly like
 * webohra-app (or any other external API client) would have to.
 */
const TOKEN_KEY = 'wb_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event('wb:auth-changed'));
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('wb:auth-changed'));
}

/** fetch wrapper that attaches the signed-in session token, if any. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
