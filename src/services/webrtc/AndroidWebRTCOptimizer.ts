
export class AndroidWebRTCOptimizer {
  private static instance: AndroidWebRTCOptimizer;

  static getInstance(): AndroidWebRTCOptimizer {
    if (!AndroidWebRTCOptimizer.instance) {
      AndroidWebRTCOptimizer.instance = new AndroidWebRTCOptimizer();
    }
    return AndroidWebRTCOptimizer.instance;
  }

  optimizeForAndroid(): RTCConfiguration {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Additional STUN servers for better Android connectivity
        { urls: 'stun:stun.services.mozilla.com:3478' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require',
      // Android-specific optimizations
      iceTransportPolicy: 'all'
    };
  }

  getAndroidCompatibleConstraints(): MediaStreamConstraints {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
      },
      video: false // Start with audio only for better performance
    };
  }

  optimizeDataChannelForAndroid(): RTCDataChannelInit {
    return {
      ordered: true,
      maxRetransmits: 3,
      // Smaller max packet size for mobile networks
      maxPacketLifeTime: 3000
    };
  }

  isAndroidEnvironment(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  getNetworkOptimizations(): any {
    return {
      heartbeatInterval: this.isAndroidEnvironment() ? 15000 : 10000, // Longer intervals on mobile
      reconnectionDelay: this.isAndroidEnvironment() ? 3000 : 2000,
      maxReconnectionAttempts: this.isAndroidEnvironment() ? 8 : 5
    };
  }

  handleAndroidNetworkChanges(): void {
    // Listen for Android network changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      connection.addEventListener('change', () => {
        console.log('AndroidWebRTCOptimizer: Network change detected');
        const event = new CustomEvent('android-network-change', {
          detail: {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt
          }
        });
        window.dispatchEvent(event);
      });
    }

    // Listen for visibility changes (Android app backgrounding)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('AndroidWebRTCOptimizer: App backgrounded');
        const event = new CustomEvent('android-app-backgrounded');
        window.dispatchEvent(event);
      } else {
        console.log('AndroidWebRTCOptimizer: App foregrounded');
        const event = new CustomEvent('android-app-foregrounded');
        window.dispatchEvent(event);
      }
    });
  }
}
