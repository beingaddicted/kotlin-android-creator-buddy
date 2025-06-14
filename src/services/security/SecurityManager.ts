
import { DeviceAuth, AuthChallenge, AuthResponse } from './DeviceAuth';
import { SecureStorage } from './SecureStorage';
import { SecureMessaging } from './SecureMessaging';
import { AccessControl, Role, Permission, AccessToken } from './AccessControl';
import { WebRTCMessage } from '../webrtc/types';

export class SecurityManager {
  private deviceAuth: DeviceAuth;
  private secureMessaging: SecureMessaging;
  private accessControl: AccessControl;
  private currentAccessToken: AccessToken | null = null;
  private isInitialized = false;

  constructor() {
    this.deviceAuth = new DeviceAuth();
    this.secureMessaging = new SecureMessaging(this.deviceAuth);
    this.accessControl = new AccessControl();
  }

  // Initialize security manager
  async initialize(deviceId: string, organizationId: string, role: Role = 'member'): Promise<void> {
    try {
      // Initialize secure storage
      await SecureStorage.initialize();
      
      // Initialize device authentication
      await this.deviceAuth.initializeDevice(deviceId, organizationId);
      
      // Create access token
      this.currentAccessToken = AccessControl.createAccessToken(
        deviceId,
        role,
        organizationId
      );

      // Store access token securely
      await SecureStorage.setItem('access_token', this.currentAccessToken);
      
      this.isInitialized = true;
      console.log('SecurityManager: Initialized successfully');
    } catch (error) {
      console.error('SecurityManager: Failed to initialize:', error);
      throw error;
    }
  }

  // Authenticate a device
  async authenticateDevice(deviceId: string): Promise<boolean> {
    if (!this.isInitialized) {
      console.error('SecurityManager: Not initialized');
      return false;
    }

    try {
      // Generate challenge
      const challenge = await this.deviceAuth.generateChallenge(deviceId);
      
      // Send challenge (this would be sent via WebRTC)
      const challengeMessage: WebRTCMessage = {
        type: 'auth-challenge',
        data: challenge,
        timestamp: Date.now(),
        senderDeviceId: this.deviceAuth.getCurrentDeviceId()
      };

      // Dispatch event to send challenge
      const event = new CustomEvent('webrtc-send-message', {
        detail: { message: challengeMessage, targetDeviceId: deviceId }
      });
      window.dispatchEvent(event);

      return true;
    } catch (error) {
      console.error('SecurityManager: Failed to authenticate device:', error);
      return false;
    }
  }

  // Handle authentication challenge
  async handleAuthChallenge(challenge: AuthChallenge): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const response = await this.deviceAuth.respondToChallenge(challenge);
      if (!response) return;

      const responseMessage: WebRTCMessage = {
        type: 'auth-response',
        data: response,
        timestamp: Date.now(),
        senderDeviceId: this.deviceAuth.getCurrentDeviceId()
      };

      // Send response
      const event = new CustomEvent('webrtc-send-message', {
        detail: { message: responseMessage, targetDeviceId: challenge.requesterDeviceId }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('SecurityManager: Failed to handle auth challenge:', error);
    }
  }

  // Handle authentication response
  async handleAuthResponse(response: AuthResponse, originalChallenge: string): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      const isValid = await this.deviceAuth.verifyAuthResponse(response, originalChallenge);
      
      if (isValid) {
        console.log('SecurityManager: Device authenticated successfully:', response.deviceId);
        
        // Dispatch authentication success event
        const event = new CustomEvent('device-authenticated', {
          detail: { deviceId: response.deviceId, certificate: response.certificate }
        });
        window.dispatchEvent(event);
      }

      return isValid;
    } catch (error) {
      console.error('SecurityManager: Failed to handle auth response:', error);
      return false;
    }
  }

  // Encrypt message for sending
  async encryptMessage(message: any, recipientDeviceId: string, messageType: string): Promise<WebRTCMessage | null> {
    if (!this.isInitialized) return null;

    try {
      const secureMessage = await this.secureMessaging.encryptMessage(message, recipientDeviceId, messageType);
      if (!secureMessage) return null;

      return {
        type: 'secure-message',
        data: secureMessage,
        timestamp: Date.now(),
        encrypted: true,
        senderDeviceId: this.deviceAuth.getCurrentDeviceId()
      };
    } catch (error) {
      console.error('SecurityManager: Failed to encrypt message:', error);
      return null;
    }
  }

  // Decrypt received message
  async decryptMessage(webrtcMessage: WebRTCMessage): Promise<{ message: any; type: string } | null> {
    if (!this.isInitialized || !webrtcMessage.encrypted) return null;

    try {
      return await this.secureMessaging.decryptMessage(webrtcMessage.data);
    } catch (error) {
      console.error('SecurityManager: Failed to decrypt message:', error);
      return null;
    }
  }

  // Check permission
  hasPermission(permission: Permission): boolean {
    if (!this.currentAccessToken) return false;
    return AccessControl.hasPermission(this.currentAccessToken, permission);
  }

  // Request location access
  requestLocationAccess(targetDeviceId: string, reason?: string): string | null {
    if (!this.isInitialized || !this.currentAccessToken) return null;

    return this.accessControl.requestLocationAccess(
      this.currentAccessToken.deviceId,
      'Device User', // Would get actual name from device info
      targetDeviceId,
      reason
    );
  }

  // Approve location request
  approveLocationRequest(requestId: string, duration?: number): boolean {
    if (!this.hasPermission('location.request')) return false;
    return this.accessControl.approveLocationRequest(requestId, duration);
  }

  // Deny location request
  denyLocationRequest(requestId: string, reason?: string): boolean {
    if (!this.hasPermission('location.request')) return false;
    return this.accessControl.denyLocationRequest(requestId, reason);
  }

  // Check if device can access location
  canAccessLocation(requesterId: string): boolean {
    return this.accessControl.hasTemporaryLocationAccess(requesterId);
  }

  // Get pending location requests
  getPendingLocationRequests(): any[] {
    if (!this.currentAccessToken) return [];
    return this.accessControl.getPendingLocationRequests(this.currentAccessToken.deviceId);
  }

  // Store data securely
  async secureStore(key: string, data: any): Promise<void> {
    await SecureStorage.setItem(key, data);
  }

  // Retrieve secure data
  async secureRetrieve<T>(key: string): Promise<T | null> {
    return await SecureStorage.getItem<T>(key);
  }

  // Cleanup expired data
  cleanup(): void {
    this.secureMessaging.cleanupExpiredKeys();
    this.accessControl.cleanupExpiredRequests();
  }

  // Get current device ID
  getCurrentDeviceId(): string | null {
    return this.deviceAuth.getCurrentDeviceId();
  }

  // Check if device is trusted
  isDeviceTrusted(deviceId: string): boolean {
    return this.deviceAuth.isDeviceTrusted(deviceId);
  }

  // Get current role
  getCurrentRole(): Role | null {
    return this.currentAccessToken?.role || null;
  }

  // Update role (admin only)
  async updateRole(newRole: Role): Promise<boolean> {
    if (!this.hasPermission('admin.promote') && !this.hasPermission('admin.demote')) {
      return false;
    }

    if (!this.currentAccessToken) return false;

    this.currentAccessToken = AccessControl.createAccessToken(
      this.currentAccessToken.deviceId,
      newRole,
      this.currentAccessToken.organizationId
    );

    await SecureStorage.setItem('access_token', this.currentAccessToken);
    return true;
  }

  // Shutdown security manager
  async shutdown(): Promise<void> {
    this.accessControl.clear();
    this.secureMessaging.clearSessionKeys();
    this.deviceAuth.clearCredentials();
    this.currentAccessToken = null;
    this.isInitialized = false;
  }
}
