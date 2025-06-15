
import QRCode from 'qrcode';

export interface QRData {
  type: string;
  [key: string]: any;
}

export class QRService {
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
      console.log('QRService: Starting QR code generation for:', { organizationId, organizationName, adminId });
      
      const inviteCode = `inv_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      const qrData = {
        type: 'organization_invite',
        organizationId,
        organizationName,
        adminId,
        inviteCode,
        timestamp: Date.now()
      };

      console.log('QRService: Generated QR data:', qrData);

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

      console.log('QRService: Generated QR code successfully');

      return { qrDataURL, inviteCode };
    } catch (error) {
      console.error('QRService: Failed to generate QR code:', error);
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
      const message = `Join ${organizationName} location tracking`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Failed to share via WhatsApp:', error);
    }
  }
}

export const qrService = new QRService();
