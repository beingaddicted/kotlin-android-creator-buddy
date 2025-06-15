
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCReconnectionHandler } from './WebRTCReconnectionHandler';
import { WebRTCServerManager } from './WebRTCServerManager';
import { WebRTCClientManager } from './WebRTCClientManager';
import { WebRTCServiceCore } from './WebRTCServiceCore';

export class WebRTCManagerCollection {
  public eventManager: WebRTCEventManager;
  public reconnectionHandler: WebRTCReconnectionHandler;
  public serverManager: WebRTCServerManager;
  public clientManager: WebRTCClientManager;

  constructor(core: WebRTCServiceCore) {
    this.eventManager = new WebRTCEventManager(
      core.webrtcConnection,
      core.connectionManager,
      core.reconnectionManager,
      core.autoReconnectionManager,
      core.ipChangeManager,
      core.eventHandler,
      core.isAdmin
    );

    this.reconnectionHandler = new WebRTCReconnectionHandler(
      core.webrtcConnection,
      core.connectionManager,
      core.reconnectionManager,
      core.offerManager
    );

    this.serverManager = new WebRTCServerManager(
      core.webrtcConnection,
      core.connectionManager,
      core.offerManager,
      core.autoReconnectionManager
    );

    this.clientManager = new WebRTCClientManager(
      core.webrtcConnection,
      core.connectionManager,
      core.reconnectionManager,
      core.offerManager
    );
  }

  setupEventManagerCallbacks(core: WebRTCServiceCore): void {
    this.eventManager.onSendUpdatedOfferToAllClients = (newIP: string) => 
      this.reconnectionHandler.sendUpdatedOfferToAllClients(newIP);
    
    this.eventManager.onSendUpdatedOfferToClient = (clientId: string) => 
      this.reconnectionHandler.sendUpdatedOfferToClient(clientId);
    
    this.eventManager.onAttemptReconnection = (peerId: string) => 
      this.reconnectionHandler.attemptReconnection(peerId);
    
    this.eventManager.getLastServerOffer = () => 
      core.offerManager.getLastServerOffer();
    
    this.eventManager.organizationId = core.organizationId;
  }

  updateManagerStates(isAdmin: boolean, organizationId: string | null): void {
    (this.eventManager as any).isAdmin = isAdmin;
    (this.eventManager as any).organizationId = organizationId;
    (this.reconnectionHandler as any).isAdmin = isAdmin;
  }
}
