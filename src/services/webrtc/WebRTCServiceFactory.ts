
import { WebRTCServiceCore } from './WebRTCServiceCore';
import { WebRTCServerManager } from './WebRTCServerManager';
import { WebRTCClientManager } from './WebRTCClientManager';
import { WebRTCEventManager } from './WebRTCEventManager';
import { WebRTCDiagnosticManager } from './WebRTCDiagnosticManager';

export class WebRTCServiceFactory {
  static createService() {
    const core = new WebRTCServiceCore();
    
    const serverManager = new WebRTCServerManager(
      core.webrtcConnection,
      core.connectionManager,
      core.offerManager,
      core.autoReconnectionManager
    );
    
    const clientManager = new WebRTCClientManager(
      core.webrtcConnection,
      core.connectionManager,
      core.reconnectionManager,
      core.offerManager
    );
    
    const diagnosticManager = new WebRTCDiagnosticManager();
    
    const eventManager = new WebRTCEventManager(
      core.webrtcConnection,
      core.connectionManager,
      core.reconnectionManager,
      core.autoReconnectionManager,
      core.ipChangeManager,
      core.eventHandler,
      false
    );

    return {
      core,
      serverManager,
      clientManager,
      eventManager,
      diagnosticManager
    };
  }
}
