
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    clients: clients.size,
    uptime: process.uptime()
  });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = generateClientId();
  const clientInfo = {
    id: clientId,
    socket: ws,
    connectedAt: new Date(),
    lastPing: new Date()
  };
  
  clients.set(clientId, clientInfo);
  
  console.log(`Client connected: ${clientId} (Total: ${clients.size})`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: clientId,
    serverTime: new Date().toISOString()
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleClientMessage(clientId, message);
    } catch (error) {
      console.error('Invalid message from client:', clientId, error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (Total: ${clients.size})`);
    
    // Notify other clients
    broadcastToOthers(clientId, {
      type: 'client_disconnected',
      clientId: clientId
    });
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`Client error ${clientId}:`, error);
  });
  
  // Setup ping/pong for connection health
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      clientInfo.lastPing = new Date();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // Ping every 30 seconds
});

// Handle client messages
function handleClientMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;
  
  console.log(`Message from ${clientId}:`, message.type);
  
  switch (message.type) {
    case 'webrtc_signaling':
      handleWebRTCSignaling(clientId, message);
      break;
    case 'location_update':
      handleLocationUpdate(clientId, message);
      break;
    case 'broadcast':
      handleBroadcast(clientId, message);
      break;
    case 'ping':
      // Respond to ping
      client.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

// Handle WebRTC signaling
function handleWebRTCSignaling(senderId, message) {
  const { targetId, signaling } = message;
  
  if (targetId && clients.has(targetId)) {
    // Send to specific client
    const targetClient = clients.get(targetId);
    targetClient.socket.send(JSON.stringify({
      type: 'webrtc_signaling',
      senderId: senderId,
      signaling: signaling
    }));
  } else {
    // Broadcast to all other clients
    broadcastToOthers(senderId, {
      type: 'webrtc_signaling',
      senderId: senderId,
      signaling: signaling
    });
  }
}

// Handle location updates
function handleLocationUpdate(senderId, message) {
  broadcastToOthers(senderId, {
    type: 'location_update',
    senderId: senderId,
    location: message.location,
    timestamp: message.timestamp || Date.now()
  });
}

// Handle broadcast messages
function handleBroadcast(senderId, message) {
  broadcastToOthers(senderId, {
    type: 'broadcast',
    senderId: senderId,
    data: message.data,
    timestamp: Date.now()
  });
}

// Broadcast to all clients except sender
function broadcastToOthers(senderId, message) {
  clients.forEach((client, clientId) => {
    if (clientId !== senderId && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
      }
    }
  });
}

// Generate unique client ID
function generateClientId() {
  return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Start server
const PORT = process.env.PORT || 3001;
const LOCAL_IP = getLocalIP();

server.listen(PORT, () => {
  console.log('🚀 LocationSync WebSocket Server Started');
  console.log(`📍 Local URL: ws://localhost:${PORT}`);
  console.log(`🌐 Network URL: ws://${LOCAL_IP}:${PORT}`);
  console.log(`📱 Mobile devices can connect to: ws://${LOCAL_IP}:${PORT}`);
  console.log('✅ Server ready for WebRTC signaling and location sync');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
