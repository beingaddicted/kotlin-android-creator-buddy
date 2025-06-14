
import { CryptoUtils } from './CryptoUtils';

export class SecureStorage {
  private static storageKey: CryptoKey | null = null;

  // Initialize storage encryption key
  static async initialize(): Promise<void> {
    const stored = localStorage.getItem('storage_key');
    
    if (stored) {
      try {
        const keyData = CryptoUtils.base64ToArrayBuffer(stored);
        this.storageKey = await CryptoUtils.importAESKey(keyData);
        console.log('SecureStorage: Loaded existing storage key');
      } catch (error) {
        console.warn('SecureStorage: Failed to load key, generating new one');
        await this.generateNewKey();
      }
    } else {
      await this.generateNewKey();
    }
  }

  private static async generateNewKey(): Promise<void> {
    this.storageKey = await CryptoUtils.generateAESKey();
    const keyData = await CryptoUtils.exportKey(this.storageKey);
    localStorage.setItem('storage_key', CryptoUtils.arrayBufferToBase64(keyData));
    console.log('SecureStorage: Generated new storage key');
  }

  // Encrypt and store data
  static async setItem(key: string, value: any): Promise<void> {
    if (!this.storageKey) {
      await this.initialize();
    }

    try {
      const jsonData = JSON.stringify(value);
      const { encrypted, iv } = await CryptoUtils.encryptAES(jsonData, this.storageKey!);
      
      const storageData = {
        encrypted: CryptoUtils.arrayBufferToBase64(encrypted),
        iv: CryptoUtils.arrayBufferToBase64(iv.buffer)
      };

      localStorage.setItem(`secure_${key}`, JSON.stringify(storageData));
    } catch (error) {
      console.error('SecureStorage: Failed to encrypt and store data:', error);
      throw error;
    }
  }

  // Decrypt and retrieve data
  static async getItem<T>(key: string): Promise<T | null> {
    if (!this.storageKey) {
      await this.initialize();
    }

    try {
      const stored = localStorage.getItem(`secure_${key}`);
      if (!stored) return null;

      const storageData = JSON.parse(stored);
      const encrypted = CryptoUtils.base64ToArrayBuffer(storageData.encrypted);
      const iv = new Uint8Array(CryptoUtils.base64ToArrayBuffer(storageData.iv));

      const decrypted = await CryptoUtils.decryptAES(encrypted, this.storageKey!, iv);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('SecureStorage: Failed to decrypt data:', error);
      return null;
    }
  }

  // Remove encrypted item
  static removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }

  // Clear all secure storage
  static clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem('storage_key');
    this.storageKey = null;
  }
}
