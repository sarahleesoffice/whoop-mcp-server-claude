import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// In-memory session store (shared across warm lambda instances)
const transports = new Map<string, SSEServerTransport>();

function buildWhoopClient(accessToken?: string) {
  const client = axios.create({
    baseURL: 'https://api.prod.whoop.com/developer/v2',
    headers: { 'Content-Type': 'application/json' },
  });
  client.interceptors.request.use((cfg) => {
    if (accessToken) cfg.headers!['Authorization'] = `Bearer ${accessToken}`;
    return cfg;
  });
  return client;
}

let whoopAccessToken: string | undefined = process.env.WHOOP_ACCESS_TOKEN;

function createMcpServer() {
  const server = new Server({ name: 'whoop-mcp-server', version: '1.0.0' });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'whoop-get-user-profile', description: 'Get basic user profile information (name, email)', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'whoop-get-user-body-measurements', description: 'Get body measurements (height, weight, max heart rate)', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'whoop-get-cycle-collection', description: 'Get all physiological cycles for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-cycle-by-id', description: 'Get a cycle by ID', inputSchema: { type: 'object', properties: { cycleId: { type: 'number' } }, required: ['cycleId'] } },
      { name: 'whoop-get-sleep-for-cycle', description: 'Get sleep data for a specific cycle', inputSchema: { type: 'object', properties: { cycleId: { type: 'number' } }, required: ['cycleId'] } },
      { name: 'whoop-get-recovery-collection', description: 'Get all recovery data for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-recovery-for-cycle', description: 'Get recovery data for a specific cycle', inputSchema: { type: 'object', properties: { cycleId: { type: 'number' } }, required: ['cycleId'] } },
      { name: 'whoop-get-sleep-collection', description: 'Get all sleep records for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-sleep-by-id', description: 'Get a sleep record by ID', inputSchema: { type: 'object', properties: { sleepId: { type: 'string' } }, required: ['sleepId'] } },
      { name: 'whoop-get-workout-collection', description: 'Get all workout records for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-workout-by-id', description: 'Get a workout record by ID', inputSchema: { type: 'object', properties: { workoutId: { type: 'string' } }, required: ['workoutId'] } },
      { name: 'whoop-get-authorization-url', description: 'Get the OAuth authorization URL', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'whoop-exchange-code-for-token', description: 'Exchange authorization code for access token', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
      { name: 'whoop-refresh-token', description: 'Refresh access token using refresh token', inputSchema: { type: 'object', properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] } },
      { name: 'whoop-set-access-token', description: 'Set the access token for API calls', inputSchema: { type: 'object', properties: { accessToken: { type: 'string' } }, required: ['accessToken'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const clientId = process.env.WHOOP_CLIENT_ID ?? '';
    const clientSecret = process.env.WHOOP_CLIENT_SECRET ?? '';
    const redirectUri = process.env.WHOOP_REDIRECT_URI ?? '';

    try {
      const api = buildWhoopClient(whoopAccessToken);

      const paginate = (params?: Record<string, unknown>) => {
        const q = new URLSearchParams();
        if (params?.limit) q.append('limit', String(params.limit));
        if (params?.start) q.append('start', String(params.start));
        if (params?.end) q.append('end', String(params.end));
        if (params?.nextToken) q.append('nextToken', String(params.nextToken));
        return q.toString() ? `?${q.toString()}` : '';
      };

      const text = (data: unknown) => ({
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      });

      switch (name) {
        case 'whoop-get-user-profile':
          return text((await api.get('/user/profile/basic')).data);

        case 'whoop-get-user-body-measurements':
          return text((await api.get('/user/measurement/body')).data);

        case 'whoop-get-cycle-collection':
          return text((await api.get(`/cycle${paginate(args as Record<string, unknown>)}`)).data);

        case 'whoop-get-cycle-by-id': {
          if (!args?.cycleId) throw new Error('cycleId required');
          return text((await api.get(`/cycle/${args.cycleId}`)).data);
        }

        case 'whoop-get-sleep-for-cycle': {
          if (!args?.cycleId) throw new Error('cycleId required');
          return text((await api.get(`/cycle/${args.cycleId}/sleep`)).data);
        }

        case 'whoop-get-recovery-collection':
          return text((await api.get(`/recovery${paginate(args as Record<string, unknown>)}`)).data);

        case 'whoop-get-recovery-for-cycle': {
          if (!args?.cycleId) throw new Error('cycleId required');
          return text((await api.get(`/cycle/${args.cycleId}/recovery`)).data);
        }

        case 'whoop-get-sleep-collection':
          return text((await api.get(`/activity/sleep${paginate(args as Record<string, unknown>)}`)).data);

        case 'whoop-get-sleep-by-id': {
          if (!args?.sleepId) throw new Error('sleepId required');
          return text((await api.get(`/activity/sleep/${args.sleepId}`)).data);
        }

        case 'whoop-get-workout-collection':
          return text((await api.get(`/activity/workout${paginate(args as Record<string, unknown>)}`)).data);

        case 'whoop-get-workout-by-id': {
          if (!args?.workoutId) throw new Error('workoutId required');
          return text((await api.get(`/activity/workout/${args.workoutId}`)).data);
        }

        case 'whoop-get-authorization-url': {
          const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement',
          });
          return text(`https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`);
        }

        case 'whoop-exchange-code-for-token': {
          if (!args?.code) throw new Error('code required');
          const form = new URLSearchParams({
            client_id: clientId, client_secret: clientSecret,
            code: String(args.code), grant_type: 'authorization_code', redirect_uri: redirectUri,
          });
          const resp = await axios.post('https://api.prod.whoop.com/oauth/oauth2/token', form, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          return text(resp.data);
        }

        case 'whoop-refresh-token': {
          if (!args?.refreshToken) throw new Error('refreshToken required');
          const form = new URLSearchParams({
            client_id: clientId, client_secret: clientSecret,
            refresh_token: String(args.refreshToken), grant_type: 'refresh_token',
          });
          const resp = await axios.post('https://api.prod.whoop.com/oauth/oauth2/token', form, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          return text(resp.data);
        }

        case 'whoop-set-access-token': {
          if (!args?.accessToken) throw new Error('accessToken required');
          whoopAccessToken = String(args.accessToken);
          return { content: [{ type: 'text' as const, text: 'Access token set successfully' }] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });

  return server;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Establish SSE connection
    const transport = new SSEServerTransport('/api/mcp', res as unknown as import('http').ServerResponse);
    const server = createMcpServer();
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));
    await server.connect(transport);
    return;
  }

  if (req.method === 'POST') {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      return res.status(400).json({ error: 'No SSE session found. Connect via GET /api/mcp first.' });
    }
    await transport.handlePostMessage(
      req as unknown as import('http').IncomingMessage,
      res as unknown as import('http').ServerResponse,
    );
    return;
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET to establish SSE connection.' });
}
