import dotenv from 'dotenv';
import { WhoopMcpServer } from './mcp-server.js';
import { WhoopApiConfig } from './types.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['WHOOPCLIENTID', 'WHOOPCLIENTSECRET', 'WHOOPREDIRECTURI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please create a .env file based on env.example');
  process.exit(1);
}

// Create WHOOP API configuration
const config: WhoopApiConfig = {
  clientId: process.env.WHOOPCLIENTID!,
  clientSecret: process.env.WHOOPCLIENTSECRET!,
  redirectUri: process.env.WHOOPREDIRECTURI!,
};

// Create and run the MCP server
const server = new WhoopMcpServer(config);

server.run().catch((error) => {
  console.error('Failed to start WHOOP MCP Server:', error);
  process.exit(1);
});
