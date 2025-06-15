
import { webRTCService, WebRTCServerOffer } from "@/services/WebRTCService";
import { DeviceIDManager } from "@/services/webrtc/DeviceIDManager";

interface UserRegistration {
  name: string;
  userId: string;
  timestamp: number;
}

export class ConnectionHandler {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 2000;

  static async connectToServer(offerData: WebRTCServerOffer): Promise<void> {
    if (!offerData || typeof offerData !== 'object') {
      throw new Error('Invalid offer data provided');
    }

    if (!offerData.organizationId || !offerData.adminId) {
      throw new Error('Offer data missing required fields');
    }

    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.MAX_RETRIES) {
      try {
        return await this.attemptConnection(offerData, retries);
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        if (retries < this.MAX_RETRIES) {
          console.warn(`Connection attempt ${retries} failed, retrying in ${this.RETRY_DELAY}ms:`, error);
          await this.delay(this.RETRY_DELAY * retries);
        }
      }
    }

    throw new Error(`Failed to connect after ${this.MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
  }

  private static async attemptConnection(offerData: WebRTCServerOffer, attempt: number): Promise<void> {
    try {
      const deviceId = DeviceIDManager.getOrCreateDeviceId();
      if (!deviceId) {
        throw new Error('Failed to generate device ID');
      }

      const { userName } = this.getUserData(deviceId);

      if (!webRTCService || typeof webRTCService.connectToServer !== 'function') {
        throw new Error('WebRTC service not available');
      }

      console.log(`Connection attempt ${attempt + 1}: Connecting to ${offerData.organizationName}`);

      await Promise.race([
        webRTCService.connectToServer(offerData, deviceId, userName),
        this.createTimeoutPromise(30000, 'Connection timeout')
      ]);

      await this.verifyConnection();

      console.log('Successfully connected to WebRTC server');

    } catch (error) {
      console.error('Connection attempt failed:', error);
      
      try {
        if (webRTCService && typeof webRTCService.disconnect === 'function') {
          webRTCService.disconnect();
        }
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }
      
      throw error;
    }
  }

  private static getUserData(deviceId: string): { userName: string; userData: UserRegistration } {
    try {
      const userRegistration = localStorage.getItem('userRegistration');
      let userName = 'Anonymous User';
      let userData: UserRegistration;

      if (userRegistration) {
        try {
          const parsed = JSON.parse(userRegistration);
          if (parsed && typeof parsed === 'object' && parsed.name) {
            userName = parsed.name;
            userData = parsed;
          } else {
            throw new Error('Invalid user registration data format');
          }
        } catch (parseError) {
          console.warn('Failed to parse user registration:', parseError);
          localStorage.removeItem('userRegistration');
          userData = this.createNewUserRegistration(deviceId);
        }
      } else {
        userData = this.createNewUserRegistration(deviceId);
      }

      return { userName, userData };
    } catch (error) {
      console.error('Error getting user data:', error);
      const userData: UserRegistration = {
        userId: deviceId,
        name: 'Anonymous User',
        timestamp: Date.now()
      };
      return { userName: 'Anonymous User', userData };
    }
  }

  private static createNewUserRegistration(deviceId: string): UserRegistration {
    let userName = 'Anonymous User';
    
    try {
      const promptedName = prompt('Enter your name:');
      if (promptedName && promptedName.trim().length > 0) {
        userName = promptedName.trim().slice(0, 50);
      }
    } catch (error) {
      console.warn('Error prompting for name:', error);
    }

    const userData: UserRegistration = {
      userId: deviceId,
      name: userName,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('userRegistration', JSON.stringify(userData));
    } catch (error) {
      console.warn('Failed to save user registration:', error);
    }

    return userData;
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static createTimeoutPromise(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private static async verifyConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection verification timeout'));
      }, 5000);

      if (webRTCService && typeof webRTCService.getConnectionStatus === 'function') {
        const status = webRTCService.getConnectionStatus();
        if (status === 'connected') {
          clearTimeout(timeout);
          resolve();
        } else {
          clearTimeout(timeout);
          reject(new Error(`Connection not established. Status: ${status}`));
        }
      } else {
        clearTimeout(timeout);
        resolve();
      }
    });
  }
}
