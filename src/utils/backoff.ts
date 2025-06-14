
/**
 * Enhanced exponential backoff utility with jitter, max interval, and advanced configuration.
 * Supports different backoff strategies and provides detailed metrics.
 */
export interface BackoffConfig {
  initial?: number;
  max?: number;
  multiplier?: number;
  jitterFactor?: number;
  strategy?: 'exponential' | 'linear' | 'fibonacci';
}

export interface BackoffMetrics {
  totalAttempts: number;
  totalWaitTime: number;
  lastAttemptTime: number;
  currentStreak: number;
  averageInterval: number;
}

export class ExponentialBackoff {
  private initialInterval: number;
  private maxInterval: number;
  private multiplier: number;
  private jitterFactor: number;
  private strategy: 'exponential' | 'linear' | 'fibonacci';
  private currentInterval: number;
  private metrics: BackoffMetrics;
  private fibonacciSequence: number[] = [1, 1];

  constructor(config: BackoffConfig = {}) {
    this.initialInterval = config.initial || 2000;
    this.maxInterval = config.max || 30000;
    this.multiplier = config.multiplier || 2;
    this.jitterFactor = config.jitterFactor || 0.25;
    this.strategy = config.strategy || 'exponential';
    this.currentInterval = this.initialInterval;
    
    this.metrics = {
      totalAttempts: 0,
      totalWaitTime: 0,
      lastAttemptTime: 0,
      currentStreak: 0,
      averageInterval: this.initialInterval
    };
  }

  getNextInterval(): number {
    const baseInterval = this.calculateBaseInterval();
    const jitter = Math.random() * baseInterval * this.jitterFactor;
    const interval = Math.min(baseInterval + jitter, this.maxInterval);
    
    this.updateMetrics(interval);
    this.updateCurrentInterval();
    
    return interval;
  }

  private calculateBaseInterval(): number {
    switch (this.strategy) {
      case 'linear':
        return this.initialInterval + (this.metrics.currentStreak * 1000);
      case 'fibonacci':
        return this.getFibonacciInterval();
      case 'exponential':
      default:
        return this.currentInterval;
    }
  }

  private getFibonacciInterval(): number {
    const index = Math.min(this.metrics.currentStreak, 20); // Cap at reasonable index
    
    while (this.fibonacciSequence.length <= index) {
      const next = this.fibonacciSequence[this.fibonacciSequence.length - 1] + 
                   this.fibonacciSequence[this.fibonacciSequence.length - 2];
      this.fibonacciSequence.push(next);
    }
    
    return Math.min(this.fibonacciSequence[index] * 1000, this.maxInterval);
  }

  private updateMetrics(interval: number): void {
    this.metrics.totalAttempts++;
    this.metrics.totalWaitTime += interval;
    this.metrics.lastAttemptTime = Date.now();
    this.metrics.currentStreak++;
    this.metrics.averageInterval = this.metrics.totalWaitTime / this.metrics.totalAttempts;
  }

  private updateCurrentInterval(): void {
    if (this.strategy === 'exponential') {
      this.currentInterval = Math.min(this.currentInterval * this.multiplier, this.maxInterval);
    }
  }

  getCurrentInterval(): number {
    return this.currentInterval;
  }

  getMetrics(): BackoffMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.currentInterval = this.initialInterval;
    this.metrics = {
      totalAttempts: 0,
      totalWaitTime: 0,
      lastAttemptTime: 0,
      currentStreak: 0,
      averageInterval: this.initialInterval
    };
  }

  // Adaptive reset based on success patterns
  adaptiveReset(successRate: number): void {
    if (successRate > 0.8) {
      // High success rate, be more aggressive
      this.initialInterval = Math.max(this.initialInterval * 0.8, 1000);
    } else if (successRate < 0.3) {
      // Low success rate, be more conservative
      this.initialInterval = Math.min(this.initialInterval * 1.2, 5000);
    }
    this.reset();
  }
}
