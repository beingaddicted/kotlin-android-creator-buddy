
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
      const inviteCode = `inv_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      const qrData = {
        type: 'organization_invite',
        organizationId,
        organizationName,
        adminId,
        inviteCode,
        timestamp: Date.now()
      };

      // Generate QR code data URL (mock implementation)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 256;
      
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#000000';
        ctx.fillText('QR Code', 100, 128);
      }

      const qrDataURL = canvas.toDataURL();

      return { qrDataURL, inviteCode };
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      throw error;
    }
  }

  async generateWebRTCServerOfferQR(offerData: any): Promise<string> {
    try {
      // Generate QR code for WebRTC server offer (mock implementation)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 256;
      
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#000000';
        ctx.fillText('WebRTC QR', 90, 128);
      }

      return canvas.toDataURL();
    } catch (error) {
      console.error('Failed to generate WebRTC QR code:', error);
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
