
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
}

export const qrService = new QRService();
