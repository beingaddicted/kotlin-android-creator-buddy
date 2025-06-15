
interface AnalyticsEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  sessionId: string;
}

interface UserSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  userId?: string;
  userAgent: string;
  screenResolution: string;
  connectionType?: string;
  events: AnalyticsEvent[];
  performanceMetrics: PerformanceMetric[];
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private sessionId: string;
  private currentSession: UserSession;
  private eventQueue: AnalyticsEvent[] = [];
  private performanceQueue: PerformanceMetric[] = [];
  private isInitialized = false;
  private flushInterval: number | null = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.currentSession = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      connectionType: this.getConnectionType(),
      events: [],
      performanceMetrics: []
    };
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  initialize(userId?: string) {
    if (this.isInitialized) return;

    this.currentSession.userId = userId;
    this.isInitialized = true;

    // Start periodic flush
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, 30000); // Flush every 30 seconds

    // Track initial page load
    this.trackEvent('page_load', {
      url: window.location.href,
      referrer: document.referrer,
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart
    });

    // Set up performance monitoring
    this.setupPerformanceMonitoring();

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });

    // Handle visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('page_hidden', { timestamp: Date.now() });
      } else {
        this.trackEvent('page_visible', { timestamp: Date.now() });
      }
    });

    console.log('Analytics service initialized for session:', this.sessionId);
  }

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  getConnectionType(): string {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
    return connection ? connection.effectiveType || 'unknown' : 'unknown';
  }

  trackEvent(name: string, properties: Record<string, any> = {}) {
    if (!this.isInitialized) return;

    const event: AnalyticsEvent = {
      name,
      properties: {
        ...properties,
        url: window.location.href,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.currentSession.userId
    };

    this.eventQueue.push(event);
    this.currentSession.events.push(event);

    console.log('Analytics event tracked:', name, properties);

    // Auto-flush if queue is large
    if (this.eventQueue.length >= 50) {
      this.flush();
    }
  }

  trackPerformance(name: string, value: number) {
    if (!this.isInitialized) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.performanceQueue.push(metric);
    this.currentSession.performanceMetrics.push(metric);

    console.log('Performance metric tracked:', name, value);
  }

  setupPerformanceMonitoring() {
    // Monitor Core Web Vitals
    this.trackCoreWebVitals();

    // Monitor resource loading
    this.trackResourceTiming();

    // Monitor navigation timing
    this.trackNavigationTiming();
  }

  trackCoreWebVitals() {
    // Track Largest Contentful Paint (LCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.trackPerformance('lcp', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // Track First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        this.trackPerformance('fid', entry.processingStart - entry.startTime);
      }
    }).observe({ entryTypes: ['first-input'] });

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      this.trackPerformance('cls', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });
  }

  trackResourceTiming() {
    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource');
      
      resources.forEach((resource: any) => {
        this.trackPerformance(`resource_${resource.initiatorType}_duration`, resource.duration);
        this.trackPerformance(`resource_${resource.initiatorType}_size`, resource.transferSize || 0);
      });
    });
  }

  trackNavigationTiming() {
    window.addEventListener('load', () => {
      const timing = performance.timing;
      
      this.trackPerformance('dns_lookup', timing.domainLookupEnd - timing.domainLookupStart);
      this.trackPerformance('tcp_connection', timing.connectEnd - timing.connectStart);
      this.trackPerformance('server_response', timing.responseEnd - timing.requestStart);
      this.trackPerformance('dom_processing', timing.domComplete - timing.domLoading);
      this.trackPerformance('page_load_total', timing.loadEventEnd - timing.navigationStart);
    });
  }

  flush() {
    if (this.eventQueue.length === 0 && this.performanceQueue.length === 0) {
      return;
    }

    // Store locally for offline scenarios
    this.storeDataLocally();

    // Send to analytics service (in production)
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalyticsService();
    }

    // Clear queues
    this.eventQueue = [];
    this.performanceQueue = [];
  }

  storeDataLocally() {
    try {
      const analyticsData = {
        events: this.eventQueue,
        performance: this.performanceQueue,
        session: this.currentSession,
        timestamp: Date.now()
      };

      localStorage.setItem(`analytics_${this.sessionId}`, JSON.stringify(analyticsData));
    } catch (error) {
      console.error('Failed to store analytics data locally:', error);
    }
  }

  async sendToAnalyticsService() {
    try {
      // In production, send to your analytics service
      // Example: Google Analytics, Mixpanel, Amplitude, etc.
      const data = {
        events: this.eventQueue,
        performance: this.performanceQueue,
        session: this.currentSession
      };

      console.log('Would send analytics data:', data);

      // Example fetch call:
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });

    } catch (error) {
      console.error('Failed to send analytics data:', error);
    }
  }

  endSession() {
    this.currentSession.endTime = Date.now();
    this.trackEvent('session_end', {
      duration: this.currentSession.endTime - this.currentSession.startTime,
      eventCount: this.currentSession.events.length,
      performanceMetricCount: this.currentSession.performanceMetrics.length
    });

    this.flush();

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }

  // WebRTC specific tracking methods
  trackWebRTCEvent(eventType: string, data: any) {
    this.trackEvent(`webrtc_${eventType}`, {
      ...data,
      category: 'webrtc'
    });
  }

  trackConnectionAttempt(peerId: string, success: boolean, duration?: number) {
    this.trackEvent('webrtc_connection_attempt', {
      peerId,
      success,
      duration: duration || 0,
      category: 'webrtc_connection'
    });
  }

  trackSignalingEvent(eventType: string, peerId: string) {
    this.trackEvent('webrtc_signaling', {
      eventType,
      peerId,
      category: 'webrtc_signaling'
    });
  }

  trackLocationShare(success: boolean, error?: string) {
    this.trackEvent('location_share', {
      success,
      error: error || null,
      category: 'location'
    });
  }

  trackUserAction(action: string, context: Record<string, any> = {}) {
    this.trackEvent('user_action', {
      action,
      ...context,
      category: 'user_interaction'
    });
  }
}

// Export singleton instance
export const analytics = AnalyticsService.getInstance();
