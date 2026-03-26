import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

function getWhoopEnv(primaryName: string, fallbackName: string, defaultValue = '') {
  return process.env[primaryName] ?? process.env[fallbackName] ?? defaultValue;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const clientId = getWhoopEnv('WHOOPCLIENTID', 'WHOOP_CLIENT_ID', 'b692ecf2-0cb9-48ed-a71b-0fb3d8c6a1e8');
  const clientSecret = getWhoopEnv('WHOOPCLIENTSECRET', 'WHOOP_CLIENT_SECRET');
  const redirectUri = getWhoopEnv(
    'WHOOPREDIRECTURI',
    'WHOOP_REDIRECT_URI',
    'https://whoop-mcp-server-claude-x49e.vercel.app/api/auth/callback',
  );

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const error = typeof req.query.error === 'string' ? req.query.error : undefined;
  const errorDescription = typeof req.query.error_description === 'string' ? req.query.error_description : undefined;

  if (error) {
    return res.status(400).send(`
      <html>
        <head><title>WHOOP OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 24px;">
          <h1>WHOOP authorization failed</h1>
          <p><strong>Error:</strong> ${escapeHtml(error)}</p>
          <p><strong>Description:</strong> ${escapeHtml(errorDescription ?? 'No description provided')}</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <html>
        <head><title>WHOOP OAuth Callback</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 24px;">
          <h1>Missing authorization code</h1>
          <p>The WHOOP callback did not include a code parameter.</p>
        </body>
      </html>
    `);
  }

  if (!clientSecret) {
    return res.status(500).send(`
      <html>
        <head><title>WHOOP OAuth Callback</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 24px;">
          <h1>Configuration missing</h1>
          <p>WHOOPCLIENTSECRET is not set in the Vercel environment.</p>
        </body>
      </html>
    `);
  }

  try {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const response = await axios.post('https://api.prod.whoop.com/oauth/oauth2/token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const accessToken = String(response.data?.access_token ?? '');
    const refreshToken = String(response.data?.refresh_token ?? '');
    const expiresIn = Number(response.data?.expires_in ?? 0);

    if (!accessToken) {
      return res.status(502).send(`
        <html>
          <head><title>WHOOP OAuth Callback</title></head>
          <body style="font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 24px;">
            <h1>No access token returned</h1>
            <p>WHOOP did not return an access token.</p>
          </body>
        </html>
      `);
    }

    process.env.WHOOP_ACCESS_TOKEN = accessToken;
    if (refreshToken) {
      process.env.WHOOP_REFRESH_TOKEN = refreshToken;
    }

    const cookieParts = [
      `whoop_access_token=${encodeURIComponent(accessToken)}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      `Max-Age=${Math.max(expiresIn || 0, 60 * 60 * 24 * 30)}`,
    ];
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    return res.status(200).send(`
      <html>
        <head>
          <title>WHOOP Connected</title>
          <meta http-equiv="refresh" content="3; url=/mcp" />
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 24px;">
          <h1>WHOOP authorization complete</h1>
          <p>The access token has been stored for this session.</p>
          <p>You can close this window and return to Claude.</p>
          <p>If your client follows the cookie from this browser session, the MCP server can reuse the token.</p>
        </body>
      </html>
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).send(`
      <html>
        <head><title>WHOOP OAuth Callback</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 24px;">
          <h1>Token exchange failed</h1>
          <p>${escapeHtml(message)}</p>
        </body>
      </html>
    `);
  }
}
