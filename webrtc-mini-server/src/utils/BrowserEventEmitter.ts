
export interface EventListener {
  (...args: any[]): void;
}

export class BrowserEventEmitter {
  private events: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const listeners = this.events.get(event) || [];
    listeners.push(listener);
    this.events.set(event, listeners);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.length === 0) {
      return false;
    }

    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`EventEmitter error in ${event}:`, error);
      }
    });

    return true;
  }

  off(event: string, listener?: EventListener): this {
    if (!listener) {
      this.events.delete(event);
      return this;
    }

    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this.events.delete(event);
        }
      }
    }
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.length : 0;
  }
}
