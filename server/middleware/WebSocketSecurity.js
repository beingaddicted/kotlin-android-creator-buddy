
class WebSocketSecurity {
  constructor(ddosProtection) {
    this.ddosProtection = ddosProtection;
    this.authenticatedSockets = new Map(); // socketId -> authData
  }

  // Validate WebSocket upgrade request
  validateUpgrade(request, socket, head) {
    const ip = this.ddosProtection.getClientIP(request);
    
    // Check if IP is blacklisted
    if (this.ddosProtection.isBlacklisted(ip)) {
      console.log(`WebSocket Security: Rejected blacklisted IP ${ip}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return false;
    }

    // Check connection limits
    const connectionCheck = this.ddosProtection.canAcceptConnection(ip, this.getActiveConnectionCount());
    if (!connectionCheck.allowed) {
      console.log(`WebSocket Security: Rejected connection from ${ip} - ${connectionCheck.reason}`);
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return false;
    }

    return true;
  }

  // Validate incoming message
  validateMessage(ws, message, ip) {
    try {
      // Check message rate limits
      const rateCheck = this.ddosProtection.canSendMessage(ip);
      if (!rateCheck.allowed) {
        console.log(`WebSocket Security: Rate limited message from ${ip} - ${rateCheck.reason}`);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Rate limit exceeded' 
        }));
        return false;
      }

      // Parse and validate message
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (e) {
        console.log(`WebSocket Security: Invalid JSON from ${ip}`);
        this.ddosProtection.recordViolation(ip);
        return false;
      }

      // Check message size
      if (!this.ddosProtection.isValidMessageSize(parsedMessage)) {
        console.log(`WebSocket Security: Message too large from ${ip}`);
        this.ddosProtection.recordViolation(ip);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Message too large' 
        }));
        return false;
      }

      // Validate message structure
      if (!this.isValidMessageStructure(parsedMessage)) {
        console.log(`WebSocket Security: Invalid message structure from ${ip}`);
        this.ddosProtection.recordViolation(ip);
        return false;
      }

      return { valid: true, message: parsedMessage };
    } catch (error) {
      console.error('WebSocket Security: Message validation error:', error);
      this.ddosProtection.recordViolation(ip);
      return false;
    }
  }

  // Validate message structure
  isValidMessageStructure(message) {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // Required fields
    if (!message.type || typeof message.type !== 'string') {
      return false;
    }

    // Valid message types
    const validTypes = [
      'join-admin', 'join-org', 'location', 'member-status',
      'location-request', 'mesh-data', 'auth-challenge',
      'auth-response', 'secure-message'
    ];

    if (!validTypes.includes(message.type)) {
      return false;
    }

    // Check for required timestamp
    if (!message.timestamp || typeof message.timestamp !== 'number') {
      return false;
    }

    // Validate timestamp is reasonable (not too old or in future)
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    if (message.timestamp < now - maxAge || message.timestamp > now + 60000) {
      return false;
    }

    return true;
  }

  // Track authenticated socket
  authenticateSocket(socketId, authData) {
    this.authenticatedSockets.set(socketId, {
      ...authData,
      authenticatedAt: Date.now()
    });
  }

  // Check if socket is authenticated
  isAuthenticated(socketId) {
    return this.authenticatedSockets.has(socketId);
  }

  // Remove socket authentication
  removeAuthentication(socketId) {
    this.authenticatedSockets.delete(socketId);
  }

  // Get active connection count
  getActiveConnectionCount() {
    // This would be implemented by the WebSocket server
    return 0;
  }

  // Clean up expired authentications
  cleanupAuthentications() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [socketId, authData] of this.authenticatedSockets.entries()) {
      if (now - authData.authenticatedAt > maxAge) {
        this.authenticatedSockets.delete(socketId);
      }
    }
  }
}

module.exports = WebSocketSecurity;
