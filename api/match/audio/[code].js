import { put, list, del } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // We handle multipart/form-data manually
  },
};

export default async function handler(req, res) {
  const { code } = req.query;

  if (req.method === 'GET') {
    // List audio messages for this match
    try {
      const { blobs } = await list({
        prefix: `match/${code}/audio/`,
      });

      const audioMessages = blobs.map(blob => ({
        url: blob.url,
        uploadedAt: blob.uploadedAt,
        // Parse metadata from pathname: match/{code}/audio/{timestamp}-{half}.webm
        ...parseAudioMetadata(blob.pathname),
        // Add message from blob metadata (if exists)
        message: blob.metadata?.message || '',
      }));

      // Sort by timestamp (newest first)
      audioMessages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return res.status(200).json({ messages: audioMessages });
    } catch (err) {
      console.error('List audio error:', err);
      return res.status(500).json({ error: 'Failed to list audio' });
    }
  }

  if (req.method === 'POST') {
    // Upload audio message
    try {
      // Read raw body as buffer
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Get metadata from headers
      const matchTime = req.headers['x-match-time'] || '0';
      const half = req.headers['x-half'] || '1';
      const message = req.headers['x-message'] ? decodeURIComponent(req.headers['x-message']) : '';
      const contentType = req.headers['content-type'] || 'audio/webm';

      // Upload to Vercel Blob
      const filename = `match/${code}/audio/${Date.now()}-${matchTime.replace(':', '')}-H${half}.webm`;
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType,
        addMetadata: {
          matchTime,
          half,
          message,
        },
      });

      return res.status(201).json({
        url: blob.url,
        matchTime,
        half,
        message,
      });
    } catch (err) {
      console.error('Upload audio error:', err);
      return res.status(500).json({ error: 'Failed to upload audio' });
    }
  }

  if (req.method === 'DELETE') {
    // Delete audio message by URL
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL required' });
      }

      await del(url);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete audio error:', err);
      return res.status(500).json({ error: 'Failed to delete audio' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function parseAudioMetadata(pathname) {
  // pathname: match/{code}/audio/1234567890-1234-H1.webm
  const parts = pathname.split('/');
  const filename = parts[parts.length - 1];
  const match = filename.match(/(\d+)-(\d+)-H(\d+)\.webm/);

  if (!match) return {};

  const [, timestamp, timeStr, half] = match;
  const minutes = Math.floor(parseInt(timeStr) / 100);
  const seconds = parseInt(timeStr) % 100;

  return {
    matchTime: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    half: parseInt(half),
    timestamp: parseInt(timestamp),
  };
}
