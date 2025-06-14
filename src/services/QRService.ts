
import QRCode from 'qrcode';

export interface QRData {
  type: 'organization_invite';
  organizationId: string;
  organizationName: string;
  adminId: string;
  timestamp: number;
  inviteCode: string;
}

class QRService {
  async generateQRCode(organizationId: string, organizationName: string, adminId: string): Promise<string> {
    const qrData: QRData = {
      type: 'organization_invite',
      organizationId,
      organizationName,
      adminId,
      timestamp: Date.now(),
      inviteCode: this.generateInviteCode(),
    };

    try {
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error('QR Code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  parseQRData(qrString: string): QRData | null {
    try {
      const data = JSON.parse(qrString);
      
      if (data.type === 'organization_invite' && data.organizationId && data.adminId) {
        return data as QRData;
      }
      
      return null;
    } catch (error) {
      console.error('Invalid QR data:', error);
      return null;
    }
  }

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  shareViaWhatsApp(qrDataURL: string, organizationName: string): void {
    const message = encodeURIComponent(
      `Join our ${organizationName} organization tracking system! Scan this QR code to get started: ${qrDataURL}`
    );
    
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }
}

export const qrService = new QRService();
