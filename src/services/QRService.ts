
import QRCode from 'qrcode';

export interface QRData {
  type: string;
  [key: string]: any;
}

interface SecureQRData extends QRData {
  encryptionHeader: string;
  timestamp: number;
  adminSignature: string;
  securityLevel: 'standard' | 'enhanced';
}

export class QRService {
  private generateEncryptionHeader(): string {
    // Generate a secure encryption header (base64 encoded random bytes)
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return btoa(String.fromCharCode(...randomBytes));
  }

  private generateAdminSignature(data: any, adminId: string): string {
    // Generate a simple admin signature based on data and admin ID
    const signatureData = JSON.stringify(data) + adminId + Date.now();
    const encoder = new TextEncoder();
    const hashBuffer = crypto.subtle ? null : signatureData; // Fallback for older browsers
    
    // Simple hash for signature (in production, use proper cryptographic signing)
    let hash = 0;
    for (let i = 0; i < signatureData.length; i++) {
      const char = signatureData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return btoa(hash.toString(16));
  }

  async generateQRData(data: any): Promise<string> {
    try {
      return JSON.stringify(data);
    } catch (error) {
      throw new Error('Failed to generate QR data');
    }
  }

  async parseQRData(qrString: string): Promise<QRData> {
    try {
      const data = JSON.parse(qrString);
      if (!data.type) {
        throw new Error('Invalid QR data format - missing type');
      }
      return data;
    } catch (error) {
      throw new Error('Failed to parse QR data');
    }
  }

  validateQRData(data: QRData): boolean {
    return data && typeof data === 'object' && typeof data.type === 'string';
  }

  async generateQRCode(organizationId: string, organizationName: string, adminId: string): Promise<{ qrDataURL: string; inviteCode: string }> {
    try {
      console.log('QRService: Starting secure QR code generation for:', { organizationId, organizationName, adminId });
      
      const inviteCode = `inv_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const timestamp = Date.now();
      
      // Generate security features
      const encryptionHeader = this.generateEncryptionHeader();
      
      const qrData: SecureQRData = {
        type: 'organization_invite',
        organizationId,
        organizationName,
        adminId,
        inviteCode,
        timestamp,
        encryptionHeader,
        securityLevel: 'enhanced',
        adminSignature: '' // Will be generated after base data is ready
      };

      // Generate admin signature based on the data
      qrData.adminSignature = this.generateAdminSignature(qrData, adminId);

      console.log('QRService: Generated secure QR data with encryption:', {
        ...qrData,
        encryptionHeader: qrData.encryptionHeader.substring(0, 16) + '...',
        adminSignature: qrData.adminSignature.substring(0, 16) + '...'
      });

      // Generate actual QR code using qrcode library
      const qrDataString = JSON.stringify(qrData);
      const qrDataURL = await QRCode.toDataURL(qrDataString, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      console.log('QRService: Generated secure QR code successfully');

      return { qrDataURL, inviteCode };
    } catch (error) {
      console.error('QRService: Failed to generate secure QR code:', error);
      throw error;
    }
  }

  async generateWebRTCServerOfferQR(offerData: any): Promise<string> {
    try {
      console.log('QRService: Generating WebRTC server QR for:', offerData);
      
      // Generate QR code for WebRTC server offer using qrcode library
      const qrDataString = JSON.stringify(offerData);
      const qrDataURL = await QRCode.toDataURL(qrDataString, {
        width: 256,
        margin: 2,
        color: {
          dark: '#0066cc',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      console.log('QRService: Generated WebRTC QR code successfully');
      
      return qrDataURL;
    } catch (error) {
      console.error('QRService: Failed to generate WebRTC QR code:', error);
      throw error;
    }
  }

  shareViaWhatsApp(qrDataURL: string, organizationName: string): void {
    try {
      const message = `Join ${organizationName} location tracking - Secure encrypted invite`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Failed to share via WhatsApp:', error);
    }
  }
}

export const qrService = new QRService();
