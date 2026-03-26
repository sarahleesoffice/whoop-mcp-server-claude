import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    status: 'ok',
    service: 'whoop-mcp-server-claude',
    endpoints: {
      mcp: '/api/mcp',
      oauthCallback: '/api/auth/callback',
    },
  });
}
