
import { DeviceAuth, AuthChallenge, AuthResponse } from './DeviceAuth';
import { SecureStorage } from './SecureStorage';
import { SecureMessaging } from './SecureMessaging';
import { AccessControl, Role, Permission, AccessToken } from './AccessControl';
import { WebRTCMessage } from '../webrtc/types';
import { CryptoUtils } from './CryptoUtils';

export class SecurityManager {
  private deviceAuth: DeviceAuth;
  private secureMessaging: SecureMessaging;
  private accessControl: AccessControl;
  private currentAccessToken: AccessToken | null = null;
  private isInitialized = false;
  private encryptionKey: CryptoKey | null = null;

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
      
      // Generate encryption key for QR codes
      this.encryptionKey = await CryptoUtils.generateAESKey();
      
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

  // Encrypt QR code data
  async encryptQRData(qrData: any): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('SecurityManager: Not initialized');
    }

    try {
      const dataString = JSON.stringify(qrData);
      const { encrypted, iv } = await CryptoUtils.encryptAES(dataString, this.encryptionKey);
      
      const encryptedQR = {
        type: 'secure_qr',
        data: CryptoUtils.arrayBufferToBase64(encrypted),
        iv: CryptoUtils.arrayBufferToBase64(iv),
        timestamp: Date.now(),
        organizationId: this.currentAccessToken?.organizationId
      };

      return JSON.stringify(encryptedQR);
    } catch (error) {
      console.error('SecurityManager: Failed to encrypt QR data:', error);
      throw error;
    }
  }

  // Decrypt QR code data
  async decryptQRData(encryptedQRString: string): Promise<any> {
    if (!this.encryptionKey) {
      throw new Error('SecurityManager: Not initialized');
    }

    try {
      const encryptedQR = JSON.parse(encryptedQRString);
      
      if (encryptedQR.type !== 'secure_qr') {
        throw new Error('Invalid encrypted QR code format');
      }

      // Verify organization match
      if (encryptedQR.organizationId !== this.currentAccessToken?.organizationId) {
        throw new Error('QR code is for a different organization');
      }

      const encrypted = CryptoUtils.base64ToArrayBuffer(encryptedQR.data);
      const iv = new Uint8Array(CryptoUtils.base64ToArrayBuffer(encryptedQR.iv));
      
      const decryptedString = await CryptoUtils.decryptAES(encrypted, this.encryptionKey, iv);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('SecurityManager: Failed to decrypt QR data:', error);
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

  // Validate network access
  validateNetworkAccess(peerId: string, action: string): boolean {
    if (!this.isInitialized || !this.currentAccessToken) {
      return false;
    }

    // Check if device is authenticated
    if (!this.deviceAuth.isDeviceTrusted(peerId)) {
      console.warn('SecurityManager: Untrusted device attempting access:', peerId);
      return false;
    }

    // Check permissions based on action
    switch (action) {
      case 'join_network':
        return this.hasPermission('network.join');
      case 'request_location':
        return this.hasPermission('location.request');
      case 'share_location':
        return this.hasPermission('location.share');
      case 'admin_action':
        return this.hasPermission('admin.manage');
      default:
        return true;
    }
  }

  // Generate secure network token
  generateNetworkToken(): string {
    if (!this.currentAccessToken) {
      throw new Error('No access token available');
    }

    const token = {
      deviceId: this.currentAccessToken.deviceId,
      organizationId: this.currentAccessToken.organizationId,
      role: this.currentAccessToken.role,
      timestamp: Date.now(),
      nonce: CryptoUtils.generateChallenge()
    };

    return btoa(JSON.stringify(token));
  }

  // Validate network token
  validateNetworkToken(tokenString: string): boolean {
    try {
      const token = JSON.parse(atob(tokenString));
      
      // Check timestamp (token valid for 1 hour)
      if (Date.now() - token.timestamp > 3600000) {
        return false;
      }

      // Check organization match
      if (token.organizationId !== this.currentAccessToken?.organizationId) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('SecurityManager: Invalid network token:', error);
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
    this.encryptionKey = null;
    this.isInitialized = false;
  }
}
