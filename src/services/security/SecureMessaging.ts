
import { CryptoUtils } from './CryptoUtils';
import { DeviceAuth } from './DeviceAuth';

export interface SecureMessage {
  encrypted: string;
  iv: string;
  signature: string;
  senderDeviceId: string;
  timestamp: number;
  originalType: string;
}

export interface SessionKey {
  key: CryptoKey;
  deviceId: string;
  createdAt: number;
  expiresAt: number;
}

export class SecureMessaging {
  private sessionKeys = new Map<string, SessionKey>(); // deviceId -> SessionKey
  private deviceAuth: DeviceAuth;

  constructor(deviceAuth: DeviceAuth) {
    this.deviceAuth = deviceAuth;
  }

  // Generate or get session key for a device
  async getOrCreateSessionKey(deviceId: string): Promise<SessionKey> {
    const existing = this.sessionKeys.get(deviceId);
    
    if (existing && existing.expiresAt > Date.now()) {
      return existing;
    }

    // Generate new session key
    const key = await CryptoUtils.generateAESKey();
    const sessionKey: SessionKey = {
      key,
      deviceId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    this.sessionKeys.set(deviceId, sessionKey);
    console.log('SecureMessaging: Created new session key for', deviceId);
    
    return sessionKey;
  }

  // Encrypt a message for a specific device
  async encryptMessage(message: any, recipientDeviceId: string, messageType: string): Promise<SecureMessage | null> {
    try {
      const currentDeviceId = this.deviceAuth.getCurrentDeviceId();
      if (!currentDeviceId) {
        console.error('SecureMessaging: No device credentials available');
        return null;
      }

      // Check if recipient is trusted
      if (!this.deviceAuth.isDeviceTrusted(recipientDeviceId)) {
        console.error('SecureMessaging: Recipient device not trusted:', recipientDeviceId);
        return null;
      }

      const sessionKey = await this.getOrCreateSessionKey(recipientDeviceId);
      const messageJson = JSON.stringify(message);

      // Encrypt the message
      const { encrypted, iv } = await CryptoUtils.encryptAES(messageJson, sessionKey.key);

      // Sign the encrypted message
      const signature = await CryptoUtils.signRSA(
        CryptoUtils.arrayBufferToBase64(encrypted),
        await this.getPrivateKey()
      );

      return {
        encrypted: CryptoUtils.arrayBufferToBase64(encrypted),
        iv: CryptoUtils.arrayBufferToBase64(iv.buffer),
        signature: CryptoUtils.arrayBufferToBase64(signature),
        senderDeviceId: currentDeviceId,
        timestamp: Date.now(),
        originalType: messageType
      };
    } catch (error) {
      console.error('SecureMessaging: Failed to encrypt message:', error);
      return null;
    }
  }

  // Decrypt a received message
  async decryptMessage(secureMessage: SecureMessage): Promise<{ message: any; type: string } | null> {
    try {
      // Verify sender is trusted
      if (!this.deviceAuth.isDeviceTrusted(secureMessage.senderDeviceId)) {
        console.error('SecureMessaging: Sender device not trusted:', secureMessage.senderDeviceId);
        return null;
      }

      // Get session key for sender
      const sessionKey = await this.getOrCreateSessionKey(secureMessage.senderDeviceId);

      // Verify signature
      const senderPublicKey = this.deviceAuth.getDevicePublicKey(secureMessage.senderDeviceId);
      if (!senderPublicKey) {
        console.error('SecureMessaging: No public key for sender');
        return null;
      }

      const publicKey = await CryptoUtils.importRSAPublicKey(senderPublicKey);
      const signatureBuffer = CryptoUtils.base64ToArrayBuffer(secureMessage.signature);
      
      const isValidSignature = await CryptoUtils.verifyRSA(
        signatureBuffer,
        secureMessage.encrypted,
        publicKey
      );

      if (!isValidSignature) {
        console.error('SecureMessaging: Invalid message signature');
        return null;
      }

      // Decrypt the message
      const encrypted = CryptoUtils.base64ToArrayBuffer(secureMessage.encrypted);
      const iv = new Uint8Array(CryptoUtils.base64ToArrayBuffer(secureMessage.iv));

      const decrypted = await CryptoUtils.decryptAES(encrypted, sessionKey.key, iv);
      const message = JSON.parse(decrypted);

      return {
        message,
        type: secureMessage.originalType
      };
    } catch (error) {
      console.error('SecureMessaging: Failed to decrypt message:', error);
      return null;
    }
  }

  // Encrypt message for broadcast (multiple recipients)
  async encryptForBroadcast(message: any, recipientDeviceIds: string[], messageType: string): Promise<Map<string, SecureMessage>> {
    const encryptedMessages = new Map<string, SecureMessage>();

    for (const deviceId of recipientDeviceIds) {
      const encrypted = await this.encryptMessage(message, deviceId, messageType);
      if (encrypted) {
        encryptedMessages.set(deviceId, encrypted);
      }
    }

    return encryptedMessages;
  }

  // Clean up expired session keys
  cleanupExpiredKeys(): void {
    const now = Date.now();
    const expiredKeys = Array.from(this.sessionKeys.entries())
      .filter(([, key]) => key.expiresAt <= now)
      .map(([deviceId]) => deviceId);

    expiredKeys.forEach(deviceId => {
      this.sessionKeys.delete(deviceId);
      console.log('SecureMessaging: Cleaned up expired session key for', deviceId);
    });
  }

  // Get current device's private key (would need to be implemented based on storage)
  private async getPrivateKey(): Promise<CryptoKey> {
    // This is a placeholder - in reality, you'd retrieve the private key securely
    // For now, we'll throw an error to indicate this needs proper implementation
    throw new Error('Private key retrieval not implemented - needs secure key storage');
  }

  // Clear all session keys
  clearSessionKeys(): void {
    this.sessionKeys.clear();
  }
}
