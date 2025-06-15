
import { webRTCService, WebRTCServerOffer } from "@/services/WebRTCService";

export class ConnectionHandler {
  static async connectToServer(offerData: WebRTCServerOffer): Promise<void> {
    // Get user data from localStorage or prompt
    const userRegistration = localStorage.getItem('userRegistration');
    let userId = localStorage.getItem('userId');
    let userName = 'Anonymous User';
    
    if (userRegistration) {
      const userData = JSON.parse(userRegistration);
      userName = userData.name;
      userId = userData.userId;
    } else {
      userId = 'user-' + Date.now();
      userName = prompt('Enter your name:') || 'Anonymous User';
    }

    // Connect to WebRTC server
    await webRTCService.connectToServer(offerData, userId, userName);
  }
}
