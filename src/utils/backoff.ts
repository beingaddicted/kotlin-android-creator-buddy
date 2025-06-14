
/**
 * Exponential backoff utility with jitter and max interval.
 * Resets interval on success.
 */
export class ExponentialBackoff {
  private initialInterval: number;
  private maxInterval: number;
  private multiplier: number;
  private currentInterval: number;

  constructor(initial = 2000, max = 30000, multiplier = 2) {
    this.initialInterval = initial;
    this.maxInterval = max;
    this.multiplier = multiplier;
    this.currentInterval = initial;
  }

  getNextInterval() {
    // Add some jitter (randomness)
    const jitter = Math.random() * this.currentInterval * 0.25;
    const interval = Math.min(this.currentInterval + jitter, this.maxInterval);
    this.currentInterval = Math.min(this.currentInterval * this.multiplier, this.maxInterval);
    return interval;
  }

  reset() {
    this.currentInterval = this.initialInterval;
  }
}
