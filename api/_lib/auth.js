import { redis } from './redis.js';
import crypto from 'crypto';

/**
 * Genereer een coach secret token (32 hex chars).
 */
export function generateSecret() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Valideer coach secret voor write operaties.
 * Backward-compatibel: matches zonder coachSecret worden doorgelaten.
 * Returns: true als geautoriseerd, false als niet.
 */
export async function validateCoach(req, code) {
  const secret = req.headers['x-coach-secret'];

  const data = await redis.get(`match:${code.toUpperCase()}`);
  if (!data) return false;

  const match = typeof data === 'string' ? JSON.parse(data) : data;

  // Backward compat: oude matches zonder coachSecret doorlaten
  if (!match.coachSecret) return true;

  return secret === match.coachSecret;
}
