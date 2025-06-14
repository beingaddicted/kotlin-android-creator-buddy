
export interface IPChangeEvent {
  oldIP: string;
  newIP: string;
  timestamp: number;
  source: 'local' | 'peer';
  peerId?: string;
}

export class IPChangeManager {
  private currentIP: string = 'unknown';
  private ipCheckInterval: NodeJS.Timeout | null = null;
  private onIPChanged?: (event: IPChangeEvent) => void;
  private isMonitoring = false;
  private checkFrequency = 10000; // 10 seconds default
  private tempConnections = new Set<RTCPeerConnection>();

  startMonitoring(frequency: number = 10000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.checkFrequency = frequency;
    
    // Initial IP detection
    this.getCurrentIP().then(ip => {
      this.currentIP = ip;
      console.log('IPChangeManager: Initial IP detected:', ip);
    });
    
    // Start periodic monitoring
    this.ipCheckInterval = setInterval(() => {
      this.checkForIPChange();
    }, this.checkFrequency);
    
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
    // Increase monitoring frequency during unstable connections
    if (isUnstable && this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring(3000); // Check every 3 seconds when unstable
    } else if (!isUnstable && this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring(10000); // Back to normal frequency
    }
  }

  private async checkForIPChange() {
    try {
      const newIP = await this.getCurrentIP();
      
      if (newIP !== this.currentIP && newIP !== 'unknown' && this.currentIP !== 'unknown') {
        console.log('IPChangeManager: IP change detected from', this.currentIP, 'to', newIP);
        
        const event: IPChangeEvent = {
          oldIP: this.currentIP,
          newIP: newIP,
          timestamp: Date.now(),
          source: 'local'
        };
        
        this.currentIP = newIP;
        
        if (this.onIPChanged) {
          this.onIPChanged(event);
        }
      } else if (newIP !== 'unknown') {
        this.currentIP = newIP;
      }
    } catch (error) {
      console.error('IPChangeManager: Failed to check IP change:', error);
    }
  }

  private async getCurrentIP(): Promise<string> {
    try {
      // Create a temporary peer connection to get local IP
      const tempConnection = new RTCPeerConnection({ 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
      });
      
      this.tempConnections.add(tempConnection);
      
      const tempChannel = tempConnection.createDataChannel('temp');
      
      return new Promise((resolve) => {
        let resolved = false;
        
        tempConnection.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch && !ipMatch[1].startsWith('169.254')) { // Exclude link-local addresses
              resolved = true;
              this.cleanupTempConnection(tempConnection);
              resolve(ipMatch[1]);
              return;
            }
          }
        };
        
        tempConnection.createOffer().then(offer => {
          tempConnection.setLocalDescription(offer);
        }).catch(() => {
          this.cleanupTempConnection(tempConnection);
          resolve('unknown');
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.cleanupTempConnection(tempConnection);
            resolve('unknown');
          }
        }, 5000);
      });
    } catch (error) {
      console.error('IPChangeManager: Failed to get current IP:', error);
      return 'unknown';
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

  onIPChange(callback: (event: IPChangeEvent) => void) {
    this.onIPChanged = callback;
  }

  handlePeerIPChange(peerId: string, oldIP: string, newIP: string) {
    const event: IPChangeEvent = {
      oldIP,
      newIP,
      timestamp: Date.now(),
      source: 'peer',
      peerId
    };
    
    console.log('IPChangeManager: Peer IP change detected for', peerId, 'from', oldIP, 'to', newIP);
    
    if (this.onIPChanged) {
      this.onIPChanged(event);
    }
  }
}
