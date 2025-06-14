
class ClientManager {
  constructor() {
    this.clients = new Map();
  }

  setManagers(adminManager, connectionManager) {
    this.adminManager = adminManager;
    this.connectionManager = connectionManager;
  }

  registerClient(ws, data) {
    const { clientId, adminId, organizationId, userName } = data;
    
    const existingClient = this.clients.get(clientId);
    const wasOffline = existingClient && existingClient.status === 'offline';
    
    this.clients.set(clientId, {
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
    
    const admin = this.adminManager.getAdmin(adminId);
    if (admin && !admin.clientIds.includes(clientId)) {
      admin.clientIds.push(clientId);
    }
    
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

    this.connectionManager.processQueuedRequestsForClient(clientId);
  }

  getClient(clientId) {
    return this.clients.get(clientId);
  }

  hasClient(clientId) {
    return this.clients.has(clientId);
  }

  updateLastSeen(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastSeen = Date.now();
    }
  }

  setClientOnline(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.status = 'online';
    }
  }

  setClientOffline(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.status = 'offline';
      client.lastSeen = Date.now();
      client.ws = null;
      
      const admin = this.adminManager.getAdmin(client.adminId);
      if (admin && admin.ws) {
        admin.ws.send(JSON.stringify({
          type: 'client_disconnected',
          clientId: clientId,
          lastSeen: client.lastSeen
        }));
      }
    }
  }

  getAllClients() {
    return this.clients;
  }

  getClientsByAdmin(adminId) {
    const admin = this.adminManager.getAdmin(adminId);
    if (!admin) return [];

    return admin.clientIds.map(clientId => {
      const client = this.clients.get(clientId);
      return {
        clientId,
        userName: client?.userName || 'Unknown',
        status: client?.status || 'offline',
        lastSeen: client?.lastSeen || 0
      };
    });
  }
}

module.exports = ClientManager;
