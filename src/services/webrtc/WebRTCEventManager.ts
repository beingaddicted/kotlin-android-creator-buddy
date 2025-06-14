
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { ReconnectionManager } from './ReconnectionManager';
import { AutoReconnectionManager } from './AutoReconnectionManager';
import { IPChangeManager } from './IPChangeManager';
import { WebRTCEventHandler } from './WebRTCEventHandler';
import { WebRTCConnectionEventHandler } from './WebRTCConnectionEventHandler';
import { WebRTCIPEventHandler } from './WebRTCIPEventHandler';

export class WebRTCEventManager {
  private connectionEventHandler: WebRTCConnectionEventHandler;
  private ipEventHandler: WebRTCIPEventHandler;
  private isAdmin: boolean;

  constructor(
    webrtcConnection: WebRTCConnection,
    connectionManager: ConnectionManager,
    reconnectionManager: ReconnectionManager,
    autoReconnectionManager: AutoReconnectionManager,
    ipChangeManager: IPChangeManager,
    eventHandler: WebRTCEventHandler,
    isAdmin: boolean
  ) {
    this.isAdmin = isAdmin;

    this.connectionEventHandler = new WebRTCConnectionEventHandler(
      webrtcConnection,
      connectionManager,
      reconnectionManager,
      autoReconnectionManager,
      ipChangeManager,
      eventHandler,
      isAdmin
    );

    this.ipEventHandler = new WebRTCIPEventHandler(
      connectionManager,
      reconnectionManager,
      ipChangeManager,
      isAdmin
    );
  }

  setupConnectionHandlers(): void {
    this.connectionEventHandler.setupConnectionHandlers();
  }

  setupIPChangeHandling(): void {
    this.ipEventHandler.setupIPChangeHandling();
  }

  // Callback handlers - these will be set by WebRTCService
  set onSendUpdatedOfferToAllClients(callback: (newIP: string) => Promise<void>) {
    this.connectionEventHandler.onSendUpdatedOfferToAllClients = callback;
    this.ipEventHandler.onSendUpdatedOfferToAllClients = callback;
  }

  set onSendUpdatedOfferToClient(callback: (clientId: string) => Promise<void>) {
    this.connectionEventHandler.onSendUpdatedOfferToClient = callback;
    this.ipEventHandler.onSendUpdatedOfferToClient = callback;
  }

  set onAttemptReconnection(callback: (peerId: string) => Promise<void>) {
    this.connectionEventHandler.onAttemptReconnection = callback;
  }

  set getLastServerOffer(callback: () => any) {
    this.connectionEventHandler.getLastServerOffer = callback;
    this.ipEventHandler.getLastServerOffer = callback;
  }

  set organizationId(id: string | null) {
    this.connectionEventHandler.organizationId = id;
  }
}
