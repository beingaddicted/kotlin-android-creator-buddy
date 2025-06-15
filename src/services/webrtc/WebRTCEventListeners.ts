
export class WebRTCEventListeners {
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];

  setupEventListeners(
    forceReconnect: () => Promise<void>,
    handlePermanentConnectionLoss: (event: CustomEvent) => void
  ): void {
    const reconnectHandler = forceReconnect.bind(null);
    const connectionLossHandler = handlePermanentConnectionLoss as EventListener;

    window.addEventListener('webrtc-client-reconnection-needed', reconnectHandler);
    window.addEventListener('webrtc-connection-lost', connectionLossHandler);

    this.eventListeners.push(
      { element: window, event: 'webrtc-client-reconnection-needed', handler: reconnectHandler },
      { element: window, event: 'webrtc-connection-lost', handler: connectionLossHandler }
    );
  }

  cleanup(): void {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}
