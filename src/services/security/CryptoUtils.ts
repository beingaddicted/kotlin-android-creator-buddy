
export class CryptoUtils {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  // Generate a random AES-256 key
  static async generateAESKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Generate RSA key pair for signing
  static async generateRSAKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'RSA-PSS',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
  }

  // Encrypt data with AES-GCM
  static async encryptAES(data: string, key: CryptoKey): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = this.encoder.encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    return { encrypted, iv };
  }

  // Decrypt data with AES-GCM
  static async decryptAES(encrypted: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    return this.decoder.decode(decrypted);
  }

  // Sign data with RSA-PSS
  static async signRSA(data: string, privateKey: CryptoKey): Promise<ArrayBuffer> {
    const encodedData = this.encoder.encode(data);
    return await crypto.subtle.sign(
      { name: 'RSA-PSS', saltLength: 32 },
      privateKey,
      encodedData
    );
  }

  // Verify signature with RSA-PSS
  static async verifyRSA(signature: ArrayBuffer, data: string, publicKey: CryptoKey): Promise<boolean> {
    const encodedData = this.encoder.encode(data);
    return await crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength: 32 },
      publicKey,
      signature,
      encodedData
    );
  }

  // Export key to raw format
  static async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey(key.type === 'secret' ? 'raw' : 'spki', key);
  }

  // Import key from raw format
  static async importAESKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Import RSA public key
  static async importRSAPublicKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'spki',
      keyData,
      { name: 'RSA-PSS', hash: 'SHA-256' },
      true,
      ['verify']
    );
  }

  // Convert ArrayBuffer to base64
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binary);
  }

  // Convert base64 to ArrayBuffer
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Generate random challenge for authentication
  static generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array);
  }
}
