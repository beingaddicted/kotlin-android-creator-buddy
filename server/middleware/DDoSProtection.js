
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

class DDoSProtection {
  constructor() {
    this.connectionCounts = new Map(); // IP -> connection count
    this.messageCounts = new Map(); // IP -> { count, resetTime }
    this.blacklistedIPs = new Set();
    this.suspiciousActivity = new Map(); // IP -> { violations, lastViolation }
    
    // Configuration
    this.config = {
      maxConnectionsPerIP: 10,
      maxTotalConnections: 1000,
      messageRateLimit: 100, // messages per minute
      maxMessageSize: 65536, // 64KB
      violationThreshold: 5,
      blacklistDuration: 3600000, // 1 hour
      cleanupInterval: 300000 // 5 minutes
    };

    this.startCleanupTimer();
  }

  // Create rate limiter for HTTP requests
  createHTTPRateLimiter() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.recordViolation(this.getClientIP(req));
        res.status(429).json({ error: 'Rate limit exceeded' });
      }
    });
  }

  // Create speed limiter for HTTP requests
  createSpeedLimiter() {
    return slowDown({
      windowMs: 60 * 1000, // 1 minute
      delayAfter: 50, // allow 50 requests per minute at full speed
      delayMs: 100 // add 100ms delay per request after delayAfter
    });
  }

  // Check if IP is blacklisted
  isBlacklisted(ip) {
    return this.blacklistedIPs.has(ip);
  }

  // Add IP to blacklist
  blacklistIP(ip, reason = 'DDoS protection') {
    console.log(`DDoS Protection: Blacklisting IP ${ip} - ${reason}`);
    this.blacklistedIPs.add(ip);
    
    // Auto-remove after blacklist duration
    setTimeout(() => {
      this.blacklistedIPs.delete(ip);
      console.log(`DDoS Protection: Removed IP ${ip} from blacklist`);
    }, this.config.blacklistDuration);
  }

  // Check connection limits
  canAcceptConnection(ip, totalConnections) {
    if (this.isBlacklisted(ip)) {
      return { allowed: false, reason: 'IP blacklisted' };
    }

    if (totalConnections >= this.config.maxTotalConnections) {
      return { allowed: false, reason: 'Server at capacity' };
    }

    const ipConnections = this.connectionCounts.get(ip) || 0;
    if (ipConnections >= this.config.maxConnectionsPerIP) {
      this.recordViolation(ip);
      return { allowed: false, reason: 'Too many connections from IP' };
    }

    return { allowed: true };
  }

  // Track new connection
  trackConnection(ip) {
    const current = this.connectionCounts.get(ip) || 0;
    this.connectionCounts.set(ip, current + 1);
  }

  // Track connection close
  trackDisconnection(ip) {
    const current = this.connectionCounts.get(ip) || 0;
    if (current > 0) {
      this.connectionCounts.set(ip, current - 1);
    }
  }

  // Check message rate limits
  canSendMessage(ip) {
    if (this.isBlacklisted(ip)) {
      return { allowed: false, reason: 'IP blacklisted' };
    }

    const now = Date.now();
    const messageData = this.messageCounts.get(ip);

    if (!messageData || now > messageData.resetTime) {
      // Reset or initialize counter
      this.messageCounts.set(ip, {
        count: 1,
        resetTime: now + 60000 // 1 minute window
      });
      return { allowed: true };
    }

    if (messageData.count >= this.config.messageRateLimit) {
      this.recordViolation(ip);
      return { allowed: false, reason: 'Message rate limit exceeded' };
    }

    messageData.count++;
    return { allowed: true };
  }

  // Check message size
  isValidMessageSize(message) {
    const size = Buffer.byteLength(JSON.stringify(message), 'utf8');
    return size <= this.config.maxMessageSize;
  }

  // Record security violation
  recordViolation(ip) {
    const violations = this.suspiciousActivity.get(ip) || { violations: 0, lastViolation: 0 };
    violations.violations++;
    violations.lastViolation = Date.now();
    this.suspiciousActivity.set(ip, violations);

    if (violations.violations >= this.config.violationThreshold) {
      this.blacklistIP(ip, `Multiple violations (${violations.violations})`);
    }
  }

  // Get client IP from request/socket
  getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '0.0.0.0';
  }

  // Cleanup expired data
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  cleanup() {
    const now = Date.now();
    
    // Clean up old message counters
    for (const [ip, data] of this.messageCounts.entries()) {
      if (now > data.resetTime) {
        this.messageCounts.delete(ip);
      }
    }

    // Clean up old violation records (older than 1 hour)
    for (const [ip, data] of this.suspiciousActivity.entries()) {
      if (now - data.lastViolation > 3600000) {
        this.suspiciousActivity.delete(ip);
      }
    }

    // Clean up zero connection counts
    for (const [ip, count] of this.connectionCounts.entries()) {
      if (count <= 0) {
        this.connectionCounts.delete(ip);
      }
    }
  }

  // Get protection statistics
  getStats() {
    return {
      blacklistedIPs: this.blacklistedIPs.size,
      activeConnections: Array.from(this.connectionCounts.values()).reduce((a, b) => a + b, 0),
      connectionsByIP: Object.fromEntries(this.connectionCounts),
      suspiciousIPs: this.suspiciousActivity.size,
      totalViolations: Array.from(this.suspiciousActivity.values())
        .reduce((total, data) => total + data.violations, 0)
    };
  }
}

module.exports = DDoSProtection;
