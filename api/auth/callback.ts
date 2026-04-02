import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { persistWhoopTokens } from '../lib/whoop-tokens.js';

const WHOOP_TOKEN_REDIRECT_URI = 'https://whoop-mcp-server-claude-x49e.vercel.app/api/auth/callback';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function findStringFieldDeep(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const current = record[key];
    if (typeof current === 'string' && current.trim().length > 0) {
      return current;
    }
  }

  for (const nested of Object.values(record)) {
    const found = findStringFieldDeep(nested, keys);
    if (found) {
      return found;
    }
  }

  return null;
}

function findNumberFieldDeep(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const current = record[key];
    if (typeof current === 'number' && Number.isFinite(current)) {
      return current;
    }
  }

  for (const nested of Object.values(record)) {
    const found = findNumberFieldDeep(nested, keys);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

function htmlPage(title: string, body: string) {
  return '<!doctype html>' +
    '<html><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    '<title>' + escapeHtml(title) + '</title>' +
    '<style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 16px;line-height:1.5}.card{background:#f7f7f7;border:1px solid #e5e5e5;border-radius:12px;padding:24px}.error{color:#8b0000}.success{color:#0f5132}pre{white-space:pre-wrap;word-break:break-word;background:#fff;padding:16px;border-radius:8px;border:1px solid #ddd}code{background:#fff;padding:2px 6px;border-radius:4px}</style>' +
    '</head><body><div class="card">' + body + '</div></body></html>';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.WHOOPCLIENTID;
  const clientSecret = process.env.WHOOPCLIENTSECRET;

  const error = firstQueryValue(req.query.error);
  const errorDescription = firstQueryValue(req.query.error_description);
  const code = firstQueryValue(req.query.code);
  const state = firstQueryValue(req.query.state);

  if (error) {
    return res
      .status(400)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .send(htmlPage('WHOOP OAuth error', '<h1 class="error">WHOOP OAuth error</h1><p><strong>Error:</strong> ' + escapeHtml(error) + '</p><p><strong>Description:</strong> ' + escapeHtml(errorDescription ?? 'No description provided') + '</p><p><strong>State:</strong> ' + escapeHtml(state ?? 'not provided') + '</p>'));
  }

  if (!clientId || !clientSecret) {
    return res
      .status(500)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .send(htmlPage('WHOOP OAuth configuration missing', '<h1 class="error">WHOOP OAuth configuration missing</h1><p>The following environment variables must be configured in Vercel:</p><ul><li><code>WHOOPCLIENTID</code></li><li><code>WHOOPCLIENTSECRET</code></li><li><code>WHOOPREDIRECTURI</code></li><li><code>SUPABASE_URL</code></li><li><code>SUPABASE_SERVICE_ROLE_KEY</code></li></ul>'));
  }

  if (!code) {
    return res
      .status(400)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .send(htmlPage('WHOOP OAuth callback', '<h1 class="error">Missing authorization code</h1><p>WHOOP redirected without a <code>code</code> parameter.</p>'));
  }

  try {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: WHOOP_TOKEN_REDIRECT_URI,
    });

    const response = await axios.post('https://api.prod.whoop.com/oauth/oauth2/token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tokenResponse = response.data as unknown;
    console.log('WHOOP token exchange raw response:', JSON.stringify(tokenResponse));

    const accessToken = findStringFieldDeep(tokenResponse, ['access_token', 'accessToken']);
    const refreshToken = findStringFieldDeep(tokenResponse, ['refresh_token', 'refreshToken']);
    const tokenType = findStringFieldDeep(tokenResponse, ['token_type', 'tokenType']);
    const expiresInValue = findNumberFieldDeep(tokenResponse, ['expires_in', 'expiresIn']);
    const scope = findStringFieldDeep(tokenResponse, ['scope']);

    if (!accessToken) {
      throw new Error('WHOOP token response did not include an access token');
    }

    if (!refreshToken) {
      console.warn('WHOOP token response did not include a refresh token');
    }

    let persistenceStatus = 'Supabase persistence unavailable';
    try {
      const persistence = await persistWhoopTokens({
        accessToken,
        refreshToken,
        tokenType,
        expiresIn: expiresInValue,
        scope,
      });
      persistenceStatus = persistence.persisted
        ? 'WHOOP tokens were stored in the whoop_tokens table in Supabase.'
        : `WHOOP tokens were not stored in Supabase: ${persistence.reason}`;
    } catch (persistError) {
      const message = persistError instanceof Error ? persistError.message : String(persistError);
      persistenceStatus = `WHOOP tokens were exchanged successfully, but Supabase persistence failed: ${message}`;
    }

    return res
      .status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .send(htmlPage('WHOOP OAuth success', '<h1 class="success">WHOOP OAuth success</h1><p>The authorization code was exchanged successfully.</p><p>' + escapeHtml(persistenceStatus) + '</p><p><strong>State:</strong> ' + escapeHtml(state ?? 'not provided') + '</p><p>You can close this window now.</p>'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res
      .status(500)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'no-store')
      .send(htmlPage('WHOOP OAuth exchange failed', '<h1 class="error">WHOOP OAuth exchange failed</h1><p>' + escapeHtml(message) + '</p>'));
  }
}
