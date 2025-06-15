
import { SecurityManager } from './SecurityManager';
import { CryptoUtils } from './CryptoUtils';
import { configService } from './ConfigurationService';

export class EnhancedSecurityManager extends SecurityManager {
  private sessionStartTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  private usedQRTokens = new Set<string>();
  private securityEventLog: Array<{
    timestamp: number;
    event: string;
    details: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  // Enhanced QR code encryption with anti-replay protection
  async encryptQRData(qrData: any): Promise<string> {
    const encryptionKey = this.getEncryptionKey();
    if (!encryptionKey) {
      throw new Error('SecurityManager: Not initialized');
    }

    try {
      // Generate one-time use token
      const oneTimeToken = CryptoUtils.generateChallenge();
      const timestamp = Date.now();
      const expiresAt = timestamp + (5 * 60 * 1000); // 5 minutes expiry

      const currentToken = this.getCurrentAccessToken();
      const secureQRData = {
        ...qrData,
        oneTimeToken,
        timestamp,
        expiresAt,
        organizationId: currentToken?.organizationId
      };

      const dataString = JSON.stringify(secureQRData);
      const { encrypted, iv } = await CryptoUtils.encryptAES(dataString, encryptionKey);
      
      // Create digital signature
      const signature = await this.createDigitalSignature(dataString);

      const encryptedQR = {
        type: 'secure_qr_v2',
        data: CryptoUtils.arrayBufferToBase64(encrypted),
        iv: CryptoUtils.arrayBufferToBase64(iv),
        signature,
        timestamp,
        expiresAt,
        organizationId: currentToken?.organizationId
      };

      this.logSecurityEvent('qr_generated', { 
        oneTimeToken: oneTimeToken.substring(0, 8) + '...',
        expiresAt 
      }, 'low');

      return JSON.stringify(encryptedQR);
    } catch (error) {
      this.logSecurityEvent('qr_encryption_failed', { error: error.message }, 'high');
      console.error('SecurityManager: Failed to encrypt QR data:', error);
      throw error;
    }
  }

  // Enhanced QR code decryption with replay attack prevention
  async decryptQRData(encryptedQRString: string): Promise<any> {
    const encryptionKey = this.getEncryptionKey();
    if (!encryptionKey) {
      throw new Error('SecurityManager: Not initialized');
    }

    try {
      const encryptedQR = JSON.parse(encryptedQRString);
      
      if (!['secure_qr', 'secure_qr_v2'].includes(encryptedQR.type)) {
        throw new Error('Invalid encrypted QR code format');
      }

      // Check expiration
      if (encryptedQR.expiresAt && Date.now() > encryptedQR.expiresAt) {
        this.logSecurityEvent('qr_expired', { timestamp: encryptedQR.timestamp }, 'medium');
        throw new Error('QR code has expired');
      }

      // Verify organization match
      const currentToken = this.getCurrentAccessToken();
      if (encryptedQR.organizationId !== currentToken?.organizationId) {
        this.logSecurityEvent('qr_org_mismatch', { 
          expected: currentToken?.organizationId,
          received: encryptedQR.organizationId 
        }, 'high');
        throw new Error('QR code is for a different organization');
      }

      const encrypted = CryptoUtils.base64ToArrayBuffer(encryptedQR.data);
      const iv = new Uint8Array(CryptoUtils.base64ToArrayBuffer(encryptedQR.iv));
      
      const decryptedString = await CryptoUtils.decryptAES(encrypted, encryptionKey, iv);
      const decryptedData = JSON.parse(decryptedString);

      // For v2 QR codes, check one-time token
      if (encryptedQR.type === 'secure_qr_v2' && decryptedData.oneTimeToken) {
        if (this.usedQRTokens.has(decryptedData.oneTimeToken)) {
          this.logSecurityEvent('qr_replay_attempt', { 
            token: decryptedData.oneTimeToken.substring(0, 8) + '...' 
          }, 'critical');
          throw new Error('QR code has already been used (replay attack detected)');
        }
        
        // Mark token as used
        this.usedQRTokens.add(decryptedData.oneTimeToken);
        
        // Clean up old tokens periodically
        if (this.usedQRTokens.size > 1000) {
          this.usedQRTokens.clear();
        }
      }

      // Verify digital signature for v2
      if (encryptedQR.signature) {
        const isValidSignature = await this.verifyDigitalSignature(decryptedString, encryptedQR.signature);
        if (!isValidSignature) {
          this.logSecurityEvent('qr_invalid_signature', {}, 'critical');
          throw new Error('QR code signature verification failed');
        }
      }

      this.logSecurityEvent('qr_decrypted', { 
        type: encryptedQR.type,
        hasToken: !!decryptedData.oneTimeToken 
      }, 'low');

      return decryptedData;
    } catch (error) {
      this.logSecurityEvent('qr_decryption_failed', { error: error.message }, 'high');
      console.error('SecurityManager: Failed to decrypt QR data:', error);
      throw error;
    }
  }

  // Session management with timeout and idle detection
  updateActivity(): void {
    this.lastActivityTime = Date.now();
  }

  checkSessionTimeout(): boolean {
    const sessionConfig = configService.getSessionConfig();
    const now = Date.now();
    
    const sessionExpired = (now - this.sessionStartTime) > sessionConfig.timeout;
    const idleExpired = (now - this.lastActivityTime) > sessionConfig.maxIdleTime;
    
    if (sessionExpired || idleExpired) {
      this.logSecurityEvent('session_timeout', { 
        sessionExpired, 
        idleExpired,
        sessionDuration: now - this.sessionStartTime,
        idleDuration: now - this.lastActivityTime
      }, 'medium');
      return true;
    }
    
    return false;
  }

  shouldShowSessionWarning(): boolean {
    const sessionConfig = configService.getSessionConfig();
    const now = Date.now();
    const timeUntilExpiry = (this.sessionStartTime + sessionConfig.timeout) - now;
    
    return timeUntilExpiry <= sessionConfig.warningTime && timeUntilExpiry > 0;
  }

  extendSession(): void {
    this.sessionStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.logSecurityEvent('session_extended', {}, 'low');
  }

  // Enhanced input validation
  validateLocationData(latitude: number, longitude: number, accuracy?: number): boolean {
    if (!configService.validateCoordinates(latitude, longitude)) {
      this.logSecurityEvent('invalid_coordinates', { latitude, longitude }, 'medium');
      return false;
    }

    // Check for impossible accuracy values
    if (accuracy !== undefined && (accuracy < 0 || accuracy > 10000)) {
      this.logSecurityEvent('invalid_accuracy', { accuracy }, 'low');
      return false;
    }

    return true;
  }

  validateOrganizationName(name: string): { valid: boolean; error?: string } {
    const result = configService.validateOrganizationName(name);
    
    if (!result.valid) {
      this.logSecurityEvent('invalid_org_name', { name: name.substring(0, 20), error: result.error }, 'medium');
    }
    
    return result;
  }

  // Security event logging
  private logSecurityEvent(
    event: string, 
    details: any, 
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    const logEntry = {
      timestamp: Date.now(),
      event,
      details,
      severity
    };

    this.securityEventLog.push(logEntry);
    
    // Keep only last 100 events
    if (this.securityEventLog.length > 100) {
      this.securityEventLog = this.securityEventLog.slice(-100);
    }

    // Log critical and high severity events to console
    if (severity === 'critical' || severity === 'high') {
      console.warn(`Security Event [${severity.toUpperCase()}]:`, event, details);
    }

    // Dispatch event for monitoring systems
    const customEvent = new CustomEvent('security-event', {
      detail: logEntry
    });
    window.dispatchEvent(customEvent);
  }

  // Create digital signature
  private async createDigitalSignature(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Use HMAC with current device ID as key
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.getCurrentDeviceId() || 'fallback-key'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', keyMaterial, dataBuffer);
      return CryptoUtils.arrayBufferToBase64(signature);
    } catch (error) {
      console.error('Failed to create digital signature:', error);
      return '';
    }
  }

  // Verify digital signature
  private async verifyDigitalSignature(data: string, signature: string): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const signatureBuffer = CryptoUtils.base64ToArrayBuffer(signature);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.getCurrentDeviceId() || 'fallback-key'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      return await crypto.subtle.verify('HMAC', keyMaterial, signatureBuffer, dataBuffer);
    } catch (error) {
      console.error('Failed to verify digital signature:', error);
      return false;
    }
  }

  // Protected methods to access parent class properties
  protected getEncryptionKey(): CryptoKey | null {
    return (this as any).encryptionKey;
  }

  protected getCurrentAccessToken(): any {
    return (this as any).currentAccessToken;
  }

  // Get security events for monitoring
  getSecurityEvents(): Array<any> {
    return [...this.securityEventLog];
  }

  // Get recent critical events
  getCriticalEvents(): Array<any> {
    return this.securityEventLog.filter(event => 
      event.severity === 'critical' || event.severity === 'high'
    );
  }

  // Override cleanup to include new features
  cleanup(): void {
    super.cleanup();
    this.usedQRTokens.clear();
    this.securityEventLog.length = 0;
  }
}
