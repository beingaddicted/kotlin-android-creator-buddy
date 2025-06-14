const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Enhanced in-memory storage
const clients = new Map(); // clientId -> { ws, adminId, organizationId, lastSeen, status, userName, queuedRequests[] }
const admins = new Map();  // adminId -> { ws, organizationId, clientIds[], lastSeen, connectionHistory[] }
const connectionRequests = new Map(); // requestId -> { clientId, adminId, offerData, timestamp, status }
const queuedRequests = new Map(); // clientId -> [{ requestId, adminId, offerData, timestamp }]
const connectionHistory = new Map(); // clientId -> [{ adminId, timestamp, status, duration? }]

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Enhanced signaling server running on port ${PORT}`);
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
    case 'get_client_history':
      getClientHistory(ws, data);
      break;
    case 'cancel_connection_request':
      cancelConnectionRequest(ws, data);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function registerAdmin(ws, data) {
  const { adminId, organizationId } = data;
  
  // Restore previous client list if admin was connected before
  const existingAdmin = admins.get(adminId);
  const previousClientIds = existingAdmin ? existingAdmin.clientIds : [];
  
  admins.set(adminId, {
    ws,
    organizationId,
    clientIds: previousClientIds,
    lastSeen: Date.now(),
    connectionHistory: existingAdmin ? existingAdmin.connectionHistory : []
  });

  ws.adminId = adminId;
  
  console.log(`Admin registered: ${adminId} for org: ${organizationId}`);
  
  ws.send(JSON.stringify({
    type: 'admin_registered',
    adminId,
    organizationId,
    reconnected: !!existingAdmin
  }));

  // Send comprehensive client list including offline clients
  sendEnhancedClientList(adminId);
  
  // Send any pending notifications for this admin
  sendPendingNotifications(adminId);
}

function registerClient(ws, data) {
  const { clientId, adminId, organizationId, userName } = data;
  
  // Check for existing client data
  const existingClient = clients.get(clientId);
  const wasOffline = existingClient && existingClient.status === 'offline';
  
  clients.set(clientId, {
    ws,
    adminId,
    organizationId,
    userName,
    lastSeen: Date.now(),
    status: 'online',
    queuedRequests: existingClient ? existingClient.queuedRequests : [],
    connectionHistory: existingClient ? existingClient.connectionHistory : []
  });

  ws.clientId = clientId;
  
  console.log(`Client registered: ${clientId} for admin: ${adminId} ${wasOffline ? '(reconnected)' : '(new)'}`);
  
  // Add client to admin's list if not already there
  const admin = admins.get(adminId);
  if (admin && !admin.clientIds.includes(clientId)) {
    admin.clientIds.push(clientId);
  }
  
  // Notify admin of client status
  if (admin) {
    admin.ws.send(JSON.stringify({
      type: wasOffline ? 'client_reconnected' : 'client_connected',
      clientId,
      userName,
      organizationId,
      lastSeen: existingClient ? existingClient.lastSeen : Date.now()
    }));
  }

  ws.send(JSON.stringify({
    type: 'client_registered',
    clientId,
    adminId,
    reconnected: wasOffline
  }));

  // Process any queued connection requests
  processQueuedRequests(clientId);
}

function handleAdminConnectRequest(ws, data) {
  const { clientId, offerData, priority = 'normal' } = data;
  const requestId = uuidv4();
  const client = clients.get(clientId);
  
  // Store the connection request
  connectionRequests.set(requestId, {
    clientId,
    adminId: ws.adminId,
    offerData,
    timestamp: Date.now(),
    status: 'pending',
    priority
  });

  if (!client || client.status !== 'online') {
    // Client is offline - queue the request
    queueConnectionRequest(clientId, requestId, ws.adminId, offerData);
    
    ws.send(JSON.stringify({
      type: 'connection_request_queued',
      requestId,
      clientId,
      message: 'Client is offline. Request queued for when client comes online.'
    }));
    
    console.log(`Connection request queued for offline client ${clientId} from admin ${ws.adminId}`);
    return;
  }

  // Client is online - send request immediately
  sendConnectionRequestToClient(requestId, client, ws.adminId, offerData);
  
  ws.send(JSON.stringify({
    type: 'connection_request_sent',
    requestId,
    clientId
  }));

  console.log(`Admin ${ws.adminId} requesting connection to client ${clientId}`);
}

function queueConnectionRequest(clientId, requestId, adminId, offerData) {
  if (!queuedRequests.has(clientId)) {
    queuedRequests.set(clientId, []);
  }
  
  queuedRequests.get(clientId).push({
    requestId,
    adminId,
    offerData,
    timestamp: Date.now()
  });
  
  // Limit queue size to prevent memory issues
  const queue = queuedRequests.get(clientId);
  if (queue.length > 10) {
    const removed = queue.shift();
    connectionRequests.delete(removed.requestId);
  }
}

function processQueuedRequests(clientId) {
  const queue = queuedRequests.get(clientId);
  if (!queue || queue.length === 0) return;
  
  const client = clients.get(clientId);
  if (!client) return;
  
  console.log(`Processing ${queue.length} queued requests for client ${clientId}`);
  
  // Process all queued requests
  queue.forEach(queuedRequest => {
    const { requestId, adminId, offerData } = queuedRequest;
    
    // Update request status
    const request = connectionRequests.get(requestId);
    if (request) {
      request.status = 'sent';
      sendConnectionRequestToClient(requestId, client, adminId, offerData);
      
      // Notify admin that queued request is now being processed
      const admin = admins.get(adminId);
      if (admin) {
        admin.ws.send(JSON.stringify({
          type: 'queued_request_processing',
          requestId,
          clientId,
          message: 'Client came online. Processing queued connection request.'
        }));
      }
    }
  });
  
  // Clear the queue
  queuedRequests.delete(clientId);
}

function sendConnectionRequestToClient(requestId, client, adminId, offerData) {
  client.ws.send(JSON.stringify({
    type: 'admin_connection_request',
    requestId,
    adminId,
    offerData,
    timestamp: Date.now()
  }));
}

function handleClientResponse(ws, data) {
  const { requestId, accepted, answerData } = data;
  const clientId = ws.clientId;
  const request = connectionRequests.get(requestId);
  
  if (!request) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Connection request not found or expired'
    }));
    return;
  }

  // Update request status
  request.status = accepted ? 'accepted' : 'rejected';
  
  const admin = admins.get(request.adminId);
  if (admin) {
    admin.ws.send(JSON.stringify({
      type: 'client_connection_response',
      requestId,
      clientId,
      accepted,
      answerData,
      timestamp: Date.now()
    }));
  }

  // Record connection history
  recordConnectionHistory(clientId, request.adminId, accepted ? 'accepted' : 'rejected');
  
  // Clean up request after response
  setTimeout(() => {
    connectionRequests.delete(requestId);
  }, 60000); // Keep for 1 minute for potential cleanup
  
  console.log(`Client ${clientId} ${accepted ? 'accepted' : 'rejected'} connection from admin ${request.adminId}`);
}

function cancelConnectionRequest(ws, data) {
  const { requestId } = data;
  const request = connectionRequests.get(requestId);
  
  if (request && request.adminId === ws.adminId) {
    request.status = 'cancelled';
    
    const client = clients.get(request.clientId);
    if (client && client.status === 'online') {
      client.ws.send(JSON.stringify({
        type: 'connection_request_cancelled',
        requestId
      }));
    }
    
    connectionRequests.delete(requestId);
    
    ws.send(JSON.stringify({
      type: 'connection_request_cancelled',
      requestId,
      success: true
    }));
  }
}

function recordConnectionHistory(clientId, adminId, status) {
  if (!connectionHistory.has(clientId)) {
    connectionHistory.set(clientId, []);
  }
  
  connectionHistory.get(clientId).push({
    adminId,
    timestamp: Date.now(),
    status
  });
  
  // Keep only last 50 connection attempts
  const history = connectionHistory.get(clientId);
  if (history.length > 50) {
    history.shift();
  }
}

function handleHeartbeat(ws, data) {
  const { id, role } = data;
  
  if (role === 'admin' && admins.has(id)) {
    admins.get(id).lastSeen = Date.now();
  } else if (role === 'client' && clients.has(id)) {
    const client = clients.get(id);
    client.lastSeen = Date.now();
    if (client.status === 'offline') {
      client.status = 'online';
      
      // Notify admin of client coming back online
      const admin = admins.get(client.adminId);
      if (admin) {
        admin.ws.send(JSON.stringify({
          type: 'client_reconnected',
          clientId: id,
          userName: client.userName
        }));
      }
    }
  }
  
  ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
}

function getClientHistory(ws, data) {
  const { clientId } = data;
  const history = connectionHistory.get(clientId) || [];
  
  ws.send(JSON.stringify({
    type: 'client_history',
    clientId,
    history
  }));
}

function sendEnhancedClientList(adminId) {
  const admin = admins.get(adminId);
  if (!admin) return;

  const clientList = admin.clientIds.map(clientId => {
    const client = clients.get(clientId);
    const history = connectionHistory.get(clientId) || [];
    const pendingRequests = Array.from(connectionRequests.values())
      .filter(req => req.clientId === clientId && req.status === 'pending').length;
    
    return {
      clientId,
      userName: client?.userName || 'Unknown',
      status: client?.status || 'offline',
      lastSeen: client?.lastSeen || 0,
      connectionHistory: history.slice(-5), // Last 5 connection attempts
      pendingRequests
    };
  });

  admin.ws.send(JSON.stringify({
    type: 'enhanced_client_list',
    clients: clientList,
    totalClients: clientList.length,
    onlineClients: clientList.filter(c => c.status === 'online').length
  }));
}

function sendPendingNotifications(adminId) {
  // Send notifications about any important events that happened while admin was offline
  const admin = admins.get(adminId);
  if (!admin) return;
  
  const notifications = [];
  
  // Check for clients that came online recently
  admin.clientIds.forEach(clientId => {
    const client = clients.get(clientId);
    if (client && client.status === 'online') {
      const timeSinceOnline = Date.now() - client.lastSeen;
      if (timeSinceOnline < 300000) { // Within last 5 minutes
        notifications.push({
          type: 'client_recently_online',
          clientId,
          userName: client.userName,
          timestamp: client.lastSeen
        });
      }
    }
  });
  
  if (notifications.length > 0) {
    admin.ws.send(JSON.stringify({
      type: 'pending_notifications',
      notifications
    }));
  }
}

function cleanupConnection(ws) {
  if (ws.adminId) {
    console.log(`Admin disconnected: ${ws.adminId}`);
    const admin = admins.get(ws.adminId);
    if (admin) {
      admin.lastSeen = Date.now();
      // Keep admin data for potential reconnection
    }
  }
  
  if (ws.clientId) {
    console.log(`Client disconnected: ${ws.clientId}`);
    const client = clients.get(ws.clientId);
    if (client) {
      client.status = 'offline';
      client.lastSeen = Date.now();
      client.ws = null; // Remove WebSocket reference
      
      // Notify admin of client disconnect
      const admin = admins.get(client.adminId);
      if (admin && admin.ws) {
        admin.ws.send(JSON.stringify({
          type: 'client_disconnected',
          clientId: ws.clientId,
          lastSeen: client.lastSeen
        }));
      }
    }
  }
}

// Enhanced cleanup with more sophisticated logic
setInterval(() => {
  const now = Date.now();
  const clientTimeout = 10 * 60 * 1000; // 10 minutes for clients
  const adminTimeout = 30 * 60 * 1000; // 30 minutes for admins
  const requestTimeout = 60 * 60 * 1000; // 1 hour for connection requests

  // Cleanup stale clients (but keep their data)
  for (const [clientId, client] of clients) {
    if (client.status === 'offline' && now - client.lastSeen > clientTimeout) {
      console.log(`Marking client as stale: ${clientId}`);
      // Don't delete, just mark as stale for potential cleanup later
    }
  }

  // Cleanup truly stale admins (no activity for 30+ minutes)
  for (const [adminId, admin] of admins) {
    if (now - admin.lastSeen > adminTimeout && !admin.ws) {
      console.log(`Removing stale admin: ${adminId}`);
      admins.delete(adminId);
    }
  }

  // Cleanup old connection requests
  for (const [requestId, request] of connectionRequests) {
    if (now - request.timestamp > requestTimeout) {
      console.log(`Removing stale connection request: ${requestId}`);
      connectionRequests.delete(requestId);
    }
  }

  // Cleanup old queued requests
  for (const [clientId, queue] of queuedRequests) {
    const validRequests = queue.filter(req => now - req.timestamp < requestTimeout);
    if (validRequests.length !== queue.length) {
      if (validRequests.length > 0) {
        queuedRequests.set(clientId, validRequests);
      } else {
        queuedRequests.delete(clientId);
      }
    }
  }
}, 5 * 60 * 1000);

// Enhanced REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    stats: {
      clients: clients.size,
      admins: admins.size,
      onlineClients: Array.from(clients.values()).filter(c => c.status === 'online').length,
      pendingRequests: connectionRequests.size,
      queuedRequests: Array.from(queuedRequests.values()).reduce((sum, queue) => sum + queue.length, 0)
    }
  });
});

app.get('/api/admin/:adminId/clients', (req, res) => {
  const { adminId } = req.params;
  const admin = admins.get(adminId);
  
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  
  const clientList = admin.clientIds.map(clientId => {
    const client = clients.get(clientId);
    return {
      clientId,
      userName: client?.userName || 'Unknown',
      status: client?.status || 'offline',
      lastSeen: client?.lastSeen || 0,
      pendingRequests: Array.from(connectionRequests.values())
        .filter(req => req.clientId === clientId && req.status === 'pending').length
    };
  });
  
  res.json({ clients: clientList });
});

app.post('/api/admin/:adminId/connect/:clientId', (req, res) => {
  const { adminId, clientId } = req.params;
  const { offerData, priority = 'normal' } = req.body;
  
  const client = clients.get(clientId);
  const requestId = uuidv4();
  
  connectionRequests.set(requestId, {
    clientId,
    adminId,
    offerData,
    timestamp: Date.now(),
    status: 'pending',
    priority
  });
  
  if (!client || client.status !== 'online') {
    queueConnectionRequest(clientId, requestId, adminId, offerData);
    return res.json({ 
      success: true, 
      requestId,
      message: 'Connection request queued for offline client',
      queued: true
    });
  }
  
  sendConnectionRequestToClient(requestId, client, adminId, offerData);
  res.json({ 
    success: true, 
    requestId,
    message: 'Connection request sent to online client',
    queued: false
  });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    timestamp: Date.now(),
    clients: {
      total: clients.size,
      online: Array.from(clients.values()).filter(c => c.status === 'online').length,
      offline: Array.from(clients.values()).filter(c => c.status === 'offline').length
    },
    admins: {
      total: admins.size,
      online: Array.from(admins.values()).filter(a => a.ws).length
    },
    requests: {
      pending: Array.from(connectionRequests.values()).filter(r => r.status === 'pending').length,
      queued: Array.from(queuedRequests.values()).reduce((sum, queue) => sum + queue.length, 0),
      total: connectionRequests.size
    }
  };
  
  res.json(stats);
});

console.log(`
🚀 Enhanced WebRTC Signaling Server Started
   Port: ${PORT}
   WebSocket: ws://localhost:${PORT}
   Health: http://localhost:${PORT}/api/health
   Stats: http://localhost:${PORT}/api/stats
   
✨ Advanced Features:
   • Connection request queuing for offline clients
   • Enhanced client state management
   • Connection history tracking
   • Improved reconnection handling
   • Comprehensive admin dashboard support
`);
