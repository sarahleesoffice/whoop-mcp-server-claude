import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { WhoopApiClient } from '../src/whoop-api.js';
import { WhoopApiConfig } from '../src/types.js';

function createServer(config: WhoopApiConfig) {
  const whoopClient = new WhoopApiClient(config);

  const server = new Server(
    { name: 'whoop-mcp-server', version: '1.0.0' }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'whoop-get-user-profile', description: 'Get basic user profile information (name, email) for the authenticated user', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'whoop-get-user-body-measurements', description: 'Get body measurements (height, weight, max heart rate) for the authenticated user', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'whoop-revoke-user-access', description: 'Revoke the access token granted by the user', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'whoop-get-cycle-by-id', description: 'Get the cycle for the specified ID', inputSchema: { type: 'object', properties: { cycleId: { type: 'number', description: 'ID of the cycle to retrieve' } }, required: ['cycleId'] } },
      { name: 'whoop-get-cycle-collection', description: 'Get all physiological cycles for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-sleep-for-cycle', description: 'Get sleep data for a specific cycle', inputSchema: { type: 'object', properties: { cycleId: { type: 'number' } }, required: ['cycleId'] } },
      { name: 'whoop-get-recovery-collection', description: 'Get all recovery data for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-recovery-for-cycle', description: 'Get recovery data for a specific cycle', inputSchema: { type: 'object', properties: { cycleId: { type: 'number' } }, required: ['cycleId'] } },
      { name: 'whoop-get-sleep-by-id', description: 'Get the sleep record for the specified ID', inputSchema: { type: 'object', properties: { sleepId: { type: 'string' } }, required: ['sleepId'] } },
      { name: 'whoop-get-sleep-collection', description: 'Get all sleep records for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-workout-by-id', description: 'Get the workout record for the specified ID', inputSchema: { type: 'object', properties: { workoutId: { type: 'string' } }, required: ['workoutId'] } },
      { name: 'whoop-get-workout-collection', description: 'Get all workout records for a user, paginated', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, start: { type: 'string' }, end: { type: 'string' }, nextToken: { type: 'string' } }, required: [] } },
      { name: 'whoop-get-authorization-url', description: 'Get the authorization URL for OAuth flow', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'whoop-exchange-code-for-token', description: 'Exchange authorization code for access token', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
      { name: 'whoop-refresh-token', description: 'Refresh access token using refresh token', inputSchema: { type: 'object', properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] } },
      { name: 'whoop-set-access-token', description: 'Set the access token for API calls', inputSchema: { type: 'object', properties: { accessToken: { type: 'string' } }, required: ['accessToken'] } },
    ] as Tool[],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case 'whoop-get-user-profile': return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getUserProfile(), null, 2) }] };
        case 'whoop-get-user-body-measurements': return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getUserBodyMeasurements(), null, 2) }] };
        case 'whoop-revoke-user-access': await whoopClient.revokeUserAccess(); return { content: [{ type: 'text', text: 'User access revoked successfully' }] };
        case 'whoop-get-cycle-by-id': {
          if (!args || typeof args.cycleId !== 'number') throw new Error('cycleId is required');
          return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getCycleById(args.cycleId), null, 2) }] };
        }
        case 'whoop-get-cycle-collection': return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getCycleCollection({ limit: args?.limit as number | undefined, start: args?.start as string | undefined, end: args?.end as string | undefined, nextToken: args?.nextToken as string | undefined }), null, 2) }] };
        case 'whoop-get-sleep-for-cycle': {
          if (!args || typeof args.cycleId !== 'number') throw new Error('cycleId is required');
          return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getSleepForCycle(args.cycleId), null, 2) }] };
        }
        case 'whoop-get-recovery-collection': return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getRecoveryCollection({ limit: args?.limit as number | undefined, start: args?.start as string | undefined, end: args?.end as string | undefined, nextToken: args?.nextToken as string | undefined }), null, 2) }] };
        case 'whoop-get-recovery-for-cycle': {
          if (!args || typeof args.cycleId !== 'number') throw new Error('cycleId is required');
          return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getRecoveryForCycle(args.cycleId), null, 2) }] };
        }
        case 'whoop-get-sleep-by-id': {
          if (!args || typeof args.sleepId !== 'string') throw new Error('sleepId is required');
          return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getSleepById(args.sleepId), null, 2) }] };
        }
        case 'whoop-get-sleep-collection': return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getSleepCollection({ limit: args?.limit as number | undefined, start: args?.start as string | undefined, end: args?.end as string | undefined, nextToken: args?.nextToken as string | undefined }), null, 2) }] };
        case 'whoop-get-workout-by-id': {
          if (!args || typeof args.workoutId !== 'string') throw new Error('workoutId is required');
          return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getWorkoutById(args.workoutId), null, 2) }] };
        }
        case 'whoop-get-workout-collection': return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.getWorkoutCollection({ limit: args?.limit as number | undefined, start: args?.start as string | undefined, end: args?.end as string | undefined, nextToken: args?.nextToken as string | undefined }), null, 2) }] };
        case 'whoop-get-authorization-url': return { content: [{ type: 'text', text: `Authorization URL: ${whoopClient.getAuthorizationUrl()}` }] };
        case 'whoop-exchange-code-for-token': {
          if (!args || typeof args.code !== 'string') throw new Error('code is required');
          return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.exchangeCodeForToken(args.code), null, 2) }] };
        }
        case 'whoop-refresh-token': {
          if (!args || typeof args.refreshToken !== 'string') throw new Error('refreshToken is required');
          return { content: [{ type: 'text', text: JSON.stringify(await whoopClient.refreshToken(args.refreshToken), null, 2) }] };
        }
        case 'whoop-set-access-token': {
          if (!args || typeof args.accessToken !== 'string') throw new Error('accessToken is required');
          whoopClient.setAccessToken(args.accessToken);
          return { content: [{ type: 'text', text: 'Access token set successfully' }] };
        }
        default: throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  });

  return server;
}

// Store active transports (for SSE session management)
const transports: Record<string, SSEServerTransport> = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const config: WhoopApiConfig = {
    clientId: process.env.WHOOP_CLIENT_ID!,
    clientSecret: process.env.WHOOP_CLIENT_SECRET!,
    redirectUri: process.env.WHOOP_REDIRECT_URI || `https://${req.headers.host}/api/callback`,
  };

  if (req.method === 'GET') {
    // SSE endpoint
    const transport = new SSEServerTransport('/api/mcp', res);
    const server = createServer(config);
    transports[transport.sessionId] = transport;
    res.on('close', () => {
      delete transports[transport.sessionId];
    });
    await server.connect(transport);
    return;
  }

  if (req.method === 'POST') {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (!transport) {
      res.status(400).json({ error: 'No active SSE session found for sessionId' });
      return;
    }
    await transport.handlePostMessage(req, res);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
