
import { EventEmitter } from 'events';

export interface AdminCandidate {
  deviceId: string;
  deviceName: string;
  capabilities: string[];
  joinTime: number;
  lastSeen: number;
  priority: number;
}

export class AdminElection extends EventEmitter {
  private candidates = new Map<string, AdminCandidate>();
  private currentAdmin: string | null = null;
  private electionTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isElectionInProgress = false;
  private isStarted = false;

  constructor(
    private organizationId: string,
    private ownDeviceId: string,
    private ownDeviceName: string,
    private ownCapabilities: string[]
  ) {
    super();
    
    // Validate inputs
    if (!organizationId || !ownDeviceId) {
      throw new Error('Organization ID and device ID are required');
    }
  }

  start(): void {
    if (this.isStarted) {
      console.warn('AdminElection: Already started');
      return;
    }
    
    console.log('AdminElection: Starting admin election process');
    this.isStarted = true;
    
    try {
      // Register ourselves as a candidate
      this.registerCandidate({
        deviceId: this.ownDeviceId,
        deviceName: this.ownDeviceName,
        capabilities: this.ownCapabilities,
        joinTime: Date.now(),
        lastSeen: Date.now(),
        priority: this.calculatePriority(this.ownCapabilities)
      });

      this.startHeartbeat();
      this.scheduleElection();
    } catch (error) {
      console.error('AdminElection: Failed to start:', error);
      this.isStarted = false;
      throw error;
    }
  }

  stop(): void {
    if (!this.isStarted) return;
    
    console.log('AdminElection: Stopping admin election');
    this.isStarted = false;
    
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
      this.electionTimeout = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.candidates.clear();
    this.currentAdmin = null;
    this.isElectionInProgress = false;
  }

  registerCandidate(candidate: AdminCandidate): void {
    // Validate candidate
    if (!candidate.deviceId || !candidate.deviceName) {
      console.error('AdminElection: Invalid candidate data');
      return;
    }
    
    console.log(`AdminElection: Registering candidate ${candidate.deviceId}`);
    this.candidates.set(candidate.deviceId, candidate);
    
    // If we don't have an admin yet, schedule an election
    if (!this.currentAdmin && !this.isElectionInProgress && this.isStarted) {
      this.scheduleElection();
    }
  }

  updateCandidateHeartbeat(deviceId: string): void {
    const candidate = this.candidates.get(deviceId);
    if (candidate) {
      candidate.lastSeen = Date.now();
    }
  }

  removeCandidateFromElection(deviceId: string): void {
    if (!deviceId) return;
    
    console.log(`AdminElection: Removing candidate ${deviceId}`);
    this.candidates.delete(deviceId);
    
    // If the current admin was removed, trigger new election
    if (this.currentAdmin === deviceId) {
      this.currentAdmin = null;
      if (this.isStarted) {
        this.scheduleElection();
      }
    }
  }

  private scheduleElection(): void {
    if (this.isElectionInProgress || !this.isStarted) return;
    
    console.log('AdminElection: Scheduling election in 2 seconds');
    
    // Clear any existing timeout
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
    }
    
    this.electionTimeout = setTimeout(() => {
      try {
        this.conductElection();
      } catch (error) {
        console.error('AdminElection: Election failed:', error);
        this.isElectionInProgress = false;
      }
    }, 2000);
  }

  private conductElection(): void {
    if (this.isElectionInProgress || !this.isStarted) return;
    
    this.isElectionInProgress = true;
    console.log('AdminElection: Conducting election');
    
    try {
      // Remove stale candidates
      this.removeStaleCandidate();
      
      if (this.candidates.size === 0) {
        console.log('AdminElection: No candidates available');
        this.isElectionInProgress = false;
        return;
      }
      
      // Find the best candidate
      const winner = this.selectWinner();
      
      if (winner) {
        const previousAdmin = this.currentAdmin;
        this.currentAdmin = winner.deviceId;
        
        console.log(`AdminElection: Elected ${winner.deviceId} as admin`);
        
        this.emit('admin-elected', {
          adminId: winner.deviceId,
          adminName: winner.deviceName,
          previousAdmin,
          isOwnDevice: winner.deviceId === this.ownDeviceId
        });
      }
    } catch (error) {
      console.error('AdminElection: Error during election:', error);
    } finally {
      this.isElectionInProgress = false;
    }
  }

  private selectWinner(): AdminCandidate | null {
    const activeCandidates = Array.from(this.candidates.values())
      .filter(c => this.isCandidateActive(c));
    
    if (activeCandidates.length === 0) return null;
    
    // Sort by priority (highest first), then by join time (earliest first)
    activeCandidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.joinTime - b.joinTime; // Earlier join time first
    });
    
    return activeCandidates[0];
  }

  private calculatePriority(capabilities: string[]): number {
    if (!Array.isArray(capabilities)) return 0;
    
    let priority = 0;
    
    // Higher priority for devices with more capabilities
    priority += capabilities.length;
    
    // Bonus for specific capabilities
    if (capabilities.includes('location.view')) priority += 5;
    if (capabilities.includes('admin.manage')) priority += 10;
    if (capabilities.includes('server.temporary')) priority += 3;
    
    return priority;
  }

  private isCandidateActive(candidate: AdminCandidate): boolean {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    return (now - candidate.lastSeen) < timeout;
  }

  private removeStaleCandidate(): void {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    
    const staleCandidates: string[] = [];
    
    this.candidates.forEach((candidate, deviceId) => {
      if ((now - candidate.lastSeen) > timeout) {
        staleCandidates.push(deviceId);
      }
    });
    
    staleCandidates.forEach(deviceId => {
      this.removeCandidateFromElection(deviceId);
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      try {
        // Update our own heartbeat
        this.updateCandidateHeartbeat(this.ownDeviceId);
        
        // Broadcast heartbeat to other candidates
        this.emit('heartbeat-broadcast', {
          deviceId: this.ownDeviceId,
          timestamp: Date.now()
        });
        
        // Check for stale candidates
        this.removeStaleCandidate();
      } catch (error) {
        console.error('AdminElection: Heartbeat error:', error);
      }
    }, 10000); // Every 10 seconds
  }

  getCurrentAdmin(): string | null {
    return this.currentAdmin;
  }

  isCurrentDeviceAdmin(): boolean {
    return this.currentAdmin === this.ownDeviceId;
  }

  getCandidates(): AdminCandidate[] {
    return Array.from(this.candidates.values());
  }

  isElectionActive(): boolean {
    return this.isElectionInProgress;
  }

  isRunning(): boolean {
    return this.isStarted;
  }
}
