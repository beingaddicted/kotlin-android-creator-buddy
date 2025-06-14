
import { WebRTCConnection } from './WebRTCConnection';
import { ConnectionManager } from './ConnectionManager';
import { IPChangeManager } from './IPChangeManager';
import { ReconnectionManager } from './ReconnectionManager';
import { WebRTCSignaling } from './WebRTCSignaling';
import { WebRTCEventHandler } from './WebRTCEventHandler';
import { WebRTCOfferManager } from './WebRTCOfferManager';
import { AutoReconnectionManager } from './AutoReconnectionManager';

export class WebRTCServiceCore {
  public webrtcConnection = new WebRTCConnection();
  public connectionManager = new ConnectionManager();
  public ipChangeManager = new IPChangeManager();
  public reconnectionManager = new ReconnectionManager();
  public webrtcSignaling = new WebRTCSignaling();
  public eventHandler = new WebRTCEventHandler();
  public offerManager = new WebRTCOfferManager();
  public autoReconnectionManager = new AutoReconnectionManager();

  public isAdmin = false;
  public userId: string | null = null;
  public organizationId: string | null = null;

  updateStates(isAdmin: boolean, userId: string | null, organizationId: string | null): void {
    this.isAdmin = isAdmin;
    this.userId = userId;
    this.organizationId = organizationId;
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    const state = this.webrtcConnection.getConnectionState();
    
    if (state === 'connected') return 'connected';
    if (state === 'connecting') return 'connecting';
    
    return 'disconnected';
  }

  cleanup(): void {
    this.ipChangeManager.stopMonitoring();
    this.reconnectionManager.clearAllReconnections();
    this.webrtcConnection.close();
    this.connectionManager.clearPeers();
    this.offerManager.clearLastServerOffer();
  }
}
