/** Keys for post-login session (sessionStorage). */

export const SESSION_TOKEN = "access_token";
export const SESSION_EMAIL = "user_email";
export const SESSION_MATCH_SCORE = "last_match_score";
export const SESSION_THRESHOLD = "last_threshold";

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_TOKEN);
  sessionStorage.removeItem(SESSION_EMAIL);
  sessionStorage.removeItem(SESSION_MATCH_SCORE);
  sessionStorage.removeItem(SESSION_THRESHOLD);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN);
}
