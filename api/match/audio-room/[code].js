// Daily.co live audio room management
// Docs: https://docs.daily.co/reference/rest-api

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_DOMAIN = process.env.DAILY_DOMAIN || 'dilli-wissel'; // your-domain.daily.co

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code || code.length !== 4) {
    return res.status(400).json({ error: 'Invalid match code' });
  }

  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: 'Daily.co not configured' });
  }

  // POST: Create/start room (coach)
  if (req.method === 'POST') {
    try {
      const roomName = `match-${code.toLowerCase()}`;

      // Check if room already exists
      let room;
      try {
        const checkRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });
        if (checkRes.ok) {
          room = await checkRes.json();
        }
      } catch (err) {
        // Room doesn't exist, create new one
      }

      // Create room if it doesn't exist
      if (!room) {
        const createRes = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: roomName,
            privacy: 'public', // Anyone with link can join
            properties: {
              enable_chat: false,
              enable_screenshare: false,
              enable_recording: false,
              start_video_off: true, // Audio-only
              start_audio_off: false,
              max_participants: 50, // Coach + viewers
              exp: Math.floor(Date.now() / 1000) + 86400, // Expire after 24h
            },
          }),
        });

        if (!createRes.ok) {
          const error = await createRes.text();
          console.error('Daily.co create error:', error);
          return res.status(500).json({ error: 'Failed to create audio room' });
        }

        room = await createRes.json();
      }

      // Generate meeting token for coach (owner, can speak)
      const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            is_owner: true,
            enable_recording: false,
          },
        }),
      });

      if (!tokenRes.ok) {
        const error = await tokenRes.text();
        console.error('Daily.co token error:', error);
        return res.status(500).json({ error: 'Failed to generate token' });
      }

      const tokenData = await tokenRes.json();

      return res.status(200).json({
        url: room.url,
        token: tokenData.token,
        roomName,
      });
    } catch (err) {
      console.error('Audio room creation error:', err);
      return res.status(500).json({ error: 'Failed to start live audio' });
    }
  }

  // GET: Join room (viewer)
  if (req.method === 'GET') {
    try {
      const roomName = `match-${code.toLowerCase()}`;

      // Check if room exists
      const checkRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });

      if (!checkRes.ok) {
        return res.status(404).json({ error: 'No live audio available' });
      }

      const room = await checkRes.json();

      // Generate meeting token for viewer (listener only)
      const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            is_owner: false,
            enable_recording: false,
            start_audio_off: true, // Viewers listen only
          },
        }),
      });

      if (!tokenRes.ok) {
        const error = await tokenRes.text();
        console.error('Daily.co viewer token error:', error);
        return res.status(500).json({ error: 'Failed to join audio' });
      }

      const tokenData = await tokenRes.json();

      return res.status(200).json({
        url: room.url,
        token: tokenData.token,
        roomName,
      });
    } catch (err) {
      console.error('Audio room join error:', err);
      return res.status(500).json({ error: 'Failed to join live audio' });
    }
  }

  // DELETE: End room (coach stops)
  if (req.method === 'DELETE') {
    try {
      const roomName = `match-${code.toLowerCase()}`;

      const deleteRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });

      if (!deleteRes.ok && deleteRes.status !== 404) {
        const error = await deleteRes.text();
        console.error('Daily.co delete error:', error);
        return res.status(500).json({ error: 'Failed to end audio room' });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Audio room delete error:', err);
      return res.status(500).json({ error: 'Failed to end live audio' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
