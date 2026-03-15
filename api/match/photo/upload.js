// Photo upload to Vercel Blob
// Docs: https://vercel.com/docs/storage/vercel-blob

import { put, del } from '@vercel/blob';
import { validateCoach } from '../../_lib/auth.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Max 10MB per foto
    },
  },
};

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    // Delete photo from Vercel Blob
    try {
      const { url, matchCode: deleteCode } = req.body;
      if (deleteCode) {
        const authorized = await validateCoach(req, deleteCode);
        if (!authorized) return res.status(403).json({ error: 'Unauthorized' });
      }
      if (!url) {
        return res.status(400).json({ error: 'URL required' });
      }

      const blobToken = process.env.BLOB2_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
      await del(url, { token: blobToken });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete photo error:', err);
      return res.status(500).json({ error: 'Failed to delete photo' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchCode, image, timestamp, caption } = req.body;

  // Validate coach auth
  const authorized = await validateCoach(req, matchCode);
  if (!authorized) return res.status(403).json({ error: 'Unauthorized' });

  if (!matchCode || !image) {
    return res.status(400).json({ error: 'Missing matchCode or image' });
  }

  // Validate matchCode format (4 characters)
  if (matchCode.length !== 4) {
    return res.status(400).json({ error: 'Invalid matchCode' });
  }

  // Validate base64 image
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format' });
  }

  try {
    // Convert base64 to buffer
    const base64Data = image.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const filename = `match-${matchCode.toLowerCase()}-${timestamp || Date.now()}.jpg`;

    // Check if token exists (BLOB2 for photos, fallback to BLOB)
    const blobToken = process.env.BLOB2_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      console.error('No blob token found (BLOB2_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN)');
      return res.status(500).json({ error: 'Blob storage not configured' });
    }

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      token: blobToken,
      addMetadata: {
        caption: caption || '',
      },
    });

    return res.status(200).json({
      url: blob.url,
      filename: blob.pathname,
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
