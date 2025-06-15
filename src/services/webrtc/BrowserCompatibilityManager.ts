export interface BrowserCapabilities {
  webrtc: boolean;
  dataChannels: boolean;
  getStats: boolean;
  restartIce: boolean;
  replaceTrack: boolean;
  insertableStreams: boolean;
  webgl: boolean;
  mediaDevices: boolean;
}

export interface BrowserInfo {
  name: string;
  version: string;
  capabilities: BrowserCapabilities;
  limitations: string[];
  recommendations: string[];
}

export class BrowserCompatibilityManager {
  private browserInfo: BrowserInfo;

  constructor() {
    this.browserInfo = this.detectBrowser();
    this.logCompatibilityInfo();
  }

  private detectBrowser(): BrowserInfo {
    const userAgent = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';

    // Detect browser name and version
    if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
      name = 'Chrome';
      version = this.extractVersion(userAgent, 'Chrome/');
    } else if (userAgent.includes('Firefox/')) {
      name = 'Firefox';
      version = this.extractVersion(userAgent, 'Firefox/');
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      name = 'Safari';
      version = this.extractVersion(userAgent, 'Version/');
    } else if (userAgent.includes('Edg/')) {
      name = 'Edge';
      version = this.extractVersion(userAgent, 'Edg/');
    }

    const capabilities = this.testCapabilities();
    const { limitations, recommendations } = this.getCompatibilityInfo(name, version, capabilities);

    return {
      name,
      version,
      capabilities,
      limitations,
      recommendations
    };
  }

  private extractVersion(userAgent: string, prefix: string): string {
    const index = userAgent.indexOf(prefix);
    if (index === -1) return 'Unknown';
    
    const versionStart = index + prefix.length;
    const versionEnd = userAgent.indexOf(' ', versionStart);
    return userAgent.substring(versionStart, versionEnd === -1 ? undefined : versionEnd);
  }

  private testCapabilities(): BrowserCapabilities {
    return {
      webrtc: !!(window.RTCPeerConnection),
      dataChannels: this.testDataChannels(),
      getStats: this.testGetStats(),
      restartIce: this.testRestartIce(),
      replaceTrack: this.testReplaceTrack(),
      insertableStreams: this.testInsertableStreams(),
      webgl: this.testWebGL(),
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
  }

  private testDataChannels(): boolean {
    try {
      const pc = new RTCPeerConnection();
      const channel = pc.createDataChannel('test');
      pc.close();
      return true;
    } catch {
      return false;
    }
  }

  private testGetStats(): boolean {
    try {
      const pc = new RTCPeerConnection();
      const hasGetStats = typeof pc.getStats === 'function';
      pc.close();
      return hasGetStats;
    } catch {
      return false;
    }
  }

  private testRestartIce(): boolean {
    try {
      const pc = new RTCPeerConnection();
      const hasRestartIce = typeof pc.restartIce === 'function';
      pc.close();
      return hasRestartIce;
    } catch {
      return false;
    }
  }

  private testReplaceTrack(): boolean {
    try {
      const pc = new RTCPeerConnection();
      pc.addTransceiver('audio');
      const transceiver = pc.getTransceivers()[0];
      const hasReplaceTrack = transceiver.sender && typeof transceiver.sender.replaceTrack === 'function';
      pc.close();
      return hasReplaceTrack;
    } catch {
      return false;
    }
  }

  private testInsertableStreams(): boolean {
    try {
      // @ts-ignore - checking for experimental API
      return !!(window.RTCRtpScriptTransform || window.RTCEncodedVideoFrame);
    } catch {
      return false;
    }
  }

  private testWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!context;
    } catch {
      return false;
    }
  }

  private getCompatibilityInfo(name: string, version: string, capabilities: BrowserCapabilities): {
    limitations: string[];
    recommendations: string[];
  } {
    const limitations: string[] = [];
    const recommendations: string[] = [];

    // Check basic WebRTC support
    if (!capabilities.webrtc) {
      limitations.push('WebRTC is not supported in this browser');
      recommendations.push('Please use a modern browser like Chrome, Firefox, Safari, or Edge');
      return { limitations, recommendations };
    }

    // Browser-specific checks
    switch (name) {
      case 'Safari':
        limitations.push('Safari has limited WebRTC codec support');
        if (!capabilities.restartIce) {
          limitations.push('ICE restart is not supported, reconnections may be slower');
        }
        recommendations.push('Consider using Chrome or Firefox for better WebRTC experience');
        break;

      case 'Firefox':
        if (!capabilities.insertableStreams) {
          limitations.push('Advanced media processing features may not work');
        }
        break;

      case 'Chrome':
        // Generally best compatibility
        if (parseInt(version) < 80) {
          limitations.push('Older Chrome version may have WebRTC issues');
          recommendations.push('Update to the latest version of Chrome');
        }
        break;

      case 'Edge':
        if (parseInt(version) < 79) {
          limitations.push('Legacy Edge has poor WebRTC support');
          recommendations.push('Update to the latest version of Edge');
        }
        break;
    }

    // Feature-specific limitations
    if (!capabilities.dataChannels) {
      limitations.push('Data channels not supported, messaging features unavailable');
    }

    if (!capabilities.getStats) {
      limitations.push('Connection quality monitoring unavailable');
    }

    if (!capabilities.mediaDevices) {
      limitations.push('Camera and microphone access not available');
    }

    if (!capabilities.webgl) {
      limitations.push('Hardware acceleration unavailable, performance may be reduced');
    }

    // Mobile-specific checks
    if (/Mobile|Android|iPhone|iPad/.test(navigator.userAgent)) {
      limitations.push('Mobile browsers may have reduced WebRTC performance');
      recommendations.push('Use WiFi for best connection quality');
      
      if (name === 'Safari' && /iPhone|iPad/.test(navigator.userAgent)) {
        limitations.push('iOS Safari may lose connections when app is backgrounded');
        recommendations.push('Keep the app in foreground for stable connections');
      }
    }

    return { limitations, recommendations };
  }

  getBrowserInfo(): BrowserInfo {
    return { ...this.browserInfo };
  }

  isFeatureSupported(feature: keyof BrowserCapabilities): boolean {
    return this.browserInfo.capabilities[feature];
  }

  getRecommendations(): string[] {
    return [...this.browserInfo.recommendations];
  }

  getLimitations(): string[] {
    return [...this.browserInfo.limitations];
  }

  private logCompatibilityInfo(): void {
    console.log('Browser Compatibility:', {
      browser: `${this.browserInfo.name} ${this.browserInfo.version}`,
      capabilities: this.browserInfo.capabilities,
      limitations: this.browserInfo.limitations,
      recommendations: this.browserInfo.recommendations
    });
  }

  generateCompatibilityReport(): string {
    const info = this.browserInfo;
    
    let report = `Browser Compatibility Report\n`;
    report += `============================\n`;
    report += `Browser: ${info.name} ${info.version}\n`;
    report += `User Agent: ${navigator.userAgent}\n\n`;
    
    report += `Capabilities:\n`;
    Object.entries(info.capabilities).forEach(([key, value]) => {
      report += `  ${key}: ${value ? '✓' : '✗'}\n`;
    });
    
    if (info.limitations.length > 0) {
      report += `\nLimitations:\n`;
      info.limitations.forEach(limitation => {
        report += `  • ${limitation}\n`;
      });
    }
    
    if (info.recommendations.length > 0) {
      report += `\nRecommendations:\n`;
      info.recommendations.forEach(recommendation => {
        report += `  • ${recommendation}\n`;
      });
    }
    
    return report;
  }
}
