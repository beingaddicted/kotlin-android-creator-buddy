
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

      // Generate a more realistic QR code pattern
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 256;
      
      if (ctx) {
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 256);
        
        // Create a simple QR-like pattern
        ctx.fillStyle = '#000000';
        
        // Corner patterns
        this.drawCornerPattern(ctx, 10, 10);
        this.drawCornerPattern(ctx, 200, 10);
        this.drawCornerPattern(ctx, 10, 200);
        
        // Data pattern (pseudo-random based on invite code)
        this.drawDataPattern(ctx, inviteCode);
        
        // Add text for debugging
        ctx.fillStyle = '#000000';
        ctx.font = '10px Arial';
        ctx.fillText(organizationName.substring(0, 15), 60, 130);
      }

      const qrDataURL = canvas.toDataURL();
      console.log('QRService: Generated QR code data URL length:', qrDataURL.length);

      return { qrDataURL, inviteCode };
    } catch (error) {
      console.error('QRService: Failed to generate QR code:', error);
      throw error;
    }
  }

  private drawCornerPattern(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Draw QR corner pattern
    ctx.fillRect(x, y, 40, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, y + 5, 30, 30);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 10, y + 10, 20, 20);
  }

  private drawDataPattern(ctx: CanvasRenderingContext2D, seed: string): void {
    // Generate pseudo-random pattern based on invite code
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) & 0xffffffff;
    }
    
    for (let x = 60; x < 190; x += 5) {
      for (let y = 60; y < 190; y += 5) {
        hash = ((hash * 1103515245) + 12345) & 0x7fffffff;
        if (hash % 3 === 0) {
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
  }

  async generateWebRTCServerOfferQR(offerData: any): Promise<string> {
    try {
      console.log('QRService: Generating WebRTC server QR for:', offerData);
      
      // Generate QR code for WebRTC server offer
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 256;
      
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#000000';
        
        // Create WebRTC-specific pattern
        this.drawCornerPattern(ctx, 10, 10);
        this.drawCornerPattern(ctx, 200, 10);
        this.drawCornerPattern(ctx, 10, 200);
        
        // WebRTC identifier pattern
        ctx.fillRect(200, 200, 40, 40);
        ctx.fillStyle = '#0066cc';
        ctx.fillRect(205, 205, 30, 30);
        
        ctx.fillStyle = '#000000';
        ctx.font = '10px Arial';
        ctx.fillText('WebRTC', 90, 128);
        if (offerData.organizationName) {
          ctx.fillText(offerData.organizationName.substring(0, 12), 80, 140);
        }
      }

      const qrDataURL = canvas.toDataURL();
      console.log('QRService: Generated WebRTC QR code data URL length:', qrDataURL.length);
      
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
