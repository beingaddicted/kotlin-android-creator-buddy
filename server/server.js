
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import managers
const ConnectionManager = require('./managers/ConnectionManager');
const ClientManager = require('./managers/ClientManager');
const AdminManager = require('./managers/AdminManager');
const QueueManager = require('./managers/QueueManager');
const HistoryManager = require('./managers/HistoryManager');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize managers
const connectionManager = new ConnectionManager();
const clientManager = new ClientManager();
const adminManager = new AdminManager();
const queueManager = new QueueManager();
const historyManager = new HistoryManager();

// Set up manager dependencies
connectionManager.setManagers(clientManager, adminManager, queueManager, historyManager);
clientManager.setManagers(adminManager, connectionManager);
adminManager.setManagers(clientManager, historyManager);

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
      connectionManager.handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error('Invalid JSON message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  ws.on('close', () => {
    connectionManager.cleanupConnection(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Enhanced cleanup with more sophisticated logic
setInterval(() => {
  const now = Date.now();
  const clientTimeout = 10 * 60 * 1000; // 10 minutes for clients
  const adminTimeout = 30 * 60 * 1000; // 30 minutes for admins
  const requestTimeout = 60 * 60 * 1000; // 1 hour for connection requests

  // Cleanup stale clients
  for (const [clientId, client] of clientManager.getAllClients()) {
    if (client.status === 'offline' && now - client.lastSeen > clientTimeout) {
      console.log(`Marking client as stale: ${clientId}`);
    }
  }

  // Cleanup truly stale admins
  for (const [adminId, admin] of adminManager.getAllAdmins()) {
    if (now - admin.lastSeen > adminTimeout && !admin.ws) {
      console.log(`Removing stale admin: ${adminId}`);
      adminManager.getAllAdmins().delete(adminId);
    }
  }

  // Cleanup old connection requests
  for (const [requestId, request] of connectionManager.getConnectionRequests()) {
    if (now - request.timestamp > requestTimeout) {
      console.log(`Removing stale connection request: ${requestId}`);
      connectionManager.getConnectionRequests().delete(requestId);
    }
  }

  // Cleanup old queued requests
  queueManager.cleanupStaleRequests(requestTimeout);
}, 5 * 60 * 1000);

// Enhanced REST API endpoints
app.get('/api/health', (req, res) => {
  const clients = clientManager.getAllClients();
  const admins = adminManager.getAllAdmins();
  
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    stats: {
      clients: clients.size,
      admins: admins.size,
      onlineClients: Array.from(clients.values()).filter(c => c.status === 'online').length,
      pendingRequests: connectionManager.getConnectionRequests().size,
      queuedRequests: queueManager.getQueueStats()
    }
  });
});

app.get('/api/admin/:adminId/clients', (req, res) => {
  const { adminId } = req.params;
  const clientList = clientManager.getClientsByAdmin(adminId);
  
  if (clientList.length === 0 && !adminManager.hasAdmin(adminId)) {
    return res.status(404).json({ error: 'Admin not found' });
  }
  
  // Add pending requests count
  const enhancedClientList = clientList.map(client => ({
    ...client,
    pendingRequests: Array.from(connectionManager.getConnectionRequests().values())
      .filter(req => req.clientId === client.clientId && req.status === 'pending').length
  }));
  
  res.json({ clients: enhancedClientList });
});

app.post('/api/admin/:adminId/connect/:clientId', (req, res) => {
  const { adminId, clientId } = req.params;
  const { offerData, priority = 'normal' } = req.body;
  
  const client = clientManager.getClient(clientId);
  const requestId = uuidv4();
  
  connectionManager.getConnectionRequests().set(requestId, {
    clientId,
    adminId,
    offerData,
    timestamp: Date.now(),
    status: 'pending',
    priority
  });
  
  if (!client || client.status !== 'online') {
    queueManager.queueConnectionRequest(clientId, requestId, adminId, offerData);
    return res.json({ 
      success: true, 
      requestId,
      message: 'Connection request queued for offline client',
      queued: true
    });
  }
  
  connectionManager.sendConnectionRequestToClient(requestId, client, adminId, offerData);
  res.json({ 
    success: true, 
    requestId,
    message: 'Connection request sent to online client',
    queued: false
  });
});

app.get('/api/stats', (req, res) => {
  const clients = clientManager.getAllClients();
  const admins = adminManager.getAllAdmins();
  
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
      pending: Array.from(connectionManager.getConnectionRequests().values()).filter(r => r.status === 'pending').length,
      queued: queueManager.getQueueStats(),
      total: connectionManager.getConnectionRequests().size
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
   • Modular architecture with focused managers
`);
