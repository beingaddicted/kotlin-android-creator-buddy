
import { WebRTCMessage } from './types';

export class SecurityMessageHandler {
  static isSecurityMessage(data: any): boolean {
    return data && 
           typeof data === 'object' &&
           ['auth-challenge', 'auth-response', 'secure-message'].includes(data.type);
  }

  static async handleSecurityMessage(message: WebRTCMessage, peerId: string): Promise<void> {
    if (!window.securityManager) {
      console.warn('SecurityMessageHandler: Security message received but no security manager available');
      return;
    }

    // Validate network access before processing security messages
    if (!window.securityManager.validateNetworkAccess(peerId, 'network_communication')) {
      console.warn('SecurityMessageHandler: Unauthorized network access attempt from', peerId);
      return;
    }

    switch (message.type) {
      case 'auth-challenge':
        await window.securityManager.handleAuthChallenge(message.data);
        break;
        
      case 'auth-response':
        console.log('SecurityMessageHandler: Auth response received from', peerId);
        // Mark device as authenticated if response is valid
        const isValid = await window.securityManager.handleAuthResponse(
          message.data, 
          '' // Would need to store original challenge
        );
        if (isValid) {
          console.log('SecurityMessageHandler: Device authenticated successfully');
        }
        break;
        
      case 'secure-message':
        const decrypted = await window.securityManager.decryptMessage(message);
        if (decrypted) {
          // Emit event for decrypted message processing
          const event = new CustomEvent('webrtc-decrypted-message', {
            detail: { 
              type: decrypted.type,
              data: decrypted.message,
              timestamp: message.timestamp,
              fromPeerId: peerId
            }
          });
          window.dispatchEvent(event);
        }
        break;
    }
  }

  static checkMessagePermissions(message: WebRTCMessage, peerId: string): boolean {
    if (!window.securityManager) return true;

    // Check if device is authenticated for sensitive operations
    if (!window.securityManager.isDeviceTrusted(peerId)) {
      console.warn('SecurityMessageHandler: Untrusted device attempting operation:', peerId);
      return false;
    }

    switch (message.type) {
      case 'location-request':
        return window.securityManager.validateNetworkAccess(peerId, 'request_location');
      case 'mesh-data':
        return window.securityManager.validateNetworkAccess(peerId, 'share_data');
      case 'join-org':
        return window.securityManager.validateNetworkAccess(peerId, 'join_network');
      default:
        return true;
    }
  }

  static requiresPermission(messageType: string): boolean {
    return ['location-request', 'mesh-data', 'join-org'].includes(messageType);
  }

  static async authenticateNewPeer(peerId: string): Promise<boolean> {
    if (!window.securityManager) return true;

    try {
      console.log('SecurityMessageHandler: Authenticating new peer:', peerId);
      return await window.securityManager.authenticateDevice(peerId);
    } catch (error) {
      console.error('SecurityMessageHandler: Peer authentication failed:', error);
      return false;
    }
  }

  static validateQRAccess(qrData: any): boolean {
    if (!window.securityManager) return true;

    // Validate network token if present
    if (qrData.networkToken) {
      return window.securityManager.validateNetworkToken(qrData.networkToken);
    }

    return true;
  }
}
