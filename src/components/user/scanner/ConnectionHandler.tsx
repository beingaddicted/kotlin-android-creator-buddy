
import { webRTCService, WebRTCServerOffer } from "@/services/WebRTCService";
import { DeviceIDManager } from "@/services/webrtc/DeviceIDManager";

export class ConnectionHandler {
  static async connectToServer(offerData: WebRTCServerOffer): Promise<void> {
    // Get or create device ID
    const deviceId = DeviceIDManager.getOrCreateDeviceId();
    
    // Get user data from localStorage or prompt
    const userRegistration = localStorage.getItem('userRegistration');
    let userName = 'Anonymous User';
    
    if (userRegistration) {
      const userData = JSON.parse(userRegistration);
      userName = userData.name;
    } else {
      userName = prompt('Enter your name:') || 'Anonymous User';
      
      // Store user registration for future use
      const userData = {
        userId: deviceId,
        name: userName,
        timestamp: Date.now()
      };
      localStorage.setItem('userRegistration', JSON.stringify(userData));
    }

    // Connect to WebRTC server
    await webRTCService.connectToServer(offerData, deviceId, userName);
  }
}
