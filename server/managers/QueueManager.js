
class QueueManager {
  constructor() {
    this.queuedRequests = new Map();
  }

  queueConnectionRequest(clientId, requestId, adminId, offerData) {
    if (!this.queuedRequests.has(clientId)) {
      this.queuedRequests.set(clientId, []);
    }
    
    this.queuedRequests.get(clientId).push({
      requestId,
      adminId,
      offerData,
      timestamp: Date.now()
    });
    
    const queue = this.queuedRequests.get(clientId);
    if (queue.length > 10) {
      const removed = queue.shift();
      // Would need connection manager reference to delete from connectionRequests
    }
  }

  getQueuedRequests(clientId) {
    return this.queuedRequests.get(clientId) || [];
  }

  clearQueue(clientId) {
    this.queuedRequests.delete(clientId);
  }

  cleanupStaleRequests(requestTimeout) {
    const now = Date.now();
    
    for (const [clientId, queue] of this.queuedRequests) {
      const validRequests = queue.filter(req => now - req.timestamp < requestTimeout);
      if (validRequests.length !== queue.length) {
        if (validRequests.length > 0) {
          this.queuedRequests.set(clientId, validRequests);
        } else {
          this.queuedRequests.delete(clientId);
        }
      }
    }
  }

  getQueueStats() {
    return Array.from(this.queuedRequests.values()).reduce((sum, queue) => sum + queue.length, 0);
  }

  getAllQueuedRequests() {
    return this.queuedRequests;
  }
}

module.exports = QueueManager;
