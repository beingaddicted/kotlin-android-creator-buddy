
import QRCode from 'qrcode';
import { WebRTCOffer, WebRTCAnswer } from './WebRTCService';

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

  async generateWebRTCOfferQR(offerData: WebRTCOffer): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(offerData), {
        width: 400,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error('WebRTC Offer QR generation failed:', error);
      throw new Error('Failed to generate WebRTC offer QR code');
    }
  }

  async generateWebRTCAnswerQR(answerData: WebRTCAnswer): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(answerData), {
        width: 400,
        margin: 2,
        color: {
          dark: '#059669',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error('WebRTC Answer QR generation failed:', error);
      throw new Error('Failed to generate WebRTC answer QR code');
    }
  }

  parseQRData(qrString: string): QRData | WebRTCOffer | WebRTCAnswer | null {
    try {
      const data = JSON.parse(qrString);
      
      if (data.type === 'organization_invite' && data.organizationId && data.adminId) {
        return data as QRData;
      }
      
      if (data.type === 'webrtc_offer' && data.offer && data.organizationId) {
        return data as WebRTCOffer;
      }

      if (data.type === 'webrtc_answer' && data.answer && data.userId) {
        return data as WebRTCAnswer;
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
