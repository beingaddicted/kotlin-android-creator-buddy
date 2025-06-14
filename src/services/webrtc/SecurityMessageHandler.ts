
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

    switch (message.type) {
      case 'auth-challenge':
        await window.securityManager.handleAuthChallenge(message.data);
        break;
        
      case 'auth-response':
        console.log('SecurityMessageHandler: Auth response received from', peerId);
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

    switch (message.type) {
      case 'location-request':
        return window.securityManager.canAccessLocation(peerId);
      case 'mesh-data':
        return window.securityManager.isDeviceTrusted(peerId);
      default:
        return true;
    }
  }

  static requiresPermission(messageType: string): boolean {
    return ['location-request', 'mesh-data'].includes(messageType);
  }
}
