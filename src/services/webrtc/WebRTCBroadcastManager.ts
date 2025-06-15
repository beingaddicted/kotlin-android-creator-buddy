
export class WebRTCBroadcastManager {
  private isListeningForAdminOnline = false;
  private organizationId: string | null = null;

  setOrganizationId(organizationId: string | null): void {
    this.organizationId = organizationId;
  }

  // Broadcast presence when admin becomes available
  broadcastAdminOnline(): void {
    try {
      const channel = new BroadcastChannel('webrtc-admin');
      channel.postMessage({
        type: 'admin-online',
        ts: Date.now(),
        orgId: this.organizationId,
      });
      channel.close();
    } catch (e) {
      console.warn('Admin online broadcast failed:', e);
    }
  }

  registerAdminOnlineListener(onAdminOnline: () => void): void {
    // Ensure we only install this listener once per client
    if (this.isListeningForAdminOnline) return;
    try {
      const channel = new BroadcastChannel('webrtc-admin');
      channel.onmessage = (event) => {
        if (
          event.data &&
          event.data.type === 'admin-online' &&
          event.data.orgId === this.organizationId
        ) {
          // Instantly trigger reconnection attempt
          console.log('Admin comeback detected. Attempting fast reconnect.');
          onAdminOnline();
        }
      };
      this.isListeningForAdminOnline = true;
    } catch (e) {
      console.warn('Could not listen for admin online events:', e);
    }
  }

  cleanup(): void {
    this.isListeningForAdminOnline = false;
  }
}
