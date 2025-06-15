
import { AdminCandidate } from './types';

export class CandidateManager {
  private candidates = new Map<string, AdminCandidate>();

  registerCandidate(candidate: AdminCandidate): void {
    if (!candidate.deviceId || !candidate.deviceName) {
      console.error('CandidateManager: Invalid candidate data');
      return;
    }
    
    console.log(`CandidateManager: Registering candidate ${candidate.deviceId}`);
    this.candidates.set(candidate.deviceId, candidate);
  }

  updateCandidateHeartbeat(deviceId: string): void {
    const candidate = this.candidates.get(deviceId);
    if (candidate) {
      candidate.lastSeen = Date.now();
    }
  }

  removeCandidate(deviceId: string): void {
    if (!deviceId) return;
    
    console.log(`CandidateManager: Removing candidate ${deviceId}`);
    this.candidates.delete(deviceId);
  }

  getAllCandidates(): AdminCandidate[] {
    return Array.from(this.candidates.values());
  }

  getCandidateById(deviceId: string): AdminCandidate | undefined {
    return this.candidates.get(deviceId);
  }

  getActiveCandidates(): AdminCandidate[] {
    return Array.from(this.candidates.values())
      .filter(candidate => this.isCandidateActive(candidate));
  }

  removeStaleCandidate(): string[] {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    const staleCandidates: string[] = [];
    
    this.candidates.forEach((candidate, deviceId) => {
      if ((now - candidate.lastSeen) > timeout) {
        staleCandidates.push(deviceId);
      }
    });
    
    staleCandidates.forEach(deviceId => {
      this.removeCandidate(deviceId);
    });
    
    return staleCandidates;
  }

  clear(): void {
    this.candidates.clear();
  }

  size(): number {
    return this.candidates.size;
  }

  private isCandidateActive(candidate: AdminCandidate): boolean {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    return (now - candidate.lastSeen) < timeout;
  }
}
