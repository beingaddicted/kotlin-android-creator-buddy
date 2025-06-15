
interface ProductionConfig {
  features: {
    analytics: boolean;
    healthMonitoring: boolean;
    performanceMonitoring: boolean;
    errorReporting: boolean;
    offlineMode: boolean;
    debugMode: boolean;
  };
  limits: {
    maxConnections: number;
    maxRetryAttempts: number;
    connectionTimeout: number;
    messageQueueSize: number;
    cacheSize: number;
  };
  thresholds: {
    performanceWarning: number;
    memoryWarning: number;
    errorRateWarning: number;
    batteryWarning: number;
  };
  endpoints: {
    analytics: string;
    errorReporting: string;
    healthCheck: string;
    webrtcSignaling: string;
  };
  security: {
    encryptionEnabled: boolean;
    authRequired: boolean;
    rateLimitEnabled: boolean;
    corsEnabled: boolean;
  };
}

export class ConfigurationService {
  private static instance: ConfigurationService;
  private config: ProductionConfig;

  private constructor() {
    this.config = this.getDefaultConfig();
    this.loadConfiguration();
  }

  static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  private getDefaultConfig(): ProductionConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      features: {
        analytics: isProduction,
        healthMonitoring: true,
        performanceMonitoring: true,
        errorReporting: isProduction,
        offlineMode: true,
        debugMode: !isProduction
      },
      limits: {
        maxConnections: 50,
        maxRetryAttempts: 3,
        connectionTimeout: 30000,
        messageQueueSize: 1000,
        cacheSize: 100
      },
      thresholds: {
        performanceWarning: 100, // ms
        memoryWarning: 50 * 1024 * 1024, // 50MB
        errorRateWarning: 0.05, // 5%
        batteryWarning: 0.2 // 20%
      },
      endpoints: {
        analytics: '/api/analytics',
        errorReporting: '/api/errors',
        healthCheck: '/health',
        webrtcSignaling: '/ws'
      },
      security: {
        encryptionEnabled: isProduction,
        authRequired: true,
        rateLimitEnabled: isProduction,
        corsEnabled: !isProduction
      }
    };
  }

  private loadConfiguration() {
    try {
      // Load from localStorage first
      const stored = localStorage.getItem('production_config');
      if (stored) {
        const storedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...storedConfig };
      }

      // Override with environment-specific settings
      this.applyEnvironmentConfig();

      console.log('Configuration loaded:', this.config);
    } catch (error) {
      console.error('Failed to load configuration, using defaults:', error);
    }
  }

  private applyEnvironmentConfig() {
    // Apply environment-specific overrides
    if (process.env.NODE_ENV === 'development') {
      this.config.features.debugMode = true;
      this.config.features.analytics = false;
      this.config.security.corsEnabled = true;
    }

    // Check for mobile environment
    if (this.isMobileDevice()) {
      this.config.limits.maxConnections = 20; // Reduce for mobile
      this.config.limits.cacheSize = 50;
      this.config.thresholds.memoryWarning = 30 * 1024 * 1024; // 30MB for mobile
    }

    // Check for low-end device
    if (this.isLowEndDevice()) {
      this.config.features.performanceMonitoring = false;
      this.config.limits.messageQueueSize = 500;
      this.config.limits.cacheSize = 25;
    }
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private isLowEndDevice(): boolean {
    // Heuristics for detecting low-end devices
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    const memory = (navigator as any).deviceMemory || 1;
    
    return hardwareConcurrency <= 2 || memory <= 2;
  }

  getConfig(): ProductionConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ProductionConfig>) {
    this.config = { ...this.config, ...updates };
    this.saveConfiguration();
    
    // Emit configuration change event
    window.dispatchEvent(new CustomEvent('config-updated', {
      detail: this.config
    }));
  }

  private saveConfiguration() {
    try {
      localStorage.setItem('production_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  isFeatureEnabled(feature: keyof ProductionConfig['features']): boolean {
    return this.config.features[feature];
  }

  getLimit(limit: keyof ProductionConfig['limits']): number {
    return this.config.limits[limit];
  }

  getThreshold(threshold: keyof ProductionConfig['thresholds']): number {
    return this.config.thresholds[threshold];
  }

  getEndpoint(endpoint: keyof ProductionConfig['endpoints']): string {
    return this.config.endpoints[endpoint];
  }

  isSecurityEnabled(security: keyof ProductionConfig['security']): boolean {
    return this.config.security[security];
  }

  // Environment detection methods
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  isMobile(): boolean {
    return this.isMobileDevice();
  }

  isLowEnd(): boolean {
    return this.isLowEndDevice();
  }

  // Reset to defaults
  resetToDefaults() {
    this.config = this.getDefaultConfig();
    this.saveConfiguration();
    window.dispatchEvent(new CustomEvent('config-reset'));
  }
}

export const configService = ConfigurationService.getInstance();
