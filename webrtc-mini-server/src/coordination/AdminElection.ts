
import { EventEmitter } from 'events';
import { CandidateManager } from './CandidateManager';
import { ElectionLogic } from './ElectionLogic';
import { HeartbeatManager } from './HeartbeatManager';
import { AdminCandidate, AdminElectionEvent } from './types';

export class AdminElection extends EventEmitter {
  private candidateManager: CandidateManager;
  private heartbeatManager: HeartbeatManager;
  private currentAdmin: string | null = null;
  private electionTimeout: NodeJS.Timeout | null = null;
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

    this.candidateManager = new CandidateManager();
    this.heartbeatManager = new HeartbeatManager(
      this.ownDeviceId,
      () => this.handleStaleCheck()
    );

    this.setupHeartbeatHandlers();
  }

  private setupHeartbeatHandlers(): void {
    this.heartbeatManager.on('heartbeat-broadcast', (event) => {
      // Update our own heartbeat
      this.candidateManager.updateCandidateHeartbeat(this.ownDeviceId);
      
      // Forward the event
      this.emit('heartbeat-broadcast', event);
    });
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
      this.candidateManager.registerCandidate({
        deviceId: this.ownDeviceId,
        deviceName: this.ownDeviceName,
        capabilities: this.ownCapabilities,
        joinTime: Date.now(),
        lastSeen: Date.now(),
        priority: ElectionLogic.calculatePriority(this.ownCapabilities)
      });

      this.heartbeatManager.start();
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
    
    this.heartbeatManager.stop();
    this.candidateManager.clear();
    this.currentAdmin = null;
    this.isElectionInProgress = false;
  }

  registerCandidate(candidate: AdminCandidate): void {
    this.candidateManager.registerCandidate(candidate);
    
    // If we don't have an admin yet, schedule an election
    if (!this.currentAdmin && !this.isElectionInProgress && this.isStarted) {
      this.scheduleElection();
    }
  }

  updateCandidateHeartbeat(deviceId: string): void {
    this.candidateManager.updateCandidateHeartbeat(deviceId);
  }

  removeCandidateFromElection(deviceId: string): void {
    this.candidateManager.removeCandidate(deviceId);
    
    // If the current admin was removed, trigger new election
    if (this.currentAdmin === deviceId) {
      this.currentAdmin = null;
      if (this.isStarted) {
        this.scheduleElection();
      }
    }
  }

  private handleStaleCheck(): void {
    const removedCandidates = this.candidateManager.removeStaleCandidate();
    
    // If current admin was removed due to staleness, trigger election
    if (removedCandidates.includes(this.currentAdmin || '')) {
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
      const activeCandidates = this.candidateManager.getActiveCandidates();
      
      if (activeCandidates.length === 0) {
        console.log('AdminElection: No candidates available');
        this.isElectionInProgress = false;
        return;
      }
      
      // Find the best candidate
      const winner = ElectionLogic.selectWinner(activeCandidates);
      
      if (winner) {
        const previousAdmin = this.currentAdmin;
        this.currentAdmin = winner.deviceId;
        
        console.log(`AdminElection: Elected ${winner.deviceId} as admin`);
        
        const electionEvent: AdminElectionEvent = {
          adminId: winner.deviceId,
          adminName: winner.deviceName,
          previousAdmin,
          isOwnDevice: winner.deviceId === this.ownDeviceId
        };
        
        this.emit('admin-elected', electionEvent);
      }
    } catch (error) {
      console.error('AdminElection: Error during election:', error);
    } finally {
      this.isElectionInProgress = false;
    }
  }

  getCurrentAdmin(): string | null {
    return this.currentAdmin;
  }

  isCurrentDeviceAdmin(): boolean {
    return this.currentAdmin === this.ownDeviceId;
  }

  getCandidates(): AdminCandidate[] {
    return this.candidateManager.getAllCandidates();
  }

  isElectionActive(): boolean {
    return this.isElectionInProgress;
  }

  isRunning(): boolean {
    return this.isStarted;
  }
}

// Re-export types for backward compatibility
export type { AdminCandidate, AdminElectionEvent, HeartbeatEvent } from './types';
