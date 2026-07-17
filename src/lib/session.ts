export interface AuthUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: string[];
  role: string;
}

export interface SessionShape {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

const SESSION_KEY = "schore.api.session.v2";

export function getStoredSession(): SessionShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SessionShape;
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!session.token || !session.user) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: SessionShape | null) {
  if (typeof window === "undefined") return;
  if (!session) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearLegacySessionKeys() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("schore.api.session.v1");
  } catch {
    /* ignore */
  }
}
