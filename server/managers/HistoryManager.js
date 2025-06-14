
class HistoryManager {
  constructor() {
    this.connectionHistory = new Map();
  }

  recordConnectionHistory(clientId, adminId, status) {
    if (!this.connectionHistory.has(clientId)) {
      this.connectionHistory.set(clientId, []);
    }
    
    this.connectionHistory.get(clientId).push({
      adminId,
      timestamp: Date.now(),
      status
    });
    
    const history = this.connectionHistory.get(clientId);
    if (history.length > 50) {
      history.shift();
    }
  }

  getHistory(clientId) {
    return this.connectionHistory.get(clientId) || [];
  }

  getClientHistory(ws, data) {
    const { clientId } = data;
    const history = this.connectionHistory.get(clientId) || [];
    
    ws.send(JSON.stringify({
      type: 'client_history',
      clientId,
      history
    }));
  }

  getAllHistory() {
    return this.connectionHistory;
  }
}

module.exports = HistoryManager;
