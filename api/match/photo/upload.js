// Photo upload to Vercel Blob
// Docs: https://vercel.com/docs/storage/vercel-blob

import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Max 10MB per foto
    },
  },
};

export default async function handler(req, res) {
  console.log('Photo upload request received');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchCode, image, timestamp } = req.body;
  console.log('Match code:', matchCode);
  console.log('Has image:', !!image);
  console.log('Image length:', image?.length);

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
    console.log('Buffer size:', Math.round(buffer.length / 1024), 'KB');

    // Generate unique filename
    const filename = `match-${matchCode.toLowerCase()}-${timestamp || Date.now()}.jpg`;
    console.log('Uploading to blob:', filename);

    // Check if token exists
    if (!process.env.BLOB2_READ_WRITE_TOKEN) {
      console.error('BLOB2_READ_WRITE_TOKEN not found');
      return res.status(500).json({ error: 'Blob storage not configured' });
    }

    // Upload to Vercel Blob (using BLOB2 prefix)
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
      token: process.env.BLOB2_READ_WRITE_TOKEN,
    });

    console.log('Upload success:', blob.url);

    return res.status(200).json({
      url: blob.url,
      filename: blob.pathname,
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    console.error('Error stack:', err.stack);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
