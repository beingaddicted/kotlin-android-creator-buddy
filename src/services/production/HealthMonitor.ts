
interface HealthMetric {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  value: number;
  threshold: number;
  timestamp: number;
  details?: string;
}

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  metrics: HealthMetric[];
  timestamp: number;
  uptime: number;
}

interface HealthThresholds {
  memoryUsage: number;
  renderTime: number;
  errorRate: number;
  connectionFailureRate: number;
  batteryLevel: number;
  networkLatency: number;
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private isMonitoring = false;
  private metrics: HealthMetric[] = [];
  private startTime = Date.now();
  private monitoringInterval: number | null = null;
  private errorCount = 0;
  private totalOperations = 0;
  private connectionAttempts = 0;
  private connectionFailures = 0;
  private onHealthChangeCallbacks: ((status: HealthStatus) => void)[] = [];

  private thresholds: HealthThresholds = {
    memoryUsage: 50 * 1024 * 1024, // 50MB
    renderTime: 100, // 100ms
    errorRate: 0.05, // 5%
    connectionFailureRate: 0.1, // 10%
    batteryLevel: 0.2, // 20%
    networkLatency: 1000 // 1 second
  };

  private constructor() {}

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('Health monitoring started');

    // Check health every 30 seconds
    this.monitoringInterval = window.setInterval(() => {
      this.checkHealth();
    }, 30000);

    // Initial health check
    this.checkHealth();

    // Monitor battery if available
    this.monitorBattery();

    // Monitor network changes
    this.monitorNetwork();
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('Health monitoring stopped');
  }

  onHealthChange(callback: (status: HealthStatus) => void) {
    this.onHealthChangeCallbacks.push(callback);
  }

  private async checkHealth() {
    this.metrics = [];

    // Check memory usage
    await this.checkMemoryUsage();

    // Check performance
    this.checkPerformance();

    // Check error rate
    this.checkErrorRate();

    // Check connection health
    this.checkConnectionHealth();

    // Check network connectivity
    await this.checkNetworkConnectivity();

    // Generate overall health status
    const healthStatus = this.generateHealthStatus();

    // Notify listeners
    this.onHealthChangeCallbacks.forEach(callback => {
      try {
        callback(healthStatus);
      } catch (error) {
        console.error('Error in health change callback:', error);
      }
    });

    // Log critical issues
    const criticalMetrics = this.metrics.filter(m => m.status === 'critical');
    if (criticalMetrics.length > 0) {
      console.warn('Critical health issues detected:', criticalMetrics);
      
      // Emit event for error reporting
      window.dispatchEvent(new CustomEvent('health-critical', {
        detail: { metrics: criticalMetrics, timestamp: Date.now() }
      }));
    }
  }

  private async checkMemoryUsage() {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMemory = memInfo.usedJSHeapSize;
      
      const metric: HealthMetric = {
        name: 'memory_usage',
        status: usedMemory > this.thresholds.memoryUsage ? 'critical' : 'healthy',
        value: usedMemory,
        threshold: this.thresholds.memoryUsage,
        timestamp: Date.now(),
        details: `${(usedMemory / 1024 / 1024).toFixed(2)} MB used`
      };

      this.metrics.push(metric);
    }
  }

  private checkPerformance() {
    // Get recent performance entries
    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const navigation = navigationEntries[0] as PerformanceNavigationTiming;
      const loadTime = navigation.loadEventEnd - navigation.fetchStart;

      const metric: HealthMetric = {
        name: 'page_load_time',
        status: loadTime > this.thresholds.renderTime * 10 ? 'warning' : 'healthy',
        value: loadTime,
        threshold: this.thresholds.renderTime * 10,
        timestamp: Date.now(),
        details: `${loadTime.toFixed(2)}ms load time`
      };

      this.metrics.push(metric);
    }
  }

  private checkErrorRate() {
    const errorRate = this.totalOperations > 0 ? this.errorCount / this.totalOperations : 0;
    
    const metric: HealthMetric = {
      name: 'error_rate',
      status: errorRate > this.thresholds.errorRate ? 'critical' : 
              errorRate > this.thresholds.errorRate / 2 ? 'warning' : 'healthy',
      value: errorRate,
      threshold: this.thresholds.errorRate,
      timestamp: Date.now(),
      details: `${(errorRate * 100).toFixed(2)}% error rate (${this.errorCount}/${this.totalOperations})`
    };

    this.metrics.push(metric);
  }

  private checkConnectionHealth() {
    const connectionFailureRate = this.connectionAttempts > 0 ? 
      this.connectionFailures / this.connectionAttempts : 0;
    
    const metric: HealthMetric = {
      name: 'connection_failure_rate',
      status: connectionFailureRate > this.thresholds.connectionFailureRate ? 'critical' : 
              connectionFailureRate > this.thresholds.connectionFailureRate / 2 ? 'warning' : 'healthy',
      value: connectionFailureRate,
      threshold: this.thresholds.connectionFailureRate,
      timestamp: Date.now(),
      details: `${(connectionFailureRate * 100).toFixed(2)}% failure rate (${this.connectionFailures}/${this.connectionAttempts})`
    };

    this.metrics.push(metric);
  }

  private async checkNetworkConnectivity() {
    const startTime = performance.now();
    
    try {
      const response = await fetch('/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const latency = performance.now() - startTime;
      
      const metric: HealthMetric = {
        name: 'network_latency',
        status: latency > this.thresholds.networkLatency ? 'warning' : 'healthy',
        value: latency,
        threshold: this.thresholds.networkLatency,
        timestamp: Date.now(),
        details: `${latency.toFixed(2)}ms latency, status: ${response.status}`
      };

      this.metrics.push(metric);
    } catch (error) {
      const metric: HealthMetric = {
        name: 'network_connectivity',
        status: 'critical',
        value: 0,
        threshold: 1,
        timestamp: Date.now(),
        details: 'Network connectivity failed'
      };

      this.metrics.push(metric);
    }
  }

  private async monitorBattery() {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        
        const checkBatteryLevel = () => {
          const metric: HealthMetric = {
            name: 'battery_level',
            status: battery.level < this.thresholds.batteryLevel ? 'warning' : 'healthy',
            value: battery.level,
            threshold: this.thresholds.batteryLevel,
            timestamp: Date.now(),
            details: `${(battery.level * 100).toFixed(0)}% battery, charging: ${battery.charging}`
          };

          this.metrics.push(metric);
        };

        // Initial check
        checkBatteryLevel();

        // Listen for battery changes
        battery.addEventListener('levelchange', checkBatteryLevel);
        battery.addEventListener('chargingchange', checkBatteryLevel);
      } catch (error) {
        console.warn('Battery monitoring not available:', error);
      }
    }
  }

  private monitorNetwork() {
    window.addEventListener('online', () => {
      console.log('Network came back online');
      this.checkHealth();
    });

    window.addEventListener('offline', () => {
      console.warn('Network went offline');
      
      const metric: HealthMetric = {
        name: 'network_status',
        status: 'critical',
        value: 0,
        threshold: 1,
        timestamp: Date.now(),
        details: 'Network offline'
      };

      this.metrics.push(metric);
      
      const healthStatus = this.generateHealthStatus();
      this.onHealthChangeCallbacks.forEach(callback => callback(healthStatus));
    });
  }

  private generateHealthStatus(): HealthStatus {
    const criticalMetrics = this.metrics.filter(m => m.status === 'critical');
    const warningMetrics = this.metrics.filter(m => m.status === 'warning');

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalMetrics.length > 0) {
      overall = 'critical';
    } else if (warningMetrics.length > 0) {
      overall = 'warning';
    }

    return {
      overall,
      metrics: this.metrics,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime
    };
  }

  // Methods to track operations for health monitoring
  recordOperation(success: boolean) {
    this.totalOperations++;
    if (!success) {
      this.errorCount++;
    }
  }

  recordConnectionAttempt(success: boolean) {
    this.connectionAttempts++;
    if (!success) {
      this.connectionFailures++;
    }
  }

  getCurrentHealthStatus(): HealthStatus {
    return this.generateHealthStatus();
  }

  getHealthMetrics(): HealthMetric[] {
    return [...this.metrics];
  }

  updateThresholds(newThresholds: Partial<HealthThresholds>) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Health thresholds updated:', this.thresholds);
  }
}

export const healthMonitor = HealthMonitor.getInstance();
