
import { ExponentialBackoff } from '@/utils/backoff';

export class WebRTCLongPollManager {
  private backoff: ExponentialBackoff | null = null;
  private longPollInterval: NodeJS.Timeout | null = null;

  startLongPollReconnect(
    getConnectionStatus: () => 'disconnected' | 'connecting' | 'connected',
    forceReconnect: () => Promise<void>
  ): void {
    this.stopLongPollReconnect();

    if (!this.backoff) {
      this.backoff = new ExponentialBackoff({
        initial: 2000,
        max: 30000,
        multiplier: 2
      });
    }

    const doReconnect = async () => {
      if (getConnectionStatus() !== 'connected') {
        console.log(`Reconnection attempt (interval: ${this.backoff!.getCurrentInterval()} ms)...`);
        await forceReconnect();
        this.longPollInterval = setTimeout(doReconnect, this.backoff!.getNextInterval());
      } else {
        // On success
        this.backoff!.reset();
        this.stopLongPollReconnect();
      }
    };
    this.longPollInterval = setTimeout(doReconnect, this.backoff.getNextInterval());
  }

  stopLongPollReconnect(): void {
    if (this.longPollInterval) {
      clearTimeout(this.longPollInterval);
      this.longPollInterval = null;
    }
    if (this.backoff) {
      this.backoff.reset();
    }
  }

  cleanup(): void {
    this.stopLongPollReconnect();
  }
}
