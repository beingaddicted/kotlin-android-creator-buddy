const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const DDoSProtection = require('./middleware/DDoSProtection');
const SecurityHeaders = require('./middleware/SecurityHeaders');
const WebSocketSecurity = require('./middleware/WebSocketSecurity');
const MonitoringAndAlerting = require('./middleware/MonitoringAndAlerting');
const ConnectionManager = require('./managers/ConnectionManager');
const AdminManager = require('./managers/AdminManager');
const ClientManager = require('./managers/ClientManager');
const HistoryManager = require('./managers/HistoryManager');
const QueueManager = require('./managers/QueueManager');

class SecureWebSocketServer {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Initialize security components
    this.ddosProtection = new DDoSProtection();
    this.wsecurity = new WebSocketSecurity(this.ddosProtection);
    this.monitoring = new MonitoringAndAlerting();
    
    // Initialize managers (keep existing)
    this.connectionManager = new ConnectionManager();
    this.adminManager = new AdminManager();
    this.clientManager = new ClientManager();
    this.historyManager = new HistoryManager();
    this.queueManager = new QueueManager();

    this.setupSecurity();
    this.setupWebSocketServer();
    this.setupRoutes();
    this.setupEventHandlers();
  }

  setupSecurity() {
    // Apply helmet for basic security
    this.app.use(helmet({
      contentSecurityPolicy: false, // We'll handle this custom
      crossOriginEmbedderPolicy: false
    }));

    // Apply custom security headers
    SecurityHeaders.apply(this.app);

    // Apply DDoS protection middleware
    this.app.use(this.ddosProtection.createHTTPRateLimiter());
    this.app.use(this.ddosProtection.createSpeedLimiter());

    // Trust proxy (for accurate IP detection behind reverse proxy)
    this.app.set('trust proxy', true);

    // Parse JSON with size limits
    this.app.use(express.json({ limit: '10mb' }));
  }

  setupWebSocketServer() {
    this.wss = new WebSocket.Server({
      server: this.server,
      verifyClient: (info) => {
        return this.wsecurity.validateUpgrade(info.req, info.req.socket, info.req.headers);
      }
    });

    this.wss.on('connection', (ws, request) => {
      const ip = this.ddosProtection.getClientIP(request);
      const clientId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      ws.clientId = clientId;
      ws.clientIP = ip;
      ws.connectedAt = Date.now();

      // Track connection for DDoS protection
      this.ddosProtection.trackConnection(ip);
      this.monitoring.recordConnection(false);

      console.log(`✅ Secure connection established: ${clientId} from ${ip}`);

      // Set up message handler with security validation
      ws.on('message', (data) => {
        try {
          const validation = this.wsecurity.validateMessage(ws, data.toString(), ip);
          if (!validation || !validation.valid) {
            this.monitoring.recordError();
            return;
          }

          this.monitoring.recordMessage();
          this.handleMessage(ws, validation.message);
        } catch (error) {
          console.error('Message handling error:', error);
          this.monitoring.recordError();
          this.ddosProtection.recordViolation(ip);
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`❌ Client disconnected: ${clientId}`);
        this.ddosProtection.trackDisconnection(ip);
        this.wsecurity.removeAuthentication(clientId);
        this.connectionManager.removeConnection(clientId);
        this.clientManager.removeClient(clientId);
        this.adminManager.removeAdmin(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        this.monitoring.recordError();
        this.ddosProtection.recordViolation(ip);
      });

      // Send initial connection confirmation
      this.sendToClient(ws, {
        type: 'connection-established',
        clientId: clientId,
        timestamp: Date.now(),
        securityEnabled: true
      });
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        security: {
          ddosProtection: 'enabled',
          rateLimiting: 'enabled',
          monitoring: 'enabled'
        }
      });
    });

    // Security metrics endpoint (basic auth would be better in production)
    this.app.get('/metrics', (req, res) => {
      const metrics = {
        ddos: this.ddosProtection.getStats(),
        monitoring: this.monitoring.getMetrics(),
        connections: {
          total: this.connectionManager.getConnectionCount(),
          admins: this.adminManager.getAdminCount(),
          clients: this.clientManager.getClientCount()
        }
      };
      res.json(metrics);
    });

    // Admin override endpoint (for emergency blacklist management)
    this.app.post('/admin/blacklist/:ip', (req, res) => {
      const { ip } = req.params;
      const { reason } = req.body;
      
      // In production, this should require authentication
      this.ddosProtection.blacklistIP(ip, reason || 'Manual blacklist');
      res.json({ success: true, ip, reason });
    });
  }

  setupEventHandlers() {
    // Handle security alerts
    process.on('security-alert', (alert) => {
      console.warn(`🚨 Security Alert: ${alert.type}`, alert.data);
      
      // Broadcast alert to admins
      this.adminManager.getAllAdmins().forEach(admin => {
        if (admin.ws && admin.ws.readyState === WebSocket.OPEN) {
          this.sendToClient(admin.ws, {
            type: 'security-alert',
            alert: alert,
            timestamp: Date.now()
          });
        }
      });
    });

    // Periodic cleanup
    setInterval(() => {
      this.wsecurity.cleanupAuthentications();
    }, 300000); // 5 minutes
  }

  handleMessage(ws, message) {
    // Add security logging for sensitive operations
    if (['join-admin', 'location-request'].includes(message.type)) {
      console.log(`🔒 Sensitive operation: ${message.type} from ${ws.clientIP}`);
    }

    // Continue with existing message handling...
    try {
      switch (message.type) {
        case 'join-admin':
          this.handleAdminJoin(ws, message);
          break;
        case 'join-org':
          this.handleOrgJoin(ws, message);
          break;
        case 'location':
          this.handleLocationUpdate(ws, message);
          break;
        case 'location-request':
          this.handleLocationRequest(ws, message);
          break;
        case 'member-status':
          this.handleMemberStatus(ws, message);
          break;
        case 'mesh-data':
          this.handleMeshData(ws, message);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Message processing error:', error);
      this.monitoring.recordError();
    }
  }

  handleAdminJoin(ws, message) {
    const { adminId, organizationId } = message;
    
    if (!adminId || !organizationId) {
      this.sendToClient(ws, { 
        type: 'error', 
        message: 'Invalid admin join request',
        timestamp: Date.now()
      });
      return;
    }
    
    console.log(`Admin joining: ${adminId} for org: ${organizationId}`);
    
    // Register admin
    this.adminManager.addAdmin({
      clientId: ws.clientId,
      adminId,
      organizationId,
      ws
    });
    
    // Add to connection manager
    this.connectionManager.addConnection({
      clientId: ws.clientId,
      type: 'admin',
      organizationId,
      ws
    });
    
    // Send confirmation
    this.sendToClient(ws, {
      type: 'admin-joined',
      adminId,
      organizationId,
      timestamp: Date.now()
    });
    
    // Send current organization state
    const orgMembers = this.clientManager.getClientsByOrganization(organizationId);
    this.sendToClient(ws, {
      type: 'org-state',
      members: orgMembers,
      timestamp: Date.now()
    });
    
    // Send location history
    const locationHistory = this.historyManager.getLocationHistory(organizationId);
    this.sendToClient(ws, {
      type: 'location-history',
      history: locationHistory,
      timestamp: Date.now()
    });
  }

  handleOrgJoin(ws, message) {
    const { userId, organizationId, userData } = message;
    
    if (!userId || !organizationId) {
      this.sendToClient(ws, { 
        type: 'error', 
        message: 'Invalid organization join request',
        timestamp: Date.now()
      });
      return;
    }
    
    console.log(`User joining: ${userId} for org: ${organizationId}`);
    
    // Register client
    this.clientManager.addClient({
      clientId: ws.clientId,
      userId,
      organizationId,
      userData,
      ws
    });
    
    // Add to connection manager
    this.connectionManager.addConnection({
      clientId: ws.clientId,
      type: 'client',
      organizationId,
      ws
    });
    
    // Send confirmation
    this.sendToClient(ws, {
      type: 'org-joined',
      userId,
      organizationId,
      timestamp: Date.now()
    });
    
    // Notify admins
    this.notifyAdmins(organizationId, {
      type: 'member-joined',
      userId,
      userData,
      timestamp: Date.now()
    });
  }

  handleLocationUpdate(ws, message) {
    const { userId, organizationId, location } = message;
    
    if (!userId || !organizationId || !location) {
      return;
    }
    
    // Store location update
    this.historyManager.addLocationUpdate(organizationId, userId, location);
    
    // Notify admins
    this.notifyAdmins(organizationId, {
      type: 'location-update',
      userId,
      location,
      timestamp: Date.now()
    });
  }

  handleLocationRequest(ws, message) {
    const { adminId, organizationId, targetUserId } = message;
    
    if (!adminId || !organizationId || !targetUserId) {
      return;
    }
    
    // Verify admin
    const isAdmin = this.adminManager.isAdmin(ws.clientId, adminId, organizationId);
    if (!isAdmin) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Unauthorized location request',
        timestamp: Date.now()
      });
      return;
    }
    
    // Find target client
    const targetClient = this.clientManager.getClientByUserId(targetUserId, organizationId);
    if (!targetClient) {
      this.sendToClient(ws, {
        type: 'error',
        message: 'Target user not found',
        timestamp: Date.now()
      });
      return;
    }
    
    // Send location request to client
    this.sendToClient(targetClient.ws, {
      type: 'location-request',
      adminId,
      organizationId,
      timestamp: Date.now()
    });
  }

  handleMemberStatus(ws, message) {
    const { userId, organizationId, status } = message;
    
    if (!userId || !organizationId || !status) {
      return;
    }
    
    // Update client status
    this.clientManager.updateClientStatus(ws.clientId, status);
    
    // Notify admins
    this.notifyAdmins(organizationId, {
      type: 'member-status',
      userId,
      status,
      timestamp: Date.now()
    });
  }

  handleMeshData(ws, message) {
    const { organizationId, meshData } = message;
    
    if (!organizationId || !meshData) {
      return;
    }
    
    // Broadcast to all members of the organization
    this.broadcastToOrganization(organizationId, {
      type: 'mesh-data',
      meshData,
      timestamp: Date.now()
    }, ws.clientId); // Exclude sender
  }

  notifyAdmins(organizationId, message) {
    const admins = this.adminManager.getAdminsByOrganization(organizationId);
    
    admins.forEach(admin => {
      if (admin.ws && admin.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(admin.ws, message);
      }
    });
  }

  broadcastToOrganization(organizationId, message, excludeClientId = null) {
    const connections = this.connectionManager.getConnectionsByOrganization(organizationId);
    
    connections.forEach(connection => {
      if (connection.clientId !== excludeClientId && 
          connection.ws && 
          connection.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(connection.ws, message);
      }
    });
  }

  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
        this.monitoring.recordError();
      }
    }
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`🔒 Secure WebSocket server running on port ${this.port}`);
      console.log(`🛡️  DDoS protection: ENABLED`);
      console.log(`📊 Monitoring: ENABLED`);
      console.log(`🚨 Security alerts: ENABLED`);
    });
  }
}

// Start the secure server
const server = new SecureWebSocketServer(process.env.PORT || 3001);
server.start();

module.exports = SecureWebSocketServer;
