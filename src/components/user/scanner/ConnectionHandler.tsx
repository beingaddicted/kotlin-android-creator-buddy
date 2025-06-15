
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
    // Validate input
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
          await this.delay(this.RETRY_DELAY * retries); // Exponential backoff
        }
      }
    }

    throw new Error(`Failed to connect after ${this.MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
  }

  private static async attemptConnection(offerData: WebRTCServerOffer, attempt: number): Promise<void> {
    try {
      // Get or create device ID with validation
      const deviceId = DeviceIDManager.getOrCreateDeviceId();
      if (!deviceId) {
        throw new Error('Failed to generate device ID');
      }

      // Get user data with enhanced validation
      const { userName, userData } = this.getUserData(deviceId);

      // Validate WebRTC service availability
      if (!webRTCService || typeof webRTCService.connectToServer !== 'function') {
        throw new Error('WebRTC service not available');
      }

      // Log connection attempt
      console.log(`Connection attempt ${attempt + 1}: Connecting to ${offerData.organizationName}`);

      // Connect to WebRTC server with timeout
      await Promise.race([
        webRTCService.connectToServer(offerData, deviceId, userName),
        this.createTimeoutPromise(30000, 'Connection timeout')
      ]);

      // Verify connection was successful
      await this.verifyConnection();

      console.log('Successfully connected to WebRTC server');

    } catch (error) {
      console.error('Connection attempt failed:', error);
      
      // Clean up partial connections
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
          localStorage.removeItem('userRegistration'); // Clean up invalid data
          userData = this.createNewUserRegistration(deviceId);
        }
      } else {
        userData = this.createNewUserRegistration(deviceId);
      }

      return { userName, userData };
    } catch (error) {
      console.error('Error getting user data:', error);
      // Fallback to anonymous user
      const userData: UserRegistration = {
        userId: deviceId,
        name: 'Anonymous User',
        timestamp: Date.now()
      };
      return { userName: 'Anonymous User', userData };
    }
  }

  private static createNewUserRegistration(deviceId: string): UserRegistration {
    // Prompt for name with validation
    let userName = 'Anonymous User';
    
    try {
      const promptedName = prompt('Enter your name:');
      if (promptedName && promptedName.trim().length > 0) {
        // Basic sanitization
        userName = promptedName.trim().slice(0, 50); // Limit length
      }
    } catch (error) {
      console.warn('Error prompting for name:', error);
    }

    const userData: UserRegistration = {
      userId: deviceId,
      name: userName,
      timestamp: Date.now()
    };

    // Store user registration with error handling
    try {
      localStorage.setItem('userRegistration', JSON.stringify(userData));
    } catch (storageError) {
      console.warn('Failed to store user registration:', storageError);
      // Continue without storing - not critical for connection
    }

    return userData;
  }

  private static async verifyConnection(): Promise<void> {
    // Give connection a moment to establish
    await this.delay(1000);

    if (!webRTCService) {
      throw new Error('WebRTC service not available for verification');
    }

    // Check connection status if available
    if (typeof webRTCService.getConnectionStatus === 'function') {
      const status = webRTCService.getConnectionStatus();
      if (status === 'disconnected') {
        throw new Error('Connection verification failed - status is disconnected');
      }
    }

    // Additional verification could be added here
    console.log('Connection verification passed');
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static createTimeoutPromise(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  // Static method to check if connection is possible
  static async canConnect(): Promise<{ canConnect: boolean; reason?: string }> {
    try {
      // Check if WebRTC is supported
      if (!window.RTCPeerConnection) {
        return { canConnect: false, reason: 'WebRTC not supported in this browser' };
      }

      // Check if services are available
      if (!webRTCService) {
        return { canConnect: false, reason: 'WebRTC service not initialized' };
      }

      // Check network status if available
      if (navigator.onLine === false) {
        return { canConnect: false, reason: 'No internet connection' };
      }

      return { canConnect: true };
    } catch (error) {
      return { canConnect: false, reason: `Connection check failed: ${(error as Error).message}` };
    }
  }

  // Static method to get connection requirements
  static getConnectionRequirements(): string[] {
    return [
      'WebRTC support in browser',
      'Internet connection',
      'Camera/location permissions (if needed)',
      'Valid QR code from admin'
    ];
  }
}
