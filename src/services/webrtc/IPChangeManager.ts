export interface IPChangeEvent {
  oldIP: string;
  newIP: string;
  timestamp: number;
  source: 'local' | 'peer';
  peerId?: string;
  confidence: number; // 0-1 score for detection confidence
  networkType?: string; // wifi, cellular, ethernet, etc.
}

export interface NetworkQualityMetrics {
  latency: number;
  bandwidth: number;
  packetLoss: number;
  jitter: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export class IPChangeManager {
  private currentIP: string = 'unknown';
  private ipHistory: Array<{ ip: string; timestamp: number; networkType?: string }> = [];
  private ipCheckInterval: NodeJS.Timeout | null = null;
  private onIPChanged?: (event: IPChangeEvent) => void;
  private isMonitoring = false;
  private checkFrequency = 10000; // 10 seconds default
  private tempConnections = new Set<RTCPeerConnection>();
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private networkQuality: NetworkQualityMetrics | null = null;

  startMonitoring(frequency: number = 10000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.checkFrequency = frequency;
    this.connectionAttempts = 0;
    
    // Initial IP detection with network type
    this.getCurrentIPWithNetworkInfo().then(({ ip, networkType }) => {
      this.currentIP = ip;
      this.ipHistory.push({ ip, timestamp: Date.now(), networkType });
      console.log('IPChangeManager: Initial IP detected:', ip, 'Network:', networkType);
    });
    
    // Start periodic monitoring
    this.ipCheckInterval = setInterval(() => {
      this.checkForIPChange();
    }, this.checkFrequency);
    
    // Monitor network quality
    this.startNetworkQualityMonitoring();
    
    console.log('IPChangeManager: Started monitoring IP changes every', frequency, 'ms');
  }

  stopMonitoring() {
    if (this.ipCheckInterval) {
      clearInterval(this.ipCheckInterval);
      this.ipCheckInterval = null;
    }
    
    this.isMonitoring = false;
    this.cleanupTempConnections();
    console.log('IPChangeManager: Stopped monitoring IP changes');
  }

  setConnectionInstability(isUnstable: boolean) {
    // Adaptive monitoring frequency based on connection stability
    if (isUnstable && this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring(3000); // Check every 3 seconds when unstable
      console.log('IPChangeManager: Increased monitoring frequency due to instability');
    } else if (!isUnstable && this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring(10000); // Back to normal frequency
      console.log('IPChangeManager: Restored normal monitoring frequency');
    }
  }

  private async checkForIPChange() {
    try {
      const { ip: newIP, networkType, confidence } = await this.getCurrentIPWithNetworkInfo();
      
      if (newIP !== this.currentIP && newIP !== 'unknown' && this.currentIP !== 'unknown') {
        // Verify IP change with multiple attempts for accuracy
        if (confidence > 0.7 || await this.verifyIPChange(newIP)) {
          console.log('IPChangeManager: IP change detected from', this.currentIP, 'to', newIP, 'Network:', networkType);
          
          const event: IPChangeEvent = {
            oldIP: this.currentIP,
            newIP: newIP,
            timestamp: Date.now(),
            source: 'local',
            confidence,
            networkType
          };
          
          // Update history
          this.ipHistory.push({ ip: newIP, timestamp: Date.now(), networkType });
          
          // Keep only last 20 entries
          if (this.ipHistory.length > 20) {
            this.ipHistory.shift();
          }
          
          this.currentIP = newIP;
          this.connectionAttempts = 0; // Reset on successful detection
          
          if (this.onIPChanged) {
            this.onIPChanged(event);
          }
        }
      } else if (newIP !== 'unknown') {
        this.currentIP = newIP;
        this.connectionAttempts = 0; // Reset on successful connection
      }
    } catch (error) {
      console.error('IPChangeManager: Failed to check IP change:', error);
      this.connectionAttempts++;
      
      // If we've failed too many times, try alternative detection methods
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.warn('IPChangeManager: Max connection attempts reached, trying alternative detection');
        await this.tryAlternativeIPDetection();
      }
    }
  }

  private async getCurrentIPWithNetworkInfo(): Promise<{ ip: string; networkType?: string; confidence: number }> {
    try {
      // Get network information if available
      const networkType = await this.getNetworkType();
      
      // Create a temporary peer connection to get local IP
      const tempConnection = new RTCPeerConnection({ 
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      this.tempConnections.add(tempConnection);
      
      const tempChannel = tempConnection.createDataChannel('temp');
      
      return new Promise((resolve) => {
        let resolved = false;
        let candidateCount = 0;
        let bestCandidate: { ip: string; confidence: number } = { ip: 'unknown', confidence: 0 };
        
        tempConnection.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            candidateCount++;
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            
            if (ipMatch && !ipMatch[1].startsWith('169.254')) { // Exclude link-local addresses
              const ip = ipMatch[1];
              let confidence = 0.5;
              
              // Higher confidence for certain IP ranges
              if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
                confidence = 0.8; // Private IP ranges are more reliable
              } else if (!ip.startsWith('127.')) {
                confidence = 0.9; // Public IPs are most reliable
              }
              
              if (confidence > bestCandidate.confidence) {
                bestCandidate = { ip, confidence };
              }
              
              // If we have a high-confidence candidate, use it
              if (confidence >= 0.8) {
                resolved = true;
                this.cleanupTempConnection(tempConnection);
                resolve({ ip, networkType, confidence });
                return;
              }
            }
          }
        };
        
        tempConnection.onicegatheringstatechange = () => {
          if (tempConnection.iceGatheringState === 'complete' && !resolved) {
            resolved = true;
            this.cleanupTempConnection(tempConnection);
            resolve({ 
              ip: bestCandidate.ip, 
              networkType, 
              confidence: bestCandidate.confidence 
            });
          }
        };
        
        tempConnection.createOffer().then(offer => {
          tempConnection.setLocalDescription(offer);
        }).catch(() => {
          this.cleanupTempConnection(tempConnection);
          resolve({ ip: 'unknown', networkType, confidence: 0 });
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.cleanupTempConnection(tempConnection);
            resolve({ 
              ip: bestCandidate.ip, 
              networkType, 
              confidence: bestCandidate.confidence 
            });
          }
        }, 5000);
      });
    } catch (error) {
      console.error('IPChangeManager: Failed to get current IP:', error);
      return { ip: 'unknown', confidence: 0 };
    }
  }

  private async getNetworkType(): Promise<string> {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection?.effectiveType || connection?.type || 'unknown';
    }
    return 'unknown';
  }

  private async verifyIPChange(newIP: string): Promise<boolean> {
    // Perform a second check to verify the IP change
    try {
      const { ip, confidence } = await this.getCurrentIPWithNetworkInfo();
      return ip === newIP && confidence > 0.6;
    } catch {
      return false;
    }
  }

  private async tryAlternativeIPDetection(): Promise<void> {
    try {
      // Try using a different STUN server
      const alternativeServers = [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.services.mozilla.com' }
      ];
      
      for (const server of alternativeServers) {
        try {
          const tempConnection = new RTCPeerConnection({ 
            iceServers: [server]
          });
          
          const result = await this.getSingleIPFromConnection(tempConnection);
          if (result.ip !== 'unknown') {
            console.log('IPChangeManager: Alternative detection successful:', result.ip);
            this.currentIP = result.ip;
            this.connectionAttempts = 0;
            return;
          }
        } catch (error) {
          console.warn('IPChangeManager: Alternative server failed:', server.urls, error);
        }
      }
    } catch (error) {
      console.error('IPChangeManager: All alternative detection methods failed:', error);
    }
  }

  private async getSingleIPFromConnection(connection: RTCPeerConnection): Promise<{ ip: string; confidence: number }> {
    return new Promise((resolve) => {
      let resolved = false;
      
      connection.onicecandidate = (event) => {
        if (event.candidate && !resolved) {
          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          
          if (ipMatch && !ipMatch[1].startsWith('169.254')) {
            resolved = true;
            connection.close();
            resolve({ ip: ipMatch[1], confidence: 0.7 });
            return;
          }
        }
      };
      
      connection.createDataChannel('temp');
      connection.createOffer().then(offer => {
        connection.setLocalDescription(offer);
      }).catch(() => {
        if (!resolved) {
          resolved = true;
          connection.close();
          resolve({ ip: 'unknown', confidence: 0 });
        }
      });
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          connection.close();
          resolve({ ip: 'unknown', confidence: 0 });
        }
      }, 3000);
    });
  }

  private startNetworkQualityMonitoring(): void {
    // Monitor network quality metrics if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateNetworkQuality = () => {
        const downlink = connection?.downlink || 0;
        const rtt = connection?.rtt || 0;
        
        let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
        
        if (downlink > 10 && rtt < 100) quality = 'excellent';
        else if (downlink > 5 && rtt < 200) quality = 'good';
        else if (downlink > 1 && rtt < 500) quality = 'fair';
        
        this.networkQuality = {
          latency: rtt,
          bandwidth: downlink,
          packetLoss: 0, // Not available in browser API
          jitter: 0, // Not available in browser API
          quality
        };
      };
      
      updateNetworkQuality();
      connection?.addEventListener('change', updateNetworkQuality);
    }
  }

  private cleanupTempConnection(connection: RTCPeerConnection) {
    try {
      connection.close();
      this.tempConnections.delete(connection);
    } catch (error) {
      console.error('IPChangeManager: Failed to cleanup temp connection:', error);
    }
  }

  private cleanupTempConnections() {
    this.tempConnections.forEach(connection => {
      this.cleanupTempConnection(connection);
    });
  }

  getCurrentIPSync(): string {
    return this.currentIP;
  }

  getIPHistory(): Array<{ ip: string; timestamp: number; networkType?: string }> {
    return [...this.ipHistory];
  }

  getNetworkQuality(): NetworkQualityMetrics | null {
    return this.networkQuality;
  }

  onIPChange(callback: (event: IPChangeEvent) => void) {
    this.onIPChanged = callback;
  }

  handlePeerIPChange(peerId: string, oldIP: string, newIP: string) {
    const event: IPChangeEvent = {
      oldIP,
      newIP,
      timestamp: Date.now(),
      source: 'peer',
      peerId,
      confidence: 1.0 // Peer-reported changes are assumed accurate
    };
    
    console.log('IPChangeManager: Peer IP change detected for', peerId, 'from', oldIP, 'to', newIP);
    
    if (this.onIPChanged) {
      this.onIPChanged(event);
    }
  }

  // Enhanced cleanup method
  cleanup(): void {
    this.stopMonitoring();
    this.ipHistory = [];
    this.networkQuality = null;
    this.connectionAttempts = 0;
  }
}
