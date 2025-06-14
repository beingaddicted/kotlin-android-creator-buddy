
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (use Redis/Database in production)
const clients = new Map(); // clientId -> { ws, adminId, organizationId, lastSeen }
const admins = new Map();  // adminId -> { ws, organizationId, clientIds[] }
const connectionRequests = new Map(); // clientId -> { adminId, offerData, timestamp }

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error('Invalid JSON message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    // Clean up disconnected clients/admins
    cleanupConnection(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'register_admin':
      registerAdmin(ws, data);
      break;
    case 'register_client':
      registerClient(ws, data);
      break;
    case 'admin_connect_request':
      handleAdminConnectRequest(ws, data);
      break;
    case 'client_response':
      handleClientResponse(ws, data);
      break;
    case 'heartbeat':
      handleHeartbeat(ws, data);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function registerAdmin(ws, data) {
  const { adminId, organizationId } = data;
  
  admins.set(adminId, {
    ws,
    organizationId,
    clientIds: [],
    lastSeen: Date.now()
  });

  ws.adminId = adminId;
  
  console.log(`Admin registered: ${adminId} for org: ${organizationId}`);
  
  ws.send(JSON.stringify({
    type: 'admin_registered',
    adminId,
    organizationId
  }));

  // Send list of previously connected clients for this org
  sendClientList(adminId);
}

function registerClient(ws, data) {
  const { clientId, adminId, organizationId, userName } = data;
  
  clients.set(clientId, {
    ws,
    adminId,
    organizationId,
    userName,
    lastSeen: Date.now(),
    status: 'online'
  });

  ws.clientId = clientId;
  
  console.log(`Client registered: ${clientId} for admin: ${adminId}`);
  
  // Add client to admin's list
  const admin = admins.get(adminId);
  if (admin && !admin.clientIds.includes(clientId)) {
    admin.clientIds.push(clientId);
    
    // Notify admin of new client
    admin.ws.send(JSON.stringify({
      type: 'client_connected',
      clientId,
      userName,
      organizationId
    }));
  }

  ws.send(JSON.stringify({
    type: 'client_registered',
    clientId,
    adminId
  }));
}

function handleAdminConnectRequest(ws, data) {
  const { clientId, offerData } = data;
  const client = clients.get(clientId);
  
  if (!client) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Client not found or offline'
    }));
    return;
  }

  // Store connection request
  connectionRequests.set(clientId, {
    adminId: ws.adminId,
    offerData,
    timestamp: Date.now()
  });

  // Send connection request to client
  client.ws.send(JSON.stringify({
    type: 'admin_connection_request',
    adminId: ws.adminId,
    offerData
  }));

  console.log(`Admin ${ws.adminId} requesting connection to client ${clientId}`);
}

function handleClientResponse(ws, data) {
  const { accepted, answerData } = data;
  const clientId = ws.clientId;
  const request = connectionRequests.get(clientId);
  
  if (!request) {
    return;
  }

  const admin = admins.get(request.adminId);
  if (admin) {
    admin.ws.send(JSON.stringify({
      type: 'client_connection_response',
      clientId,
      accepted,
      answerData
    }));
  }

  // Clean up request
  connectionRequests.delete(clientId);
  
  console.log(`Client ${clientId} ${accepted ? 'accepted' : 'rejected'} connection from admin ${request.adminId}`);
}

function handleHeartbeat(ws, data) {
  const { id, role } = data;
  
  if (role === 'admin' && admins.has(id)) {
    admins.get(id).lastSeen = Date.now();
  } else if (role === 'client' && clients.has(id)) {
    clients.get(id).lastSeen = Date.now();
  }
  
  ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
}

function sendClientList(adminId) {
  const admin = admins.get(adminId);
  if (!admin) return;

  const clientList = admin.clientIds.map(clientId => {
    const client = clients.get(clientId);
    return {
      clientId,
      userName: client?.userName || 'Unknown',
      status: client ? 'online' : 'offline',
      lastSeen: client?.lastSeen || 0
    };
  });

  admin.ws.send(JSON.stringify({
    type: 'client_list',
    clients: clientList
  }));
}

function cleanupConnection(ws) {
  if (ws.adminId) {
    console.log(`Admin disconnected: ${ws.adminId}`);
    admins.delete(ws.adminId);
  }
  
  if (ws.clientId) {
    console.log(`Client disconnected: ${ws.clientId}`);
    const client = clients.get(ws.clientId);
    if (client) {
      client.status = 'offline';
      client.lastSeen = Date.now();
      
      // Notify admin of client disconnect
      const admin = admins.get(client.adminId);
      if (admin) {
        admin.ws.send(JSON.stringify({
          type: 'client_disconnected',
          clientId: ws.clientId
        }));
      }
    }
  }
}

// Cleanup stale connections every 5 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  // Cleanup stale clients
  for (const [clientId, client] of clients) {
    if (now - client.lastSeen > timeout) {
      console.log(`Removing stale client: ${clientId}`);
      clients.delete(clientId);
    }
  }

  // Cleanup stale admins
  for (const [adminId, admin] of admins) {
    if (now - admin.lastSeen > timeout) {
      console.log(`Removing stale admin: ${adminId}`);
      admins.delete(adminId);
    }
  }
}, 5 * 60 * 1000);

// REST API endpoints for HTTP polling (fallback)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    clients: clients.size,
    admins: admins.size
  });
});

app.post('/api/admin/:adminId/connect/:clientId', (req, res) => {
  const { adminId, clientId } = req.params;
  const { offerData } = req.body;
  
  const client = clients.get(clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found or offline' });
  }

  // Store connection request for polling
  connectionRequests.set(clientId, {
    adminId,
    offerData,
    timestamp: Date.now()
  });

  res.json({ success: true, message: 'Connection request queued' });
});

app.get('/api/client/:clientId/requests', (req, res) => {
  const { clientId } = req.params;
  const request = connectionRequests.get(clientId);
  
  if (request) {
    res.json({ request });
    // Don't delete yet, wait for response
  } else {
    res.json({ request: null });
  }
});

console.log(`
🚀 WebRTC Signaling Server Started
   Port: ${PORT}
   WebSocket: ws://localhost:${PORT}
   Health: http://localhost:${PORT}/api/health
`);
