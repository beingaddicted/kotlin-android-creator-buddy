
class AdminManager {
  constructor() {
    this.admins = new Map();
  }

  setManagers(clientManager, historyManager) {
    this.clientManager = clientManager;
    this.historyManager = historyManager;
  }

  registerAdmin(ws, data) {
    const { adminId, organizationId } = data;
    
    const existingAdmin = this.admins.get(adminId);
    const previousClientIds = existingAdmin ? existingAdmin.clientIds : [];
    
    this.admins.set(adminId, {
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

    this.sendEnhancedClientList(adminId);
    this.sendPendingNotifications(adminId);
  }

  getAdmin(adminId) {
    return this.admins.get(adminId);
  }

  hasAdmin(adminId) {
    return this.admins.has(adminId);
  }

  updateLastSeen(adminId) {
    const admin = this.admins.get(adminId);
    if (admin) {
      admin.lastSeen = Date.now();
    }
  }

  setAdminOffline(adminId) {
    const admin = this.admins.get(adminId);
    if (admin) {
      admin.lastSeen = Date.now();
    }
  }

  sendEnhancedClientList(adminId) {
    const admin = this.admins.get(adminId);
    if (!admin) return;

    const clientList = admin.clientIds.map(clientId => {
      const client = this.clientManager.getClient(clientId);
      const history = this.historyManager.getHistory(clientId) || [];
      const pendingRequests = 0; // Would need connection manager reference
      
      return {
        clientId,
        userName: client?.userName || 'Unknown',
        status: client?.status || 'offline',
        lastSeen: client?.lastSeen || 0,
        connectionHistory: history.slice(-5),
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

  sendPendingNotifications(adminId) {
    const admin = this.admins.get(adminId);
    if (!admin) return;
    
    const notifications = [];
    
    admin.clientIds.forEach(clientId => {
      const client = this.clientManager.getClient(clientId);
      if (client && client.status === 'online') {
        const timeSinceOnline = Date.now() - client.lastSeen;
        if (timeSinceOnline < 300000) {
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

  getAllAdmins() {
    return this.admins;
  }
}

module.exports = AdminManager;
