
export class WebRTCEventHandler {
  dispatchEvent(eventType: string, detail: any): void {
    try {
      const event = new CustomEvent(eventType, { detail });
      window.dispatchEvent(event);
      console.log(`WebRTC event dispatched: ${eventType}`, detail);
    } catch (error) {
      console.error('Failed to dispatch WebRTC event:', error);
    }
  }

  addEventListener(eventType: string, handler: EventListener): void {
    window.addEventListener(eventType, handler);
  }

  removeEventListener(eventType: string, handler: EventListener): void {
    window.removeEventListener(eventType, handler);
  }
}
