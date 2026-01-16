import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mailsKeyConfigured = !!(process.env.MAILS_API_KEY || process.env.MAILS_SO_API_KEY);
  const mailsApiKey = process.env.MAILS_API_KEY || process.env.MAILS_SO_API_KEY || '';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Email Verification API',
    mails: {
      configured: mailsKeyConfigured,
      keyPreview: mailsKeyConfigured ? mailsApiKey.substring(0, 12) + '...' : 'Not configured'
    },
    endpoints: [
      'POST /api/verify-email - Verify single email',
      'GET /api/health - Health check',
      'GET /api/test - Test integration'
    ]
  });
}

