
import QRCode from 'qrcode';
import { WebRTCServerOffer } from './webrtc/types';

export interface QRData {
  type: 'organization_invite';
  organizationId: string;
  organizationName: string;
  adminId: string;
  timestamp: number;
  inviteCode: string;
  networkToken?: string;
}

class QRService {
  async generateQRCode(organizationId: string, organizationName: string, adminId: string): Promise<{ qrDataURL: string; inviteCode: string; }> {
    const inviteCode = this.generateInviteCode();
    
    // Generate network token for security
    const networkToken = window.securityManager ? 
      window.securityManager.generateNetworkToken() : 
      undefined;

    const qrData: QRData = {
      type: 'organization_invite',
      organizationId,
      organizationName,
      adminId,
      timestamp: Date.now(),
      inviteCode,
      networkToken,
    };

    try {
      // Encrypt QR data if security manager is available
      let finalQRData: string;
      if (window.securityManager) {
        finalQRData = await window.securityManager.encryptQRData(qrData);
      } else {
        finalQRData = JSON.stringify(qrData);
      }

      const qrCodeDataURL = await QRCode.toDataURL(finalQRData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H' // High error correction for encrypted data
      });

      return { qrDataURL: qrCodeDataURL, inviteCode };
    } catch (error) {
      console.error('QR Code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  async generateWebRTCServerOfferQR(offerData: WebRTCServerOffer): Promise<string> {
    try {
      // Add security enhancements to offer data
      const secureOfferData = {
        ...offerData,
        requiresAuth: true,
        adminCertificate: window.securityManager?.deviceAuth?.getCertificate(),
        networkToken: window.securityManager?.generateNetworkToken()
      };

      // Encrypt offer data if security manager is available
      let finalOfferData: string;
      if (window.securityManager) {
        finalOfferData = await window.securityManager.encryptQRData(secureOfferData);
      } else {
        finalOfferData = JSON.stringify(secureOfferData);
      }

      const qrCodeDataURL = await QRCode.toDataURL(finalOfferData, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H' // High error correction for encrypted data
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error('WebRTC Server Offer QR generation failed:', error);
      throw new Error('Failed to generate WebRTC server offer QR code');
    }
  }

  async parseQRData(qrString: string): Promise<QRData | WebRTCServerOffer | null> {
    try {
      // First try to decrypt if security manager is available
      let data: any;
      if (window.securityManager) {
        try {
          data = await window.securityManager.decryptQRData(qrString);
        } catch (decryptError) {
          console.warn('QR decryption failed, trying plain JSON:', decryptError);
          data = JSON.parse(qrString);
        }
      } else {
        data = JSON.parse(qrString);
      }

      // Validate organization invite
      if (data.type === 'organization_invite' && data.organizationId && data.adminId && data.inviteCode) {
        // Validate network token if present
        if (data.networkToken && window.securityManager) {
          if (!window.securityManager.validateNetworkToken(data.networkToken)) {
            throw new Error('Invalid or expired network token');
          }
        }
        return data as QRData;
      }

      // Validate WebRTC server offer
      if (data.type === 'webrtc_server_offer' && data.offer && data.organizationId) {
        // Validate network token if present
        if (data.networkToken && window.securityManager) {
          if (!window.securityManager.validateNetworkToken(data.networkToken)) {
            throw new Error('Invalid or expired network token');
          }
        }

        // Verify admin certificate if present
        if (data.adminCertificate && window.securityManager) {
          // Additional certificate validation can be added here
          console.log('QR contains admin certificate for verification');
        }

        return data as WebRTCServerOffer;
      }
      
      return null;
    } catch (error) {
      console.error('Invalid QR data:', error);
      throw new Error('Invalid or corrupted QR code');
    }
  }

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  shareViaWhatsApp(qrDataURL: string, organizationName: string): void {
    const message = encodeURIComponent(
      `Join our ${organizationName} secure tracking system! Scan this encrypted QR code to get started: ${qrDataURL}`
    );
    
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }
}

export const qrService = new QRService();
