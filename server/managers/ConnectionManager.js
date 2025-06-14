
const WebSocket = require('ws');

class ConnectionManager {
  constructor() {
    this.clients = new Map();
    this.admins = new Map();
    this.connectionRequests = new Map();
  }

  setManagers(clientManager, adminManager, queueManager, historyManager) {
    this.clientManager = clientManager;
    this.adminManager = adminManager;
    this.queueManager = queueManager;
    this.historyManager = historyManager;
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'register_admin':
        this.adminManager.registerAdmin(ws, data);
        break;
      case 'register_client':
        this.clientManager.registerClient(ws, data);
        break;
      case 'admin_connect_request':
        this.handleAdminConnectRequest(ws, data);
        break;
      case 'client_response':
        this.handleClientResponse(ws, data);
        break;
      case 'heartbeat':
        this.handleHeartbeat(ws, data);
        break;
      case 'get_client_history':
        this.historyManager.getClientHistory(ws, data);
        break;
      case 'cancel_connection_request':
        this.cancelConnectionRequest(ws, data);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  handleAdminConnectRequest(ws, data) {
    const { clientId, offerData, priority = 'normal' } = data;
    const requestId = require('uuid').v4();
    const client = this.clientManager.getClient(clientId);
    
    this.connectionRequests.set(requestId, {
      clientId,
      adminId: ws.adminId,
      offerData,
      timestamp: Date.now(),
      status: 'pending',
      priority
    });

    if (!client || client.status !== 'online') {
      this.queueManager.queueConnectionRequest(clientId, requestId, ws.adminId, offerData);
      
      ws.send(JSON.stringify({
        type: 'connection_request_queued',
        requestId,
        clientId,
        message: 'Client is offline. Request queued for when client comes online.'
      }));
      
      console.log(`Connection request queued for offline client ${clientId} from admin ${ws.adminId}`);
      return;
    }

    this.sendConnectionRequestToClient(requestId, client, ws.adminId, offerData);
    
    ws.send(JSON.stringify({
      type: 'connection_request_sent',
      requestId,
      clientId
    }));

    console.log(`Admin ${ws.adminId} requesting connection to client ${clientId}`);
  }

  sendConnectionRequestToClient(requestId, client, adminId, offerData) {
    client.ws.send(JSON.stringify({
      type: 'admin_connection_request',
      requestId,
      adminId,
      offerData,
      timestamp: Date.now()
    }));
  }

  handleClientResponse(ws, data) {
    const { requestId, accepted, answerData } = data;
    const clientId = ws.clientId;
    const request = this.connectionRequests.get(requestId);
    
    if (!request) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Connection request not found or expired'
      }));
      return;
    }

    request.status = accepted ? 'accepted' : 'rejected';
    
    const admin = this.adminManager.getAdmin(request.adminId);
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

    this.historyManager.recordConnectionHistory(clientId, request.adminId, accepted ? 'accepted' : 'rejected');
    
    setTimeout(() => {
      this.connectionRequests.delete(requestId);
    }, 60000);
    
    console.log(`Client ${clientId} ${accepted ? 'accepted' : 'rejected'} connection from admin ${request.adminId}`);
  }

  cancelConnectionRequest(ws, data) {
    const { requestId } = data;
    const request = this.connectionRequests.get(requestId);
    
    if (request && request.adminId === ws.adminId) {
      request.status = 'cancelled';
      
      const client = this.clientManager.getClient(request.clientId);
      if (client && client.status === 'online') {
        client.ws.send(JSON.stringify({
          type: 'connection_request_cancelled',
          requestId
        }));
      }
      
      this.connectionRequests.delete(requestId);
      
      ws.send(JSON.stringify({
        type: 'connection_request_cancelled',
        requestId,
        success: true
      }));
    }
  }

  handleHeartbeat(ws, data) {
    const { id, role } = data;
    
    if (role === 'admin' && this.adminManager.hasAdmin(id)) {
      this.adminManager.updateLastSeen(id);
    } else if (role === 'client' && this.clientManager.hasClient(id)) {
      const client = this.clientManager.getClient(id);
      this.clientManager.updateLastSeen(id);
      
      if (client.status === 'offline') {
        this.clientManager.setClientOnline(id);
        
        const admin = this.adminManager.getAdmin(client.adminId);
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

  cleanupConnection(ws) {
    if (ws.adminId) {
      console.log(`Admin disconnected: ${ws.adminId}`);
      this.adminManager.setAdminOffline(ws.adminId);
    }
    
    if (ws.clientId) {
      console.log(`Client disconnected: ${ws.clientId}`);
      this.clientManager.setClientOffline(ws.clientId);
    }
  }

  getConnectionRequests() {
    return this.connectionRequests;
  }

  processQueuedRequestsForClient(clientId) {
    const client = this.clientManager.getClient(clientId);
    if (!client) return;
    
    const queuedRequests = this.queueManager.getQueuedRequests(clientId);
    if (!queuedRequests || queuedRequests.length === 0) return;
    
    console.log(`Processing ${queuedRequests.length} queued requests for client ${clientId}`);
    
    queuedRequests.forEach(queuedRequest => {
      const { requestId, adminId, offerData } = queuedRequest;
      
      const request = this.connectionRequests.get(requestId);
      if (request) {
        request.status = 'sent';
        this.sendConnectionRequestToClient(requestId, client, adminId, offerData);
        
        const admin = this.adminManager.getAdmin(adminId);
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
    
    this.queueManager.clearQueue(clientId);
  }
}

module.exports = ConnectionManager;
