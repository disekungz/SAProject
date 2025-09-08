// simple auth helper
export type AuthUser = { MID: number; username: string; firstName: string; lastName: string; rankId: number };
const TOKEN_KEY = "access_token";
const USER_KEY = "auth_user";

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) as AuthUser : null; } catch { return null; }
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
