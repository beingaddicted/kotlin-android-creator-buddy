
import { WebRTCServerOffer } from './types';
import { WebRTCConnection } from './WebRTCConnection';

export class WebRTCOfferManager {
  private lastServerOffer: WebRTCServerOffer | null = null;

  async createServerOffer(
    connection: WebRTCConnection,
    organizationId: string,
    organizationName: string,
    adminId: string,
    serverIp: string
  ): Promise<WebRTCServerOffer> {
    const offer = await connection.createOffer();

    const serverOffer: WebRTCServerOffer = {
      type: 'webrtc_server_offer',
      offer,
      adminId,
      organizationId,
      organizationName,
      timestamp: Date.now(),
      serverIp
    };

    this.lastServerOffer = serverOffer;
    return serverOffer;
  }

  async createUpdatedOffer(
    connection: WebRTCConnection,
    newIP: string,
    options?: RTCOfferOptions
  ): Promise<WebRTCServerOffer | null> {
    if (!this.lastServerOffer) return null;

    try {
      const offer = await connection.createOffer(options);
      
      const newServerOffer: WebRTCServerOffer = {
        ...this.lastServerOffer,
        offer,
        timestamp: Date.now(),
        serverIp: newIP
      };
      
      this.lastServerOffer = newServerOffer;
      return newServerOffer;
    } catch (error) {
      console.error('Failed to create updated offer:', error);
      return null;
    }
  }

  getLastServerOffer(): WebRTCServerOffer | null {
    return this.lastServerOffer;
  }

  setLastServerOffer(offer: WebRTCServerOffer): void {
    this.lastServerOffer = offer;
  }

  clearLastServerOffer(): void {
    this.lastServerOffer = null;
  }
}
