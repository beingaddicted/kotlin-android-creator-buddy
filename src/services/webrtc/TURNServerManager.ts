
export interface TURNServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export class TURNServerManager {
  private turnServers: TURNServerConfig[] = [
    // Public TURN servers (fallback)
    {
      urls: ['turn:relay1.expressturn.com:3478'],
      username: 'efJBIBF6EOGACCG',
      credential: 'web_host'
    },
    {
      urls: ['turn:openrelay.metered.ca:80'],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  private customTurnServers: TURNServerConfig[] = [];

  addCustomTURNServer(config: TURNServerConfig): void {
    this.customTurnServers.push(config);
    console.log('Added custom TURN server:', config.urls);
  }

  getICEServers(): RTCIceServer[] {
    const stunServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];

    const turnServers = [...this.customTurnServers, ...this.turnServers].map(server => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential
    }));

    return [...stunServers, ...turnServers];
  }

  async testConnectivity(): Promise<boolean> {
    try {
      const connection = new RTCPeerConnection({
        iceServers: this.getICEServers()
      });

      return new Promise((resolve) => {
        let hasConnected = false;
        const timeout = setTimeout(() => {
          if (!hasConnected) {
            connection.close();
            resolve(false);
          }
        }, 10000);

        connection.onicecandidate = (event) => {
          if (event.candidate && event.candidate.candidate.includes('typ relay')) {
            hasConnected = true;
            clearTimeout(timeout);
            connection.close();
            resolve(true);
          }
        };

        connection.createDataChannel('test');
        connection.createOffer().then(offer => {
          connection.setLocalDescription(offer);
        });
      });
    } catch (error) {
      console.error('TURN connectivity test failed:', error);
      return false;
    }
  }
}
