#!/usr/bin/env node

import http from 'http';
import url from 'url';
import { spawn } from 'child_process';
import { WhoopApiClient } from './dist/whoop-api.js';

const PORT = 3000;

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const WHOOP_CONFIG = {
  clientId: process.env.WHOOPCLIENTID || process.env.WHOOPCLIENTID || 'your_client_id_here',
  clientSecret: process.env.WHOOPCLIENTSECRET || process.env.WHOOPCLIENTSECRET || 'your_client_secret_here',
  redirectUri: process.env.WHOOPREDIRECTURI || process.env.WHOOPREDIRECTURI || 'http://localhost:3000/callback'
};

const whoopClient = new WhoopApiClient(WHOOP_CONFIG);

// Store the authorization code for exchange
let authCode = null;
let accessToken = null;
let refreshToken = null;

// Generate a secure random state parameter
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Store the state for verification
let currentState = null;

// Function to open browser
function openBrowser(url) {
  const platform = process.platform;
  let command;
  
  switch (platform) {
    case 'darwin':
      command = 'open';
      break;
    case 'win32':
      command = 'start';
      break;
    default:
      command = 'xdg-open';
  }
  
  const child = spawn(command, [url], { stdio: 'ignore' });
  child.on('error', (err) => {
    console.log('❌ Could not open browser automatically');
    console.log(`🔗 Please visit this URL manually: ${url}`);
  });
}

// Function to exchange code for token
async function exchangeCodeForToken(code) {
  try {
    console.log('🔄 Exchanging authorization code for access token...');
    const tokenResponse = await whoopClient.exchangeCodeForToken(code);
    
    console.log('📋 Raw token response:', JSON.stringify(tokenResponse, null, 2));
    
    accessToken = tokenResponse.access_token;
    refreshToken = tokenResponse.refresh_token;
    
    console.log('✅ Authentication successful!');
    if (accessToken) {
      console.log('📋 Access Token:', accessToken.substring(0, 20) + '...');
    } else {
      console.log('❌ No access token received');
    }
    if (refreshToken) {
      console.log('🔄 Refresh Token:', refreshToken.substring(0, 20) + '...');
    } else {
      console.log('❌ No refresh token received');
    }
    console.log('⏰ Expires in:', tokenResponse.expires_in, 'seconds');
    
    return tokenResponse;
  } catch (error) {
    console.error('❌ Failed to exchange code for token:', error.message);
    console.error('❌ Full error:', error);
    throw error;
  }
}

// Function to test the access token
async function testAccessToken() {
  if (!accessToken) {
    console.log('❌ No access token available');
    return;
  }
  
  try {
    console.log('🧪 Testing access token...');
    whoopClient.setAccessToken(accessToken);
    
    const userProfile = await whoopClient.getUserProfile();
    console.log('✅ Access token is valid!');
    console.log('👤 User:', userProfile.first_name, userProfile.last_name);
    console.log('📧 Email:', userProfile.email);
    
    return userProfile;
  } catch (error) {
    console.log('❌ Access token test failed:', error.message);
    throw error;
  }
}

// Function to save tokens to file
async function saveTokens() {
  const fs = await import('fs');
  const tokenData = {
    accessToken,
    refreshToken,
    timestamp: new Date().toISOString()
  };
  
  try {
    fs.default.writeFileSync('whoop-tokens.json', JSON.stringify(tokenData, null, 2));
    console.log('💾 Tokens saved to whoop-tokens.json');
  } catch (error) {
    console.error('❌ Failed to save tokens:', error.message);
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/') {
    // Main page - initiate OAuth flow
    currentState = generateState();
    const authUrl = whoopClient.getAuthorizationUrl() + `&state=${currentState}`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>WHOOP Authentication</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
            .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
            .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
            .info { background: #d1ecf1; color: #0c5460; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔐 WHOOP Authentication</h1>
            <p>Click the button below to authenticate with WHOOP and access your fitness data.</p>
            
            <a href="${authUrl}" class="button">🔗 Connect to WHOOP</a>
            
            <div class="status info">
              <strong>Status:</strong> Ready to authenticate
            </div>
            
            <p><small>This will open WHOOP's authorization page in your browser.</small></p>
          </div>
        </body>
      </html>
    `);
    
    // Automatically open the browser
    console.log('🌐 Opening WHOOP authorization page...');
    openBrowser(authUrl);
    
  } else if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.query.code;
    const error = parsedUrl.query.error;
    const returnedState = parsedUrl.query.state;
    
    // Verify state parameter for security
    if (returnedState !== currentState) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>WHOOP OAuth Error</title></head>
          <body>
            <div class="container">
              <h1>❌ Security Error</h1>
              <div class="status error">
                <strong>Error:</strong> State parameter mismatch<br>
                <strong>Description:</strong> This could be a security issue. Please try again.
              </div>
              <p>Please try the authentication process again.</p>
            </div>
          </body>
        </html>
      `);
      
      console.error('❌ State parameter mismatch - possible security issue');
      return;
    }
    
    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>WHOOP OAuth Error</title></head>
          <body>
            <div class="container">
              <h1>❌ OAuth Error</h1>
              <div class="status error">
                <strong>Error:</strong> ${error}<br>
                <strong>Description:</strong> ${parsedUrl.query.error_description || 'No description'}
              </div>
              <p>Please try again or check your WHOOP credentials.</p>
            </div>
          </body>
        </html>
      `);
      
      console.error('❌ OAuth error:', error);
      
    } else if (code) {
      authCode = code;
      
      try {
        // Exchange code for token
        const tokenResponse = await exchangeCodeForToken(code);
        
        // Test the token
        const userProfile = await testAccessToken();
        
        // Save tokens
        await saveTokens();
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head>
              <title>WHOOP Authentication Success</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
                .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
                .success { background: #d4edda; color: #155724; }
                .token { background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; word-break: break-all; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>✅ Authentication Successful!</h1>
                
                <div class="status success">
                  <strong>Welcome, ${userProfile.first_name} ${userProfile.last_name}!</strong>
                </div>
                
                <h3>🔑 Access Token:</h3>
                <div class="token">${accessToken}</div>
                
                <h3>🔄 Refresh Token:</h3>
                <div class="token">${refreshToken || 'No refresh token provided'}</div>
                
                <p><strong>🎉 You can now use the WHOOP MCP server with Claude!</strong></p>
                
                <p>Your tokens have been saved to <code>whoop-tokens.json</code> and are ready to use.</p>
                
                <p><small>You can close this window. The authentication is complete.</small></p>
              </div>
            </body>
          </html>
        `);
        
        console.log('\n🎉 Authentication completed successfully!');
        console.log('📋 You can now use the WHOOP MCP server with Claude.');
        console.log('💾 Tokens saved to whoop-tokens.json');
        
        // Optionally shut down the server after successful auth
        setTimeout(() => {
          console.log('\n👋 Shutting down authentication server...');
          server.close(() => {
            console.log('✅ Authentication server stopped');
            process.exit(0);
          });
        }, 5000);
        
      } catch (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>WHOOP Authentication Error</title></head>
            <body>
              <div class="container">
                <h1>❌ Authentication Failed</h1>
                <div class="status error">
                  <strong>Error:</strong> ${error.message}
                </div>
                <p>Please try again or check your WHOOP credentials.</p>
              </div>
            </body>
          </html>
        `);
        
        console.error('❌ Authentication failed:', error.message);
      }
      
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>WHOOP OAuth</title></head>
          <body>
            <div class="container">
              <h1>WHOOP OAuth Callback</h1>
              <p>No authorization code or error received.</p>
              <p>Please try the authentication process again.</p>
            </div>
          </body>
        </html>
      `);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start the server
server.listen(PORT, () => {
  console.log('🚀 WHOOP Authentication Server');
  console.log('📍 Running on http://localhost:3000');
  console.log('🔗 Visit the URL above to start authentication');
  console.log('📋 The browser will open automatically...');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down authentication server...');
  server.close(() => {
    console.log('✅ Authentication server stopped');
    process.exit(0);
  });
});
