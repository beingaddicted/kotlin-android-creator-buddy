
export interface DegradationLevel {
  level: 'full' | 'limited' | 'minimal' | 'offline';
  features: {
    realTimeLocation: boolean;
    videoCapabilities: boolean;
    fileTransfer: boolean;
    voiceChat: boolean;
    instantMessaging: boolean;
  };
  limitations: string[];
}

export class GracefulDegradationManager {
  private currentLevel: DegradationLevel = this.getFullFeatures();
  private onDegradationCallbacks: ((level: DegradationLevel) => void)[] = [];

  private getFullFeatures(): DegradationLevel {
    return {
      level: 'full',
      features: {
        realTimeLocation: true,
        videoCapabilities: true,
        fileTransfer: true,
        voiceChat: true,
        instantMessaging: true
      },
      limitations: []
    };
  }

  private getLimitedFeatures(): DegradationLevel {
    return {
      level: 'limited',
      features: {
        realTimeLocation: true,
        videoCapabilities: false,
        fileTransfer: false,
        voiceChat: false,
        instantMessaging: true
      },
      limitations: [
        'Video features disabled due to bandwidth constraints',
        'File transfer unavailable',
        'Voice chat disabled'
      ]
    };
  }

  private getMinimalFeatures(): DegradationLevel {
    return {
      level: 'minimal',
      features: {
        realTimeLocation: false,
        videoCapabilities: false,
        fileTransfer: false,
        voiceChat: false,
        instantMessaging: true
      },
      limitations: [
        'Real-time location disabled',
        'Only basic messaging available',
        'No media features available'
      ]
    };
  }

  private getOfflineFeatures(): DegradationLevel {
    return {
      level: 'offline',
      features: {
        realTimeLocation: false,
        videoCapabilities: false,
        fileTransfer: false,
        voiceChat: false,
        instantMessaging: false
      },
      limitations: [
        'No real-time features available',
        'Working in offline mode',
        'Data will sync when connection is restored'
      ]
    };
  }

  assessConnectionQuality(health?: { rtt: number; packetLoss: number; bitrate: number }): void {
    if (!health) {
      this.setDegradationLevel('offline');
      return;
    }

    const { rtt, packetLoss, bitrate } = health;

    if (rtt < 100 && packetLoss < 1 && bitrate > 1000000) {
      this.setDegradationLevel('full');
    } else if (rtt < 200 && packetLoss < 3 && bitrate > 500000) {
      this.setDegradationLevel('limited');
    } else if (rtt < 500 && packetLoss < 10 && bitrate > 100000) {
      this.setDegradationLevel('minimal');
    } else {
      this.setDegradationLevel('offline');
    }
  }

  setDegradationLevel(level: DegradationLevel['level']): void {
    let newLevel: DegradationLevel;

    switch (level) {
      case 'full':
        newLevel = this.getFullFeatures();
        break;
      case 'limited':
        newLevel = this.getLimitedFeatures();
        break;
      case 'minimal':
        newLevel = this.getMinimalFeatures();
        break;
      case 'offline':
        newLevel = this.getOfflineFeatures();
        break;
      default:
        return;
    }

    if (this.currentLevel.level !== newLevel.level) {
      this.currentLevel = newLevel;
      this.notifyDegradationCallbacks();
      console.log('Degradation level changed to:', level, 'Limitations:', newLevel.limitations);
    }
  }

  getCurrentLevel(): DegradationLevel {
    return { ...this.currentLevel };
  }

  isFeatureAvailable(feature: keyof DegradationLevel['features']): boolean {
    return this.currentLevel.features[feature];
  }

  onDegradationChange(callback: (level: DegradationLevel) => void): void {
    this.onDegradationCallbacks.push(callback);
  }

  private notifyDegradationCallbacks(): void {
    this.onDegradationCallbacks.forEach(callback => {
      try {
        callback(this.currentLevel);
      } catch (error) {
        console.error('Degradation callback error:', error);
      }
    });
  }

  getFeatureMessage(feature: keyof DegradationLevel['features']): string {
    if (this.isFeatureAvailable(feature)) {
      return '';
    }

    const messages = {
      realTimeLocation: 'Real-time location tracking is temporarily unavailable due to connection quality.',
      videoCapabilities: 'Video features are disabled to preserve connection stability.',
      fileTransfer: 'File transfers are temporarily disabled due to bandwidth constraints.',
      voiceChat: 'Voice chat is unavailable due to connection quality.',
      instantMessaging: 'Messaging is temporarily unavailable. Messages will be queued for delivery.'
    };

    return messages[feature] || 'This feature is temporarily unavailable.';
  }

  cleanup(): void {
    this.onDegradationCallbacks = [];
    this.currentLevel = this.getFullFeatures();
  }
}
