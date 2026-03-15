/**
 * Haal het coach secret op voor een match code.
 * Returns het secret of null als niet beschikbaar.
 */
export function getCoachSecret(matchCode) {
  if (!matchCode) return null;
  try {
    return localStorage.getItem(`dilli_secret_${matchCode.toUpperCase()}`) || null;
  } catch {
    return null;
  }
}

/**
 * Maak headers met optioneel coach secret.
 */
export function authHeaders(matchCode, extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const secret = getCoachSecret(matchCode);
  if (secret) headers['X-Coach-Secret'] = secret;
  return headers;
}
