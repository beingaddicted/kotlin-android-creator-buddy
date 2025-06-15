export interface ConnectionHealth {
  status: 'excellent' | 'good' | 'poor' | 'critical';
  rtt: number;
  packetLoss: number;
  bitrate: number;
  jitter: number;
  lastUpdated: number;
}

export interface HealthMetrics {
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  roundTripTime: number;
  jitter: number;
  timestamp: number;
}

export class ConnectionHealthMonitor {
  private connection: RTCPeerConnection | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private previousStats: HealthMetrics | null = null;
  private healthCallbacks: ((health: ConnectionHealth) => void)[] = [];
  private isMonitoring = false;
  private lastHealth: ConnectionHealth | null = null;

  setConnection(connection: RTCPeerConnection): void {
    this.connection = connection;
  }

  startMonitoring(): void {
    if (this.isMonitoring || !this.connection) return;

    this.isMonitoring = true;
    this.healthCheckInterval = setInterval(() => {
      this.checkConnectionHealth();
    }, 5000);

    console.log('Connection health monitoring started');
  }

  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.isMonitoring = false;
    console.log('Connection health monitoring stopped');
  }

  onHealthUpdate(callback: (health: ConnectionHealth) => void): void {
    this.healthCallbacks.push(callback);
  }

  getCurrentHealth(): ConnectionHealth | null {
    return this.lastHealth;
  }

  getLastHealth(): ConnectionHealth | null {
    return this.lastHealth;
  }

  private async checkConnectionHealth(): Promise<void> {
    if (!this.connection) return;

    try {
      const stats = await this.connection.getStats();
      const currentMetrics = this.extractMetrics(stats);
      
      if (currentMetrics) {
        const health = this.calculateHealth(currentMetrics);
        this.lastHealth = health;
        this.notifyHealthCallbacks(health);
        this.previousStats = currentMetrics;
      }
    } catch (error) {
      console.error('Failed to check connection health:', error);
      const criticalHealth = {
        status: 'critical' as const,
        rtt: 0,
        packetLoss: 100,
        bitrate: 0,
        jitter: 0,
        lastUpdated: Date.now()
      };
      this.lastHealth = criticalHealth;
      this.notifyHealthCallbacks(criticalHealth);
    }
  }

  private extractMetrics(stats: RTCStatsReport): HealthMetrics | null {
    let candidatePairStats: any = null;
    let inboundStats: any = null;
    let outboundStats: any = null;

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        candidatePairStats = report;
      } else if (report.type === 'inbound-rtp' && report.kind === 'video') {
        inboundStats = report;
      } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
        outboundStats = report;
      }
    });

    if (!candidatePairStats) return null;

    return {
      bytesSent: candidatePairStats.bytesSent || 0,
      bytesReceived: candidatePairStats.bytesReceived || 0,
      packetsLost: inboundStats?.packetsLost || 0,
      roundTripTime: candidatePairStats.currentRoundTripTime || 0,
      jitter: inboundStats?.jitter || 0,
      timestamp: candidatePairStats.timestamp
    };
  }

  private calculateHealth(current: HealthMetrics): ConnectionHealth {
    const rtt = current.roundTripTime * 1000; // Convert to ms
    let bitrate = 0;
    let packetLoss = 0;

    if (this.previousStats) {
      const timeDiff = (current.timestamp - this.previousStats.timestamp) / 1000;
      const bytesDiff = current.bytesReceived - this.previousStats.bytesReceived;
      bitrate = (bytesDiff * 8) / timeDiff; // bits per second
      
      const packetsLostDiff = current.packetsLost - this.previousStats.packetsLost;
      const totalPackets = (current.bytesReceived - this.previousStats.bytesReceived) / 1200; // Approximate
      packetLoss = totalPackets > 0 ? (packetsLostDiff / totalPackets) * 100 : 0;
    }

    let status: ConnectionHealth['status'] = 'excellent';
    
    if (rtt > 300 || packetLoss > 5 || bitrate < 100000) {
      status = 'critical';
    } else if (rtt > 200 || packetLoss > 2 || bitrate < 500000) {
      status = 'poor';
    } else if (rtt > 100 || packetLoss > 0.5 || bitrate < 1000000) {
      status = 'good';
    }

    return {
      status,
      rtt,
      packetLoss,
      bitrate,
      jitter: current.jitter,
      lastUpdated: Date.now()
    };
  }

  private notifyHealthCallbacks(health: ConnectionHealth): void {
    this.healthCallbacks.forEach(callback => {
      try {
        callback(health);
      } catch (error) {
        console.error('Health callback error:', error);
      }
    });
  }

  cleanup(): void {
    this.stopMonitoring();
    this.healthCallbacks = [];
    this.previousStats = null;
    this.lastHealth = null;
  }
}
