class MonitoringAndAlerting {
  constructor() {
    this.metrics = {
      connectionsPerSecond: [],
      messagesPerSecond: [],
      errorRate: [],
      blockedConnections: 0,
      totalConnections: 0,
      totalMessages: 0,
      startTime: Date.now()
    };

    this.alerts = [];
    this.thresholds = {
      maxConnectionsPerSecond: 50,
      maxMessagesPerSecond: 1000,
      maxErrorRate: 0.1, // 10%
      maxBlockedConnectionsPerMinute: 100
    };

    this.startMetricsCollection();
  }

  // Record connection event
  recordConnection(blocked = false) {
    this.metrics.totalConnections++;
    if (blocked) {
      this.metrics.blockedConnections++;
    }

    this.updateConnectionsPerSecond();
    this.checkConnectionAlerts();
  }

  // Record message event
  recordMessage() {
    this.metrics.totalMessages++;
    this.updateMessagesPerSecond();
    this.checkMessageAlerts();
  }

  // Record error
  recordError() {
    const now = Date.now();
    this.metrics.errorRate.push(now);
    this.checkErrorAlerts();
  }

  // Update connections per second metric
  updateConnectionsPerSecond() {
    const now = Date.now();
    this.metrics.connectionsPerSecond.push(now);
    
    // Keep only last 60 seconds
    this.metrics.connectionsPerSecond = this.metrics.connectionsPerSecond
      .filter(time => now - time < 60000);
  }

  // Update messages per second metric
  updateMessagesPerSecond() {
    const now = Date.now();
    this.metrics.messagesPerSecond.push(now);
    
    // Keep only last 60 seconds
    this.metrics.messagesPerSecond = this.metrics.messagesPerSecond
      .filter(time => now - time < 60000);
  }

  // Check for connection-based alerts
  checkConnectionAlerts() {
    const connectionsLastSecond = this.metrics.connectionsPerSecond
      .filter(time => Date.now() - time < 1000).length;

    if (connectionsLastSecond > this.thresholds.maxConnectionsPerSecond) {
      this.triggerAlert('HIGH_CONNECTION_RATE', {
        rate: connectionsLastSecond,
        threshold: this.thresholds.maxConnectionsPerSecond
      });
    }

    // Check blocked connections in last minute
    const blockedLastMinute = this.metrics.blockedConnections;
    if (blockedLastMinute > this.thresholds.maxBlockedConnectionsPerMinute) {
      this.triggerAlert('HIGH_BLOCKED_CONNECTIONS', {
        blocked: blockedLastMinute,
        threshold: this.thresholds.maxBlockedConnectionsPerMinute
      });
    }
  }

  // Check for message-based alerts
  checkMessageAlerts() {
    const messagesLastSecond = this.metrics.messagesPerSecond
      .filter(time => Date.now() - time < 1000).length;

    if (messagesLastSecond > this.thresholds.maxMessagesPerSecond) {
      this.triggerAlert('HIGH_MESSAGE_RATE', {
        rate: messagesLastSecond,
        threshold: this.thresholds.maxMessagesPerSecond
      });
    }
  }

  // Check for error rate alerts
  checkErrorAlerts() {
    const now = Date.now();
    const errorsLastMinute = this.metrics.errorRate
      .filter(time => now - time < 60000).length;
    
    const messagesLastMinute = this.metrics.messagesPerSecond
      .filter(time => now - time < 60000).length;

    if (messagesLastMinute > 0) {
      const errorRate = errorsLastMinute / messagesLastMinute;
      if (errorRate > this.thresholds.maxErrorRate) {
        this.triggerAlert('HIGH_ERROR_RATE', {
          errorRate: errorRate,
          threshold: this.thresholds.maxErrorRate,
          errors: errorsLastMinute,
          messages: messagesLastMinute
        });
      }
    }
  }

  // Trigger alert
  triggerAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: Date.now(),
      id: `${type}_${Date.now()}`
    };

    this.alerts.push(alert);
    console.warn(`🚨 SECURITY ALERT [${type}]:`, data);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Emit alert event
    process.emit('security-alert', alert);
  }

  // Get current metrics
  getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;

    return {
      uptime,
      totalConnections: this.metrics.totalConnections,
      totalMessages: this.metrics.totalMessages,
      blockedConnections: this.metrics.blockedConnections,
      connectionsPerSecond: this.metrics.connectionsPerSecond
        .filter(time => now - time < 1000).length,
      messagesPerSecond: this.metrics.messagesPerSecond
        .filter(time => now - time < 1000).length,
      errorRate: this.calculateErrorRate(),
      recentAlerts: this.alerts.slice(-10)
    };
  }

  // Calculate current error rate
  calculateErrorRate() {
    const now = Date.now();
    const errorsLastMinute = this.metrics.errorRate
      .filter(time => now - time < 60000).length;
    const messagesLastMinute = this.metrics.messagesPerSecond
      .filter(time => now - time < 60000).length;

    return messagesLastMinute > 0 ? errorsLastMinute / messagesLastMinute : 0;
  }

  // Start periodic metrics collection
  startMetricsCollection() {
    // Clean up old metrics every minute
    setInterval(() => {
      const now = Date.now();
      
      // Clean up connection metrics (keep 5 minutes)
      this.metrics.connectionsPerSecond = this.metrics.connectionsPerSecond
        .filter(time => now - time < 300000);
      
      // Clean up message metrics (keep 5 minutes)
      this.metrics.messagesPerSecond = this.metrics.messagesPerSecond
        .filter(time => now - time < 300000);
      
      // Clean up error metrics (keep 5 minutes)
      this.metrics.errorRate = this.metrics.errorRate
        .filter(time => now - time < 300000);
      
      // Reset blocked connections counter every minute
      this.metrics.blockedConnections = 0;
    }, 60000);
  }
}

module.exports = MonitoringAndAlerting;
