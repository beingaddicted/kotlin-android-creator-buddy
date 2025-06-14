
import { CryptoUtils } from './CryptoUtils';

export interface DeviceCredentials {
  deviceId: string;
  publicKey: ArrayBuffer;
  privateKey: CryptoKey;
  certificate: string;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthChallenge {
  challenge: string;
  timestamp: number;
  requesterDeviceId: string;
}

export interface AuthResponse {
  challenge: string;
  signature: string;
  deviceId: string;
  certificate: string;
  timestamp: number;
}

export class DeviceAuth {
  private credentials: DeviceCredentials | null = null;
  private trustedDevices = new Map<string, ArrayBuffer>(); // deviceId -> publicKey

  async initializeDevice(deviceId: string, organizationId: string): Promise<void> {
    // Check if credentials already exist
    const stored = this.loadCredentials(deviceId);
    if (stored && stored.expiresAt > Date.now()) {
      this.credentials = stored;
      console.log('DeviceAuth: Loaded existing credentials');
      return;
    }

    // Generate new credentials
    const keyPair = await CryptoUtils.generateRSAKeyPair();
    const publicKeyBuffer = await CryptoUtils.exportKey(keyPair.publicKey);
    
    const certificate = this.generateCertificate(deviceId, organizationId, publicKeyBuffer);
    
    this.credentials = {
      deviceId,
      publicKey: publicKeyBuffer,
      privateKey: keyPair.privateKey,
      certificate,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
    };

    this.saveCredentials(this.credentials);
    console.log('DeviceAuth: Generated new device credentials');
  }

  private generateCertificate(deviceId: string, organizationId: string, publicKey: ArrayBuffer): string {
    const cert = {
      deviceId,
      organizationId,
      publicKey: CryptoUtils.arrayBufferToBase64(publicKey),
      issuedAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
    };
    
    return btoa(JSON.stringify(cert));
  }

  async generateChallenge(requesterDeviceId: string): Promise<AuthChallenge> {
    return {
      challenge: CryptoUtils.generateChallenge(),
      timestamp: Date.now(),
      requesterDeviceId
    };
  }

  async respondToChallenge(challenge: AuthChallenge): Promise<AuthResponse | null> {
    if (!this.credentials) {
      console.error('DeviceAuth: No credentials available for challenge response');
      return null;
    }

    try {
      const signature = await CryptoUtils.signRSA(challenge.challenge, this.credentials.privateKey);
      
      return {
        challenge: challenge.challenge,
        signature: CryptoUtils.arrayBufferToBase64(signature),
        deviceId: this.credentials.deviceId,
        certificate: this.credentials.certificate,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('DeviceAuth: Failed to respond to challenge:', error);
      return null;
    }
  }

  async verifyAuthResponse(response: AuthResponse, originalChallenge: string): Promise<boolean> {
    try {
      // Verify challenge matches
      if (response.challenge !== originalChallenge) {
        console.warn('DeviceAuth: Challenge mismatch');
        return false;
      }

      // Parse certificate
      const cert = JSON.parse(atob(response.certificate));
      
      // Check certificate expiry
      if (cert.expiresAt < Date.now()) {
        console.warn('DeviceAuth: Certificate expired');
        return false;
      }

      // Import public key from certificate
      const publicKeyBuffer = CryptoUtils.base64ToArrayBuffer(cert.publicKey);
      const publicKey = await CryptoUtils.importRSAPublicKey(publicKeyBuffer);

      // Verify signature
      const signatureBuffer = CryptoUtils.base64ToArrayBuffer(response.signature);
      const isValid = await CryptoUtils.verifyRSA(signatureBuffer, response.challenge, publicKey);

      if (isValid) {
        // Add to trusted devices
        this.trustedDevices.set(response.deviceId, publicKeyBuffer);
        console.log('DeviceAuth: Device authenticated successfully:', response.deviceId);
      }

      return isValid;
    } catch (error) {
      console.error('DeviceAuth: Failed to verify auth response:', error);
      return false;
    }
  }

  isDeviceTrusted(deviceId: string): boolean {
    return this.trustedDevices.has(deviceId);
  }

  getDevicePublicKey(deviceId: string): ArrayBuffer | null {
    return this.trustedDevices.get(deviceId) || null;
  }

  getCurrentDeviceId(): string | null {
    return this.credentials?.deviceId || null;
  }

  getCertificate(): string | null {
    return this.credentials?.certificate || null;
  }

  private saveCredentials(credentials: DeviceCredentials): void {
    try {
      // We can't directly serialize CryptoKey, so we'll regenerate it on load
      const storageData = {
        deviceId: credentials.deviceId,
        publicKey: CryptoUtils.arrayBufferToBase64(credentials.publicKey),
        certificate: credentials.certificate,
        issuedAt: credentials.issuedAt,
        expiresAt: credentials.expiresAt
      };
      
      localStorage.setItem(`device_credentials_${credentials.deviceId}`, JSON.stringify(storageData));
    } catch (error) {
      console.error('DeviceAuth: Failed to save credentials:', error);
    }
  }

  private loadCredentials(deviceId: string): DeviceCredentials | null {
    try {
      const stored = localStorage.getItem(`device_credentials_${deviceId}`);
      if (!stored) return null;

      const data = JSON.parse(stored);
      // Note: We can't restore the private key from storage for security reasons
      // In a real implementation, you'd use secure key storage or regenerate
      return null; // Force regeneration for now
    } catch (error) {
      console.error('DeviceAuth: Failed to load credentials:', error);
      return null;
    }
  }

  clearCredentials(): void {
    if (this.credentials) {
      localStorage.removeItem(`device_credentials_${this.credentials.deviceId}`);
    }
    this.credentials = null;
    this.trustedDevices.clear();
  }
}
