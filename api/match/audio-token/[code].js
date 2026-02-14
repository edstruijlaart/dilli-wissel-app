// LiveKit access token generation
// Docs: https://docs.livekit.io/realtime/guides/access-tokens/

import { AccessToken } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://dilli-wissel.livekit.cloud';

export default async function handler(req, res) {
  const { code } = req.query;
  const { identity, isCoach } = req.body || {};

  if (!code || code.length !== 4) {
    return res.status(400).json({ error: 'Invalid match code' });
  }

  if (!identity) {
    return res.status(400).json({ error: 'Identity required' });
  }

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(500).json({ error: 'LiveKit not configured' });
  }

  try {
    const roomName = `match-${code.toLowerCase()}`;

    // Create access token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: '6h', // Token expires after 6 hours
    });

    // Room permissions
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: isCoach, // Coach can speak, viewers listen only
      canSubscribe: true, // Everyone can listen
      canPublishData: false,
    });

    const jwt = await token.toJwt();

    return res.status(200).json({
      token: jwt,
      url: LIVEKIT_URL,
      roomName,
    });
  } catch (err) {
    console.error('LiveKit token generation error:', err);
    return res.status(500).json({ error: 'Failed to generate access token' });
  }
}
