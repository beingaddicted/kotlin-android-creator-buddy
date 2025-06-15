
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCServiceCore } from './WebRTCServiceCore';
import { WebRTCServerManager } from './WebRTCServerManager';

export class WebRTCServiceEventSetup {
  constructor(
    private eventManager: WebRTCEventManager,
    private core: WebRTCServiceCore,
    private serverManager: WebRTCServerManager
  ) {}

  setupEventManagerCallbacks(forceReconnectCallback: () => Promise<void>): void {
    this.eventManager.onSendUpdatedOfferToAllClients = async (newIP: string) => {
      if (this.core.isAdmin) {
        await this.serverManager.sendUpdatedOfferToAllClients(newIP);
      }
    };

    this.eventManager.onSendUpdatedOfferToClient = async (clientId: string) => {
      if (this.core.isAdmin) {
        await this.serverManager.sendUpdatedOfferToClient(clientId);
      }
    };

    this.eventManager.onAttemptReconnection = async (peerId: string) => {
      await forceReconnectCallback();
    };

    this.eventManager.getLastServerOffer = () => {
      return this.core.offerManager.getLastServerOffer();
    };

    this.eventManager.organizationId = this.core.organizationId;

    this.eventManager.setupConnectionHandlers();
    this.eventManager.setupIPChangeHandling();
  }
}
