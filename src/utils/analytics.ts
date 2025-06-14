
// Analytics and error tracking utilities
export class Analytics {
  private static isProduction = process.env.NODE_ENV === 'production';

  static trackEvent(eventName: string, properties?: Record<string, any>) {
    if (!this.isProduction) {
      console.log('Analytics Event:', eventName, properties);
      return;
    }

    // In production, you would integrate with your analytics provider
    // Example: analytics.track(eventName, properties);
  }

  static trackError(error: Error, context?: Record<string, any>) {
    console.error('Error tracked:', error, context);
    
    if (!this.isProduction) return;

    // In production, you would send to error tracking service
    // Example: Sentry.captureException(error, { extra: context });
  }

  static trackPerformance(metric: string, value: number) {
    if (!this.isProduction) {
      console.log(`Performance metric: ${metric} = ${value}ms`);
      return;
    }

    // In production, send to analytics
    // Example: analytics.track('performance', { metric, value });
  }

  static setUser(userId: string, properties?: Record<string, any>) {
    if (!this.isProduction) {
      console.log('User identified:', userId, properties);
      return;
    }

    // In production, identify user
    // Example: analytics.identify(userId, properties);
  }
}
